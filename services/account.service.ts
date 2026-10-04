import { db } from "@/lib/db";
import { accounts, transactions, transfers, budgets } from "@/db/schema";
import { eq, and, sql, lte, gte, gt } from "drizzle-orm";
import { CreateAccountInput, UpdateAccountInput } from "@/schemas/account.schema";

export interface AccountWithBalance {
  id: string;
  userId: string;
  name: string;
  type: string;
  initialBalance: string;
  currency: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  currentBalance: number;
  totalBalance?: number;
  freeCash?: number;
}

export class AccountService {
  /**
   * Create a new financial account for the authenticated user
   */
  static async createAccount(userId: string, input: CreateAccountInput) {
    const [account] = await db
      .insert(accounts)
      .values({
        userId,
        name: input.name,
        type: input.type,
        initialBalance: input.initialBalance,
        currency: input.currency || "IDR",
        isActive: true,
      })
      .returning();

    return account;
  }

  /**
   * List all accounts for the user (fast query without balance calculation)
   */
  static async getAccounts(userId: string) {
    return db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .orderBy(accounts.createdAt);
  }

  /**
   * [P7 OPTIMIZED] List all accounts with calculated balances
   * Uses batch aggregation to eliminate N+1 query problem
   * Before: 10 accounts x 8+ queries = 80+ queries
   * After: 4 parallel batch queries total
   */
  static async getAccountsWithBalances(userId: string): Promise<AccountWithBalance[]> {
    const userAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .orderBy(accounts.createdAt);

    if (userAccounts.length === 0) return [];

    const [incomeAgg, expenseAgg, transfersInAgg, transfersOutAgg] = await Promise.all([
      db.select({
          accountId: transactions.accountId,
          total: sql<string>`coalesce(sum(${transactions.amount}), '0.00')`,
        }).from(transactions)
        .where(and(eq(transactions.userId, userId), eq(transactions.type, "INCOME"), eq(transactions.status, "CONFIRMED")))
        .groupBy(transactions.accountId),

      db.select({
          accountId: transactions.accountId,
          total: sql<string>`coalesce(sum(${transactions.amount}), '0.00')`,
        }).from(transactions)
        .where(and(eq(transactions.userId, userId), eq(transactions.type, "EXPENSE"), eq(transactions.status, "CONFIRMED")))
        .groupBy(transactions.accountId),

      db.select({
          accountId: transfers.toAccountId,
          total: sql<string>`coalesce(sum(${transfers.amount}), '0.00')`,
        }).from(transfers)
        .where(eq(transfers.userId, userId))
        .groupBy(transfers.toAccountId),

      db.select({
          accountId: transfers.fromAccountId,
          total: sql<string>`coalesce(sum(${transfers.amount}), '0.00')`,
        }).from(transfers)
        .where(eq(transfers.userId, userId))
        .groupBy(transfers.fromAccountId),
    ]);

    const incomeMap = new Map(incomeAgg.map(r => [r.accountId!, parseFloat(r.total)]));
    const expenseMap = new Map(expenseAgg.map(r => [r.accountId!, parseFloat(r.total)]));
    const transfersInMap = new Map(transfersInAgg.map(r => [r.accountId!, parseFloat(r.total)]));
    const transfersOutMap = new Map(transfersOutAgg.map(r => [r.accountId!, parseFloat(r.total)]));

    const results: AccountWithBalance[] = userAccounts.map(acc => {
      const initialBalance = parseFloat(acc.initialBalance);
      const income = incomeMap.get(acc.id) || 0;
      const expense = expenseMap.get(acc.id) || 0;
      const transfersIn = transfersInMap.get(acc.id) || 0;
      const transfersOut = transfersOutMap.get(acc.id) || 0;
      const balance = Math.round((initialBalance + income - expense + transfersIn - transfersOut) * 100) / 100;

      return { ...acc, currentBalance: balance, totalBalance: balance, freeCash: balance };
    });

    return results;
  }

  /**
   * Get single account by ID (strictly verifies ownership)
   */
  static async getAccountById(userId: string, accountId: string) {
    const [account] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
      .limit(1);

    if (!account) return null;

    const currentBalance = await this.getAccountBalance(
      userId,
      account.id,
      parseFloat(account.initialBalance)
    );

    const freeCash = await this.getFreeCash(userId, account.id);

    return {
      ...account,
      currentBalance,
      totalBalance: currentBalance,
      freeCash,
    };
  }

  /**
   * Update account properties
   */
  static async updateAccount(userId: string, accountId: string, input: UpdateAccountInput) {
    const [updated] = await db
      .update(accounts)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.type !== undefined && { type: input.type }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      })
      .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
      .returning();

    return updated ?? null;
  }

  /**
   * Soft deactivation of an account (preserves transaction history)
   */
  static async deactivateAccount(userId: string, accountId: string) {
    const [deactivated] = await db
      .update(accounts)
      .set({ isActive: false })
      .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
      .returning();

    return deactivated ?? null;
  }

  /**
   * Exact derived balance calculation
   */
  static async getAccountBalance(
    userId: string,
    accountId: string,
    initialBalance = 0
  ): Promise<number> {
    // 1. Incomes on this account
    const [incomeRes] = await db
      .select({
        total: sql<string>`coalesce(sum(${transactions.amount}), '0.00')`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.accountId, accountId),
          eq(transactions.type, "INCOME"),
          eq(transactions.status, "CONFIRMED")
        )
      );

    // 2. Expenses on this account
    const [expenseRes] = await db
      .select({
        total: sql<string>`coalesce(sum(${transactions.amount}), '0.00')`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.accountId, accountId),
          eq(transactions.type, "EXPENSE"),
          eq(transactions.status, "CONFIRMED")
        )
      );

    // 3. Incoming transfers to this account
    const [transfersInRes] = await db
      .select({
        total: sql<string>`coalesce(sum(${transfers.amount}), '0.00')`,
      })
      .from(transfers)
      .where(
        and(eq(transfers.userId, userId), eq(transfers.toAccountId, accountId))
      );

    // 4. Outgoing transfers from this account
    const [transfersOutRes] = await db
      .select({
        total: sql<string>`coalesce(sum(${transfers.amount}), '0.00')`,
      })
      .from(transfers)
      .where(
        and(eq(transfers.userId, userId), eq(transfers.fromAccountId, accountId))
      );

    const totalIncome = parseFloat(incomeRes?.total || "0");
    const totalExpense = parseFloat(expenseRes?.total || "0");
    const totalTransfersIn = parseFloat(transfersInRes?.total || "0");
    const totalTransfersOut = parseFloat(transfersOutRes?.total || "0");

    // Exact derived balance: initial + income - expense + in - out
    const balance =
      initialBalance +
      totalIncome -
      totalExpense +
      totalTransfersIn -
      totalTransfersOut;

    return Math.round(balance * 100) / 100;
  }

  /**
   * Calculate free cash (unallocated money) for an account
   * Free Cash = Account Balance - Sum of Active Budget Allocations
   * 
   * This represents the money available for non-budgeted spending.
   * Budget allocations are considered "reserved" funds.
   */
  static async getFreeCash(
    userId: string,
    accountId: string
  ): Promise<number> {
    try {
      // 1. Get total account balance
      const [account] = await db
        .select({ initialBalance: accounts.initialBalance })
        .from(accounts)
        .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
        .limit(1);
      
      if (!account) {
        throw new Error("Account not found");
      }
      
      const totalBalance = await this.getAccountBalance(
        userId,
        accountId,
        parseFloat(account.initialBalance)
      );
      
      // 2. Calculate sum of REMAINING active budget allocations
      // Free Cash = Actual Balance - Sum(Remaining Budgets), NOT original allocations
      const now = new Date();
      const activeBudgets = await db
        .select()
        .from(budgets)
        .where(
          and(
            eq(budgets.userId, userId),
            eq(budgets.accountId, accountId),
            lte(budgets.startDate, now),
            gt(budgets.endDate, now)
          )
        );
      
      let totalRemainingAllocated = 0;
      
      for (const budget of activeBudgets) {
        const { BudgetService } = await import("./budget.service");
        const budgetWithSpent = await BudgetService.findApplicableBudget(
          userId,
          accountId,
          budget.categoryId,
          now
        );
        
        if (budgetWithSpent) {
          totalRemainingAllocated += Math.max(0, budgetWithSpent.remaining);
        }
      }

      // 3. Free cash = total balance - allocations
      const freeCash = totalBalance - totalRemainingAllocated;
      
      return Math.round(freeCash * 100) / 100;
    } catch (error: unknown) {
      // HOTFIX: If account_id column doesn't exist in production (migration not run),
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage && (errorMessage.includes('column') || errorMessage.includes('does not exist'))) {
        console.warn('[HOTFIX] account_id column might be missing in budgets table, falling back to total balance');
        
        const [account] = await db
          .select({ initialBalance: accounts.initialBalance })
          .from(accounts)
          .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
          .limit(1);
        
        if (!account) {
          throw new Error("Account not found");
        }
        
        const totalBalance = await this.getAccountBalance(
          userId,
          accountId,
          parseFloat(account.initialBalance)
        );
        
        return Math.round(totalBalance * 100) / 100;
      }
      
      // Re-throw other errors
      throw error;
    }
  }
}

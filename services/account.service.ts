import { db } from "@/lib/db";
import { accounts, transactions, transfers, budgets } from "@/db/schema";
import { eq, and, sql, lte, gte } from "drizzle-orm";
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
   * List all accounts for the user, with their dynamically calculated exact balances
   */
  static async getAccountsWithBalances(userId: string): Promise<AccountWithBalance[]> {
    const userAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .orderBy(accounts.createdAt);

    if (userAccounts.length === 0) return [];

    // Calculate dynamic derived balance for each account:
    // Balance = initial_balance + income - expense + incoming_transfers - outgoing_transfers
    const results: AccountWithBalance[] = [];

    for (const acc of userAccounts) {
      const balance = await this.getAccountBalance(userId, acc.id, parseFloat(acc.initialBalance));
      const freeCash = await this.getFreeCash(userId, acc.id);
      results.push({
        ...acc,
        currentBalance: balance,
        totalBalance: balance,
        freeCash,
      });
    }

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
    
    // 2. Sum active budget allocations for this account
    // Active = budget period includes current time (startDate <= now < endDate)
    const now = new Date();
    const [allocationsRes] = await db
      .select({
        total: sql<string>`coalesce(sum(${budgets.amount}), '0.00')`,
      })
      .from(budgets)
      .where(
        and(
          eq(budgets.userId, userId),
          eq(budgets.accountId, accountId),
          lte(budgets.startDate, now),  // Budget has started
          gte(budgets.endDate, now)     // Budget hasn't ended
        )
      );
    
    const totalAllocated = parseFloat(allocationsRes?.total || "0");
    
    // 3. Free cash = total balance - allocations
    const freeCash = totalBalance - totalAllocated;
    
    return Math.round(freeCash * 100) / 100;
  }
}

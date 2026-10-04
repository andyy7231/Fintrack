import { db } from "@/lib/db";
import { transactions, accounts, categories, transfers, budgets } from "@/db/schema";
import { eq, and, sql, gte, lte, desc, isNull, or, lt, gt, isNotNull } from "drizzle-orm";

// â”€â”€â”€ DTO types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface DashboardSummary {
  totalBalance: number; // Uang Keseluruhan (total including allocations)
  freeCash: number; // Uang Free (unallocated cash)
  incomeThisMonth: number;
  expenseThisMonth: number;
  netThisMonth: number;
  activeAccountsCount: number;
  recentTransactions: Array<{
    id: string;
    description: string;
    amount: string;
    type: string;
    transactionDate: Date;
    accountName: string | null;
    categoryName: string | null;
    categoryColor: string | null;
  }>;
}

export interface DashboardKPIs {
  totalNetWorth: number;
  incomeThisMonth: number;
  expenseThisMonth: number;
  netSavings: number;
  savingRate: number;
  activeAccountsCount: number;
}

export interface MonthlyTrendPoint {
  /** e.g. "2026-09" */
  monthKey: string;
  /** Indonesian short month label e.g. "Sep" */
  label: string;
  income: number;
  expense: number;
}

export interface CategoryBreakdownItem {
  categoryId: string | null;
  categoryName: string;
  categoryColor: string;
  total: number;
  percentage: number;
}

export interface DailyExpensePoint {
  /** "1" .. "31" */
  day: number;
  /** e.g. "1 Sep" */
  label: string;
  expense: number;
}

export interface AccountBalanceItem {
  id: string;
  name: string;
  type: string;
  currency: string;
  currentBalance: number;
}

export interface RecentTransaction {
  id: string;
  description: string;
  amount: string;
  type: string;
  transactionDate: Date;
  accountName: string | null;
  categoryName: string | null;
  categoryColor: string | null;
}

// â”€â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Compute the Jakarta-timezone calendar month boundaries for a given UTC Date.
 * Returns the start/end timestamps that, when compared against `timestamp
 * without timezone` columns storing UTC values, correctly captures all
 * transactions that belong to the specified Jakarta month.
 *
 * Because the DB stores UTC, we build the POSIX boundaries by offsetting:
 *   Jakarta is UTC+7, so the Jakarta day boundary at local midnight == UTC 17:00 the previous day.
 *
 * We use Intl.DateTimeFormat to obtain year/month in the target timezone, then
 * construct the UTC boundaries accordingly.
 */
function getJakartaMonthBounds(
  date: Date,
  timezone = "Asia/Jakarta"
): { start: Date; end: Date; year: number; month: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
  });
  const parts = fmt.formatToParts(date);
  const year = parseInt(parts.find((p) => p.type === "year")!.value);
  const month = parseInt(parts.find((p) => p.type === "month")!.value);

  // Offset minutes for Asia/Jakarta is +420 (7 * 60)
  const tzOffsetMs = 7 * 60 * 60 * 1000;

  // Jakarta local midnight at start of month â†’ subtract offset to get UTC
  const startLocal = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const start = new Date(startLocal.getTime() - tzOffsetMs); // UTC equivalent

  // Jakarta local end of last day
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endLocal = new Date(
    Date.UTC(year, month - 1, daysInMonth, 23, 59, 59, 999)
  );
  const end = new Date(endLocal.getTime() - tzOffsetMs);

  return { start, end, year, month };
}

/**
 * Given a year + month (1-indexed), return the last day of that month.
 */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const INDONESIAN_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

// Fallback category colors for uncategorized items
const FALLBACK_COLOR = "#94a3b8";

// â”€â”€â”€ service â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€â”€ Period-aware KPI types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface PeriodKPIs {
  income: number;
  expense: number;
  net: number;
  transactionCount: number;
  periodStart: string; // ISO date string
  periodEnd: string;   // ISO date string
}

export class DashboardService {
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // LEGACY: getSummary â€” kept for backward-compat with Phase 2 tests
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  static async getSummary(
    userId: string,
    timezone = "Asia/Jakarta"
  ): Promise<DashboardSummary> {
    const now = new Date();
    const { start: startOfMonth, end: endOfMonth } = getJakartaMonthBounds(
      now,
      timezone
    );

    // 2. Aggregate Income This Month
    const [incomeMonthRes] = await db
      .select({
        total: sql<string>`coalesce(sum(${transactions.amount}), '0.00')`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "INCOME"),
          eq(transactions.status, "CONFIRMED"),
          gte(transactions.transactionDate, startOfMonth),
          lte(transactions.transactionDate, endOfMonth)
        )
      );

    // 3. Aggregate Expense This Month
    const [expenseMonthRes] = await db
      .select({
        total: sql<string>`coalesce(sum(${transactions.amount}), '0.00')`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "EXPENSE"),
          eq(transactions.status, "CONFIRMED"),
          gte(transactions.transactionDate, startOfMonth),
          lte(transactions.transactionDate, endOfMonth)
        )
      );

    const incomeThisMonth = parseFloat(incomeMonthRes?.total || "0");
    const expenseThisMonth = parseFloat(expenseMonthRes?.total || "0");
    const netThisMonth = incomeThisMonth - expenseThisMonth;

    // 4. Calculate Total Balance across active accounts (single optimized query)
    const totalBalance = await this._calcTotalNetWorth(userId);

    const activeAccounts = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.isActive, true)));

    // 5. Recent 5 Transactions
    const recent = await db
      .select({
        id: transactions.id,
        description: transactions.description,
        amount: transactions.amount,
        type: transactions.type,
        transactionDate: transactions.transactionDate,
        accountName: accounts.name,
        categoryName: categories.name,
        categoryColor: categories.color,
      })
      .from(transactions)
      .leftJoin(accounts, eq(transactions.accountId, accounts.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.transactionDate), desc(transactions.createdAt))
      .limit(5);

    // 6. Calculate free cash across all active accounts (P4: Batch optimized)
    const totalFreeCash = await this._calcTotalFreeCash(userId);

    return {
      totalBalance: Math.round(totalBalance * 100) / 100,
      freeCash: totalFreeCash,
      incomeThisMonth: Math.round(incomeThisMonth * 100) / 100,
      expenseThisMonth: Math.round(expenseThisMonth * 100) / 100,
      netThisMonth: Math.round(netThisMonth * 100) / 100,
      activeAccountsCount: activeAccounts.length,
      recentTransactions: recent,
    };
  }

  // ------------------------------------------------------------------
  // P4: Batch Free Cash Calculation
  // ------------------------------------------------------------------

  /**
   * P4: Efficient batch calculation of total Free Cash across all active accounts.
   * Replaces O(N×M) sequential loop with batch queries.
   * 
   * Formula (unchanged):
   *   Free Cash = Account Balance - Sum(Remaining Active Budget Allocations)
   * 
   * Query count: 6 + N_budgets (all parallel)
   * vs. Original: N_accounts × (5 + M_budgets_per_account × 2) sequential
   */
  private static async _calcTotalFreeCash(userId: string): Promise<number> {
    // 1. Get all active accounts with initial balances
    const activeAccounts = await db
      .select({
        id: accounts.id,
        initialBalance: accounts.initialBalance,
      })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.isActive, true)));

    if (activeAccounts.length === 0) return 0;

    // 2. Batch calculate account balances (same pattern as _calcTotalNetWorth)
    const [incomeRows, expenseRows, transferInRows, transferOutRows] =
      await Promise.all([
        db
          .select({
            accountId: transactions.accountId,
            total: sql<string>`coalesce(sum(${transactions.amount}), '0.00')`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              eq(transactions.type, "INCOME"),
              eq(transactions.status, "CONFIRMED")
            )
          )
          .groupBy(transactions.accountId),

        db
          .select({
            accountId: transactions.accountId,
            total: sql<string>`coalesce(sum(${transactions.amount}), '0.00')`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              eq(transactions.type, "EXPENSE"),
              eq(transactions.status, "CONFIRMED")
            )
          )
          .groupBy(transactions.accountId),

        db
          .select({
            accountId: transfers.toAccountId,
            total: sql<string>`coalesce(sum(${transfers.amount}), '0.00')`,
          })
          .from(transfers)
          .where(eq(transfers.userId, userId))
          .groupBy(transfers.toAccountId),

        db
          .select({
            accountId: transfers.fromAccountId,
            total: sql<string>`coalesce(sum(${transfers.amount}), '0.00')`,
          })
          .from(transfers)
          .where(eq(transfers.userId, userId))
          .groupBy(transfers.fromAccountId),
      ]);

    // Build balance lookup maps
    const incomeMap = Object.fromEntries(
      incomeRows.map((r) => [r.accountId, parseFloat(r.total)])
    );
    const expenseMap = Object.fromEntries(
      expenseRows.map((r) => [r.accountId, parseFloat(r.total)])
    );
    const transferInMap = Object.fromEntries(
      transferInRows.map((r) => [r.accountId, parseFloat(r.total)])
    );
    const transferOutMap = Object.fromEntries(
      transferOutRows.map((r) => [r.accountId, parseFloat(r.total)])
    );

    // Calculate balance per account
    const accountBalances = new Map<string, number>();
    for (const acc of activeAccounts) {
      const balance =
        parseFloat(acc.initialBalance) +
        (incomeMap[acc.id] || 0) -
        (expenseMap[acc.id] || 0) +
        (transferInMap[acc.id] || 0) -
        (transferOutMap[acc.id] || 0);
      accountBalances.set(acc.id, balance);
    }

    // 3. Get all active budgets for all accounts (single query)
    const now = new Date();
    const activeBudgets = await db
      .select({
        id: budgets.id,
        accountId: budgets.accountId,
        categoryId: budgets.categoryId,
        amount: budgets.amount,
        startDate: budgets.startDate,
        endDate: budgets.endDate,
      })
      .from(budgets)
      .where(
        and(
          eq(budgets.userId, userId),
          lte(budgets.startDate, now),
          gt(budgets.endDate, now)
        )
      );

    // 4. Batch calculate spending for all budgets (parallel via aggregateSpendingBulk)
    const { aggregateSpendingBulk } = await import("./budget.service");
    
    const budgetList = activeBudgets.map((b) => ({
      id: b.id,
      categoryId: b.categoryId,
      startDate: b.startDate,
      endDate: b.endDate,
    }));

    const spendingMap = await aggregateSpendingBulk(userId, budgetList);

    // 5. Calculate remaining allocations per account
    const accountAllocations = new Map<string, number>();
    
    for (const budget of activeBudgets) {
      const limitAmount = parseFloat(budget.amount);
      const spentAmount = spendingMap.get(budget.id) || 0;
      const remaining = Math.max(0, limitAmount - spentAmount);
      
      const currentAllocation = accountAllocations.get(budget.accountId!) || 0;
      accountAllocations.set(budget.accountId!, currentAllocation + remaining);
    }

    // 6. Calculate Free Cash per account and sum
    let totalFreeCash = 0;
    
    for (const acc of activeAccounts) {
      const balance = accountBalances.get(acc.id) || 0;
      const allocations = accountAllocations.get(acc.id) || 0;
      const freeCash = balance - allocations;
      totalFreeCash += freeCash;
    }

    return Math.round(totalFreeCash * 100) / 100;
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Phase 3: KPI Cards
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async getKPIs(
    userId: string,
    timezone = "Asia/Jakarta"
  ): Promise<DashboardKPIs> {
    const now = new Date();
    const { start: startOfMonth, end: endOfMonth } = getJakartaMonthBounds(
      now,
      timezone
    );

    // Parallel queries
    const [incomeRes, expenseRes, activeAccountRows, totalNetWorth] =
      await Promise.all([
        db
          .select({
            total: sql<string>`coalesce(sum(${transactions.amount}), '0.00')`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              eq(transactions.type, "INCOME"),
              eq(transactions.status, "CONFIRMED"),
              gte(transactions.transactionDate, startOfMonth),
              lte(transactions.transactionDate, endOfMonth)
            )
          )
          .then((r) => r[0]),

        db
          .select({
            total: sql<string>`coalesce(sum(${transactions.amount}), '0.00')`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              eq(transactions.type, "EXPENSE"),
              eq(transactions.status, "CONFIRMED"),
              gte(transactions.transactionDate, startOfMonth),
              lte(transactions.transactionDate, endOfMonth)
            )
          )
          .then((r) => r[0]),

        db
          .select({ id: accounts.id })
          .from(accounts)
          .where(
            and(eq(accounts.userId, userId), eq(accounts.isActive, true))
          ),

        this._calcTotalNetWorth(userId),
      ]);

    const incomeThisMonth = parseFloat(incomeRes?.total || "0");
    const expenseThisMonth = parseFloat(expenseRes?.total || "0");
    const netSavings = incomeThisMonth - expenseThisMonth;
    const savingRate =
      incomeThisMonth === 0
        ? 0
        : (netSavings / incomeThisMonth) * 100;

    return {
      totalNetWorth: Math.round(totalNetWorth * 100) / 100,
      incomeThisMonth: Math.round(incomeThisMonth * 100) / 100,
      expenseThisMonth: Math.round(expenseThisMonth * 100) / 100,
      netSavings: Math.round(netSavings * 100) / 100,
      savingRate: Math.round(savingRate * 100) / 100,
      activeAccountsCount: activeAccountRows.length,
    };
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Phase 3: 6-month Income vs Expense Trend
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async getMonthlyTrend(
    userId: string,
    timezone = "Asia/Jakarta"
  ): Promise<MonthlyTrendPoint[]> {
    const now = new Date();
    const tzOffsetMs = 7 * 60 * 60 * 1000; // Asia/Jakarta = UTC+7

    // Build the 6 calendar months (current + previous 5)
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "numeric",
    });
    const parts = fmt.formatToParts(now);
    const currentYear = parseInt(parts.find((p) => p.type === "year")!.value);
    const currentMonth = parseInt(parts.find((p) => p.type === "month")!.value);

    const months: { year: number; month: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      let m = currentMonth - i;
      let y = currentYear;
      while (m <= 0) {
        m += 12;
        y -= 1;
      }
      months.push({ year: y, month: m });
    }

    // Fetch all transactions in that 6-month window in one query
    const earliest = months[0];
    const latest = months[months.length - 1];

    const windowStart = new Date(
      new Date(Date.UTC(earliest.year, earliest.month - 1, 1, 0, 0, 0)).getTime() - tzOffsetMs
    );
    const lastDays = daysInMonth(latest.year, latest.month);
    const windowEnd = new Date(
      new Date(Date.UTC(latest.year, latest.month - 1, lastDays, 23, 59, 59, 999)).getTime() - tzOffsetMs
    );

    // Aggregate income/expense per calendar month (Jakarta) using Postgres
    // We use AT TIME ZONE to convert the stored UTC to Jakarta local, then truncate to month.
    const rows = await db
      .select({
        monthKey: sql<string>`to_char(${transactions.transactionDate} + interval '7 hours', 'YYYY-MM')`,
        type: transactions.type,
        total: sql<string>`coalesce(sum(${transactions.amount}), '0.00')`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.status, "CONFIRMED"),
          or(
            eq(transactions.type, "INCOME"),
            eq(transactions.type, "EXPENSE")
          ),
          gte(transactions.transactionDate, windowStart),
          lte(transactions.transactionDate, windowEnd)
        )
      )
      .groupBy(
        sql`to_char(${transactions.transactionDate} + interval '7 hours', 'YYYY-MM')`,
        transactions.type
      );

    // Build a lookup map
    const map: Record<string, { income: number; expense: number }> = {};
    for (const row of rows) {
      if (!map[row.monthKey]) map[row.monthKey] = { income: 0, expense: 0 };
      if (row.type === "INCOME") map[row.monthKey].income += parseFloat(row.total);
      if (row.type === "EXPENSE") map[row.monthKey].expense += parseFloat(row.total);
    }

    return months.map(({ year, month }) => {
      const key = `${year}-${String(month).padStart(2, "0")}`;
      const data = map[key] || { income: 0, expense: 0 };
      return {
        monthKey: key,
        label: `${INDONESIAN_MONTHS[month - 1]} ${year}`,
        income: Math.round(data.income * 100) / 100,
        expense: Math.round(data.expense * 100) / 100,
      };
    });
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Phase 3: Expense by Category (current month)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async getExpenseByCategory(
    userId: string,
    timezone = "Asia/Jakarta"
  ): Promise<CategoryBreakdownItem[]> {
    const now = new Date();
    const { start, end } = getJakartaMonthBounds(now, timezone);

    const rows = await db
      .select({
        categoryId: transactions.categoryId,
        categoryName: sql<string>`coalesce(${categories.name}, 'Tanpa Kategori')`,
        categoryColor: sql<string>`coalesce(${categories.color}, ${FALLBACK_COLOR})`,
        total: sql<string>`coalesce(sum(${transactions.amount}), '0.00')`,
      })
      .from(transactions)
      .leftJoin(
        categories,
        and(
          eq(transactions.categoryId, categories.id),
          or(isNull(categories.userId), eq(categories.userId, userId))
        )
      )
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "EXPENSE"),
          eq(transactions.status, "CONFIRMED"),
          gte(transactions.transactionDate, start),
          lte(transactions.transactionDate, end)
        )
      )
      .groupBy(
        transactions.categoryId,
        categories.name,
        categories.color
      );

    if (rows.length === 0) return [];

    const grandTotal = rows.reduce((acc, r) => acc + parseFloat(r.total), 0);

    return rows
      .map((r) => ({
        categoryId: r.categoryId,
        categoryName: r.categoryName,
        categoryColor: r.categoryColor || FALLBACK_COLOR,
        total: Math.round(parseFloat(r.total) * 100) / 100,
        percentage:
          grandTotal > 0
            ? Math.round((parseFloat(r.total) / grandTotal) * 10000) / 100
            : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Phase 3: Daily Expense Trend (current month)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async getDailyExpenseTrend(
    userId: string,
    timezone = "Asia/Jakarta"
  ): Promise<DailyExpensePoint[]> {
    const now = new Date();
    const { start, end, year, month } = getJakartaMonthBounds(now, timezone);
    const tzOffsetMs = 7 * 60 * 60 * 1000;

    // Aggregate by calendar day in Jakarta timezone
    const rows = await db
      .select({
        dayNum: sql<string>`to_char(${transactions.transactionDate} + interval '7 hours', 'DD')`,
        total: sql<string>`coalesce(sum(${transactions.amount}), '0.00')`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "EXPENSE"),
          eq(transactions.status, "CONFIRMED"),
          gte(transactions.transactionDate, start),
          lte(transactions.transactionDate, end)
        )
      )
      .groupBy(
        sql`to_char(${transactions.transactionDate} + interval '7 hours', 'DD')`
      );

    const map: Record<number, number> = {};
    for (const row of rows) {
      map[parseInt(row.dayNum)] = parseFloat(row.total);
    }

    const totalDays = daysInMonth(year, month);
    const monthLabel = INDONESIAN_MONTHS[month - 1];

    // Suppress unused variable warning
    void tzOffsetMs;

    const result: DailyExpensePoint[] = [];
    for (let d = 1; d <= totalDays; d++) {
      result.push({
        day: d,
        label: `${d} ${monthLabel}`,
        expense: Math.round((map[d] || 0) * 100) / 100,
      });
    }
    return result;
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Phase 3: Account Balances Widget
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async getAccountBalances(
    userId: string
  ): Promise<AccountBalanceItem[]> {
    const activeAccounts = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.isActive, true)))
      .orderBy(accounts.createdAt);

    if (activeAccounts.length === 0) return [];

    // Single batch query for all balances
    const [incomeRows, expenseRows, transferInRows, transferOutRows] =
      await Promise.all([
        db
          .select({
            accountId: transactions.accountId,
            total: sql<string>`coalesce(sum(${transactions.amount}), '0.00')`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              eq(transactions.type, "INCOME"),
              eq(transactions.status, "CONFIRMED")
            )
          )
          .groupBy(transactions.accountId),

        db
          .select({
            accountId: transactions.accountId,
            total: sql<string>`coalesce(sum(${transactions.amount}), '0.00')`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              eq(transactions.type, "EXPENSE"),
              eq(transactions.status, "CONFIRMED")
            )
          )
          .groupBy(transactions.accountId),

        db
          .select({
            accountId: transfers.toAccountId,
            total: sql<string>`coalesce(sum(${transfers.amount}), '0.00')`,
          })
          .from(transfers)
          .where(eq(transfers.userId, userId))
          .groupBy(transfers.toAccountId),

        db
          .select({
            accountId: transfers.fromAccountId,
            total: sql<string>`coalesce(sum(${transfers.amount}), '0.00')`,
          })
          .from(transfers)
          .where(eq(transfers.userId, userId))
          .groupBy(transfers.fromAccountId),
      ]);

    // Build lookup maps
    const incomeMap = Object.fromEntries(
      incomeRows.map((r) => [r.accountId, parseFloat(r.total)])
    );
    const expenseMap = Object.fromEntries(
      expenseRows.map((r) => [r.accountId, parseFloat(r.total)])
    );
    const transferInMap = Object.fromEntries(
      transferInRows.map((r) => [r.accountId, parseFloat(r.total)])
    );
    const transferOutMap = Object.fromEntries(
      transferOutRows.map((r) => [r.accountId, parseFloat(r.total)])
    );

    return activeAccounts.map((acc) => {
      const balance =
        parseFloat(acc.initialBalance) +
        (incomeMap[acc.id] || 0) -
        (expenseMap[acc.id] || 0) +
        (transferInMap[acc.id] || 0) -
        (transferOutMap[acc.id] || 0);
      return {
        id: acc.id,
        name: acc.name,
        type: acc.type,
        currency: acc.currency,
        currentBalance: Math.round(balance * 100) / 100,
      };
    });
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Phase 3: Recent Transactions (8)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  static async getRecentTransactions(
    userId: string,
    limit = 8
  ): Promise<RecentTransaction[]> {
    return db
      .select({
        id: transactions.id,
        description: transactions.description,
        amount: transactions.amount,
        type: transactions.type,
        transactionDate: transactions.transactionDate,
        accountName: accounts.name,
        categoryName: categories.name,
        categoryColor: categories.color,
      })
      .from(transactions)
      .leftJoin(accounts, eq(transactions.accountId, accounts.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.transactionDate), desc(transactions.createdAt))
      .limit(limit);
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Private helpers
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Efficient total net worth calculation using a single set of aggregate queries
   * (4 queries instead of 4Ã—N per account).
   */
  private static async _calcTotalNetWorth(userId: string): Promise<number> {
    const activeAccounts = await db
      .select({
        id: accounts.id,
        initialBalance: accounts.initialBalance,
      })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.isActive, true)));

    if (activeAccounts.length === 0) return 0;

    const [incomeRows, expenseRows, transferInRows, transferOutRows] =
      await Promise.all([
        db
          .select({
            accountId: transactions.accountId,
            total: sql<string>`coalesce(sum(${transactions.amount}), '0.00')`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              eq(transactions.type, "INCOME"),
              eq(transactions.status, "CONFIRMED")
            )
          )
          .groupBy(transactions.accountId),

        db
          .select({
            accountId: transactions.accountId,
            total: sql<string>`coalesce(sum(${transactions.amount}), '0.00')`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              eq(transactions.type, "EXPENSE"),
              eq(transactions.status, "CONFIRMED")
            )
          )
          .groupBy(transactions.accountId),

        db
          .select({
            accountId: transfers.toAccountId,
            total: sql<string>`coalesce(sum(${transfers.amount}), '0.00')`,
          })
          .from(transfers)
          .where(eq(transfers.userId, userId))
          .groupBy(transfers.toAccountId),

        db
          .select({
            accountId: transfers.fromAccountId,
            total: sql<string>`coalesce(sum(${transfers.amount}), '0.00')`,
          })
          .from(transfers)
          .where(eq(transfers.userId, userId))
          .groupBy(transfers.fromAccountId),
      ]);

    const incomeMap = Object.fromEntries(
      incomeRows.map((r) => [r.accountId, parseFloat(r.total)])
    );
    const expenseMap = Object.fromEntries(
      expenseRows.map((r) => [r.accountId, parseFloat(r.total)])
    );
    const transferInMap = Object.fromEntries(
      transferInRows.map((r) => [r.accountId, parseFloat(r.total)])
    );
    const transferOutMap = Object.fromEntries(
      transferOutRows.map((r) => [r.accountId, parseFloat(r.total)])
    );

    let total = 0;
    for (const acc of activeAccounts) {
      total +=
        parseFloat(acc.initialBalance) +
        (incomeMap[acc.id] || 0) -
        (expenseMap[acc.id] || 0) +
        (transferInMap[acc.id] || 0) -
        (transferOutMap[acc.id] || 0);
    }
    return total;
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Period-aware: first transaction date
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Returns the earliest confirmed transaction date for the user,
   * adjusted to Jakarta midnight. Used for "Sejak pencatatan pertama".
   * Returns today (Jakarta) if the user has no transactions yet.
   */
  static async getFirstTransactionDate(userId: string): Promise<Date> {
    const tzOffsetMs = 7 * 60 * 60 * 1000;
    const [row] = await db
      .select({ earliest: sql<string>`min(${transactions.transactionDate})` })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.status, "CONFIRMED")
        )
      );

    if (!row?.earliest) {
      // No transactions â€” return start of today Jakarta
      const now = new Date();
      const jakartaMidnight = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          -7, 0, 0, 0
        )
      );
      return jakartaMidnight;
    }

    const earliest = new Date(row.earliest);
    // Floor to Jakarta-local day start (subtract offset, then floor to UTC day)
    const jakartaMs = earliest.getTime() + tzOffsetMs;
    const jakartaDayStart = Math.floor(jakartaMs / 86_400_000) * 86_400_000;
    return new Date(jakartaDayStart - tzOffsetMs);
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Period-aware KPIs: flexible date range
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Returns income, expense, net savings, and transaction count for any
   * arbitrary UTC-based date range [start, end].
   *
   * The caller is responsible for converting a user's chosen period into
   * UTC start/end boundaries. Jakarta-local boundaries are computed by
   * subtracting 7 h from the local-midnight equivalents.
   */
  static async getKPIsForPeriod(
    userId: string,
    start: Date,
    end: Date
  ): Promise<PeriodKPIs> {
    const [incomeRes, expenseRes, countRes] = await Promise.all([
      db
        .select({ total: sql<string>`coalesce(sum(${transactions.amount}), '0.00')` })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.type, "INCOME"),
            eq(transactions.status, "CONFIRMED"),
            gte(transactions.transactionDate, start),
            lte(transactions.transactionDate, end)
          )
        )
        .then((r) => r[0]),

      db
        .select({ total: sql<string>`coalesce(sum(${transactions.amount}), '0.00')` })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.type, "EXPENSE"),
            eq(transactions.status, "CONFIRMED"),
            gte(transactions.transactionDate, start),
            lte(transactions.transactionDate, end)
          )
        )
        .then((r) => r[0]),

      db
        .select({ count: sql<string>`count(*)` })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.status, "CONFIRMED"),
            gte(transactions.transactionDate, start),
            lte(transactions.transactionDate, end)
          )
        )
        .then((r) => r[0]),
    ]);

    const income = Math.round(parseFloat(incomeRes?.total || "0") * 100) / 100;
    const expense = Math.round(parseFloat(expenseRes?.total || "0") * 100) / 100;
    const count = parseInt(countRes?.count || "0");

    return {
      income,
      expense,
      net: Math.round((income - expense) * 100) / 100,
      transactionCount: count,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
    };
  }
}

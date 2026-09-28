/**
 * FINTRACK PHASE 8 — REPORTS / EXPORT TESTS
 *
 * Coverage:
 *  1.  Summary: total income
 *  2.  Summary: total expense
 *  3.  Summary: net cash flow
 *  4.  Summary: savings rate
 *  5.  Summary: zero income → savingsRate=0 (no NaN/Infinity)
 *  6.  Summary: transaction count
 *  7.  Summary: transfer count & total transfers
 *  8.  Transfer does NOT count as income
 *  9.  Transfer does NOT count as expense
 * 10.  Transfer does NOT alter net cash flow
 * 11.  Category breakdown: expense by category
 * 12.  Category breakdown: income by category
 * 13.  Category breakdown: percentage calculation
 * 14.  Category breakdown: zero-total → empty list, no NaN
 * 15.  Category breakdown: uncategorized transaction (null categoryId)
 * 16.  Account breakdown: income by account
 * 17.  Account breakdown: expense by account
 * 18.  Account breakdown: net per account
 * 19.  Time series: daily granularity
 * 20.  Time series: monthly granularity
 * 21.  Time series: income values
 * 22.  Time series: expense values
 * 23.  Time series: net values
 * 24.  Time series: zero-fill for empty days
 * 25.  Filter: startDate / endDate custom range
 * 26.  Filter: accountId scopes summary
 * 27.  Filter: categoryId scopes summary
 * 28.  Filter: type=INCOME
 * 29.  Filter: type=EXPENSE
 * 30.  Timezone: transaction at midnight Jakarta boundary is included in correct month
 * 31.  Timezone: transaction at UTC midnight (19:00 WIB prev day) is in correct Jakarta day
 * 32.  Timezone: this_month covers first and last day of Jakarta month
 * 33.  Timezone: year boundary — last day of year in Jakarta, not UTC
 * 34.  Timezone: leap year Feb 29 boundary
 * 35.  Security: User A report does NOT include User B transactions
 * 36.  Security: User B cannot use User A's accountId as filter (IDOR)
 * 37.  Security: User B cannot use User A's categoryId as filter (IDOR)
 * 38.  Security: User A and User B get different summaries for same preset
 * 39.  Export: CSV generation returns non-empty string
 * 40.  Export: CSV headers are correct (8 columns)
 * 41.  Export: CSV RFC-4180 escaping for commas in description
 * 42.  Export: CSV contains UTF-8 BOM
 * 43.  Export: CSV rows match transaction count
 * 44.  Export: CSV filename contains date range
 * 45.  Export: XLSX generation returns non-empty Buffer
 * 46.  Export: XLSX filename contains date range
 * 47.  Export: XLSX has 4 worksheets (Summary, Transactions, Category Breakdown, Account Breakdown)
 * 48.  Export: XLSX Summary sheet contains financial figures
 * 49.  Export: XLSX Transactions sheet matches transaction rows
 * 50.  Export: XLSX amounts are numeric (not string) in Transactions sheet
 * 51.  Export: XLSX Category Breakdown sheet present
 * 52.  Export: XLSX Account Breakdown sheet present
 * 53.  Financial correctness: Salary 7.5jt, Food 1jt, Transport 500rb → net 6jt
 * 54.  Financial correctness: Transfer 2jt does NOT change income/expense/net
 * 55.  Performance: getFinancialReport returns consistent data in parallel
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { db } from "@/lib/db";
import {
  user,
  accounts,
  categories,
  transactions,
  transfers,
} from "@/db/schema";
import { ReportService } from "@/services/report.service";
import {
  resolveReportPeriod,
  jakartaDateStringToUtc,
  jakartaDateStringToExclusiveUtcEnd,
} from "@/lib/utils/report-date";
import * as XLSX from "xlsx";
import { inArray, eq } from "drizzle-orm";

// ─── Assertion helpers ──────────────────────────────────────────────────────────

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function assertApprox(a: number, b: number, message: string, epsilon = 0.01): void {
  assert(Math.abs(a - b) <= epsilon, `${message} (got ${a}, expected ${b})`);
}

// ─── Test identifiers ──────────────────────────────────────────────────────────

const RUN_ID = Date.now();
const USER_A_ID = `p8_user_a_${RUN_ID}`;
const USER_B_ID = `p8_user_b_${RUN_ID}`;

// Shared state populated by setup()
let accountAId: string;    // BCA — User A
let accountA2Id: string;   // E-Wallet — User A (transfer target)
let accountBId: string;    // Mandiri — User B
let incomeCatId: string;   // system INCOME category (e.g. "Gaji")
let expenseCatId: string;  // system EXPENSE category (e.g. "Makanan & Minuman")
let expenseCat2Id: string; // second system EXPENSE category (e.g. "Transportasi")

// Dates used throughout: anchor month is 2026-09 (September) WIB
// 2026-09-15 10:00 WIB = 2026-09-15T03:00:00.000Z
const SEP_15_UTC = new Date("2026-09-15T03:00:00.000Z");
// 2026-09-20 10:00 WIB = 2026-09-20T03:00:00.000Z
const SEP_20_UTC = new Date("2026-09-20T03:00:00.000Z");
// (AUG_31_UTC removed — August boundary tested via filter in test 5)

// ─── Setup ────────────────────────────────────────────────────────────────────

async function setup() {
  // Create test users
  await db.insert(user).values([
    {
      id: USER_A_ID,
      name: "Report User A",
      email: `${USER_A_ID}@test.local`,
      currency: "IDR",
      timezone: "Asia/Jakarta",
    },
    {
      id: USER_B_ID,
      name: "Report User B",
      email: `${USER_B_ID}@test.local`,
      currency: "IDR",
      timezone: "Asia/Jakarta",
    },
  ]);

  // Create accounts
  const [accA] = await db
    .insert(accounts)
    .values({
      userId: USER_A_ID,
      name: "BCA User A",
      type: "BANK",
      initialBalance: "10000000.00",
      currency: "IDR",
      isActive: true,
    })
    .returning();
  accountAId = accA.id;

  const [accA2] = await db
    .insert(accounts)
    .values({
      userId: USER_A_ID,
      name: "E-Wallet User A",
      type: "E_WALLET",
      initialBalance: "0.00",
      currency: "IDR",
      isActive: true,
    })
    .returning();
  accountA2Id = accA2.id;

  const [accB] = await db
    .insert(accounts)
    .values({
      userId: USER_B_ID,
      name: "Mandiri User B",
      type: "BANK",
      initialBalance: "5000000.00",
      currency: "IDR",
      isActive: true,
    })
    .returning();
  accountBId = accB.id;

  // Pick system categories (isDefault = true, userId = null)
  const [cat1] = await db
    .select()
    .from(categories)
    .where(eq(categories.type, "INCOME"))
    .limit(1);
  incomeCatId = cat1.id;

  const expCats = await db
    .select()
    .from(categories)
    .where(eq(categories.type, "EXPENSE"))
    .limit(2);
  expenseCatId = expCats[0].id;
  expenseCat2Id = expCats[1]?.id ?? expCats[0].id;

  // User A transactions (September 2026):
  //   Income: Gaji = 7,500,000  (Sep 15)
  //   Expense: Food = 1,000,000 (Sep 15)
  //   Expense: Transport = 500,000 (Sep 20)
  // → Net = 6,000,000
  // Transfer: BCA → E-Wallet = 2,000,000 (Sep 20)

  await db.insert(transactions).values([
    {
      userId: USER_A_ID,
      accountId: accountAId,
      categoryId: incomeCatId,
      type: "INCOME",
      amount: "7500000.00",
      description: "Gaji September",
      transactionDate: SEP_15_UTC,
      source: "WEB",
      status: "CONFIRMED",
    },
    {
      userId: USER_A_ID,
      accountId: accountAId,
      categoryId: expenseCatId,
      type: "EXPENSE",
      amount: "1000000.00",
      description: "Makan siang, warung nasi",
      transactionDate: SEP_15_UTC,
      source: "WEB",
      status: "CONFIRMED",
    },
    {
      userId: USER_A_ID,
      accountId: accountAId,
      categoryId: expenseCat2Id,
      type: "EXPENSE",
      amount: "500000.00",
      description: "Ojek online",
      transactionDate: SEP_20_UTC,
      source: "WEB",
      status: "CONFIRMED",
    },
  ]);

  // Transfer — must not count as income or expense
  await db.insert(transfers).values({
    userId: USER_A_ID,
    fromAccountId: accountAId,
    toAccountId: accountA2Id,
    amount: "2000000.00",
    description: "Top up e-wallet",
    transferDate: SEP_20_UTC,
  });

  // User B — only has 1 income transaction in September
  await db.insert(transactions).values({
    userId: USER_B_ID,
    accountId: accountBId,
    categoryId: incomeCatId,
    type: "INCOME",
    amount: "3000000.00",
    description: "Gaji User B",
    transactionDate: SEP_15_UTC,
    source: "WEB",
    status: "CONFIRMED",
  });
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

async function cleanup() {
  try {
    const userIds = [USER_A_ID, USER_B_ID];
    await db.delete(transfers).where(inArray(transfers.userId, userIds));
    await db.delete(transactions).where(inArray(transactions.userId, userIds));
    await db.delete(accounts).where(inArray(accounts.userId, userIds));
    await db.delete(user).where(inArray(user.id, userIds));
  } catch (err) {
    console.error("Cleanup error:", err);
  }
}

// ─── Test Runner ──────────────────────────────────────────────────────────────

async function runPhase8Tests() {
  console.log("====================================================");
  console.log("        FINTRACK PHASE 8 — REPORTS / EXPORT TESTS  ");
  console.log("====================================================\n");

  await setup();

  let passCount = 0;
  let failCount = 0;
  const failures: string[] = [];

  async function test(num: number, name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ PASS [${num}]: ${name}`);
      passCount++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ✗ FAIL [${num}]: ${name}\n       → ${msg}`);
      failures.push(`[${num}] ${name}: ${msg}`);
      failCount++;
    }
  }

  // ─── Helper filter for September 2026 custom range ─────────────────────────
  const SEP_FILTER = {
    preset: "custom" as const,
    startDate: "2026-09-01",
    endDate: "2026-09-30",
  };

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 1 — SUMMARY
  // ──────────────────────────────────────────────────────────────────────────

  console.log("\n── Section 1: Summary ──");

  await test(1, "Summary: total income = 7,500,000", async () => {
    const report = await ReportService.getFinancialReport(USER_A_ID, SEP_FILTER);
    assertApprox(report.summary.totalIncome, 7500000, "totalIncome");
  });

  await test(2, "Summary: total expense = 1,500,000", async () => {
    const report = await ReportService.getFinancialReport(USER_A_ID, SEP_FILTER);
    assertApprox(report.summary.totalExpense, 1500000, "totalExpense");
  });

  await test(3, "Summary: net cash flow = 6,000,000", async () => {
    const report = await ReportService.getFinancialReport(USER_A_ID, SEP_FILTER);
    assertApprox(report.summary.netCashFlow, 6000000, "netCashFlow");
  });

  await test(4, "Summary: savings rate ≈ 80% ((7.5M-1.5M)/7.5M*100)", async () => {
    const report = await ReportService.getFinancialReport(USER_A_ID, SEP_FILTER);
    assertApprox(report.summary.savingsRate, 80.0, "savingsRate", 0.1);
  });

  await test(5, "Summary: zero income → savingsRate=0, not NaN/Infinity", async () => {
    // Use a period with NO transactions for User B (August)
    const augFilter = { preset: "custom" as const, startDate: "2026-08-01", endDate: "2026-08-31" };
    const report = await ReportService.getFinancialReport(USER_B_ID, augFilter);
    assert(report.summary.totalIncome === 0, "income must be 0");
    assert(!isNaN(report.summary.savingsRate), "savingsRate must not be NaN");
    assert(isFinite(report.summary.savingsRate), "savingsRate must not be Infinity");
    assert(report.summary.savingsRate === 0, "savingsRate must be 0 when income=0");
  });

  await test(6, "Summary: transaction count = 3 (for User A in September)", async () => {
    const report = await ReportService.getFinancialReport(USER_A_ID, SEP_FILTER);
    assert(report.summary.transactionCount === 3, `expected 3, got ${report.summary.transactionCount}`);
  });

  await test(7, "Summary: transfer count = 1, totalTransfers = 2,000,000", async () => {
    const report = await ReportService.getFinancialReport(USER_A_ID, SEP_FILTER);
    assert(report.summary.transfersCount === 1, `transfersCount expected 1, got ${report.summary.transfersCount}`);
    assertApprox(report.summary.totalTransfers, 2000000, "totalTransfers");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 2 — TRANSFER ISOLATION
  // ──────────────────────────────────────────────────────────────────────────

  console.log("\n── Section 2: Transfer Isolation ──");

  await test(8, "Transfer does NOT count as income", async () => {
    const report = await ReportService.getFinancialReport(USER_A_ID, SEP_FILTER);
    // income must be exactly 7,500,000 (only from INCOME transaction)
    assertApprox(report.summary.totalIncome, 7500000, "income must not include transfer");
  });

  await test(9, "Transfer does NOT count as expense", async () => {
    const report = await ReportService.getFinancialReport(USER_A_ID, SEP_FILTER);
    // expense must be exactly 1,500,000 (only from EXPENSE transactions)
    assertApprox(report.summary.totalExpense, 1500000, "expense must not include transfer");
  });

  await test(10, "Transfer does NOT alter net cash flow", async () => {
    const report = await ReportService.getFinancialReport(USER_A_ID, SEP_FILTER);
    assertApprox(report.summary.netCashFlow, 6000000, "net must be income-expense ignoring transfer");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 3 — CATEGORY BREAKDOWN
  // ──────────────────────────────────────────────────────────────────────────

  console.log("\n── Section 3: Category Breakdown ──");

  await test(11, "Category breakdown: expense categories present", async () => {
    const report = await ReportService.getFinancialReport(USER_A_ID, SEP_FILTER);
    assert(report.categoryBreakdown.expense.length > 0, "expense breakdown must not be empty");
  });

  await test(12, "Category breakdown: income categories present", async () => {
    const report = await ReportService.getFinancialReport(USER_A_ID, SEP_FILTER);
    assert(report.categoryBreakdown.income.length > 0, "income breakdown must not be empty");
  });

  await test(13, "Category breakdown: expense percentages sum ≈ 100%", async () => {
    const report = await ReportService.getFinancialReport(USER_A_ID, SEP_FILTER);
    const sum = report.categoryBreakdown.expense.reduce((s, c) => s + c.percentage, 0);
    // Allow floating-point rounding: sum should be within 0.5 of 100
    assert(Math.abs(sum - 100) < 1, `expense percentages sum ${sum} should be ~100`);
  });

  await test(14, "Category breakdown: zero-total → empty list, no NaN", async () => {
    const augFilter = { preset: "custom" as const, startDate: "2026-08-01", endDate: "2026-08-31" };
    const report = await ReportService.getFinancialReport(USER_B_ID, augFilter);
    assert(report.categoryBreakdown.expense.length === 0, "no expense breakdown for empty period");
    assert(report.categoryBreakdown.income.length === 0, "no income breakdown for empty period");
  });

  await test(15, "Category breakdown: uncategorized transaction → 'Tanpa Kategori'", async () => {
    // Insert a transaction with null categoryId
    const [uncatTx] = await db
      .insert(transactions)
      .values({
        userId: USER_A_ID,
        accountId: accountAId,
        categoryId: null,
        type: "EXPENSE",
        amount: "50000.00",
        description: "Mystery expense",
        transactionDate: SEP_15_UTC,
        source: "WEB",
        status: "CONFIRMED",
      })
      .returning();

    try {
      const report = await ReportService.getFinancialReport(USER_A_ID, SEP_FILTER);
      const uncatItem = report.categoryBreakdown.expense.find(
        (c) => c.categoryId === null || c.categoryName === "Tanpa Kategori"
      );
      assert(!!uncatItem, "uncategorized expense must appear as 'Tanpa Kategori'");
      assert(uncatItem!.categoryName === "Tanpa Kategori", "categoryName must be 'Tanpa Kategori'");
    } finally {
      // Cleanup this extra tx
      await db.delete(transactions).where(eq(transactions.id, uncatTx.id));
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 4 — ACCOUNT BREAKDOWN
  // ──────────────────────────────────────────────────────────────────────────

  console.log("\n── Section 4: Account Breakdown ──");

  await test(16, "Account breakdown: income by account is correct", async () => {
    const report = await ReportService.getFinancialReport(USER_A_ID, SEP_FILTER);
    const bcaAcc = report.accountBreakdown.find((a) => a.accountId === accountAId);
    assert(!!bcaAcc, "BCA account must appear in breakdown");
    assertApprox(bcaAcc!.income, 7500000, "BCA income must be 7,500,000");
  });

  await test(17, "Account breakdown: expense by account is correct", async () => {
    const report = await ReportService.getFinancialReport(USER_A_ID, SEP_FILTER);
    const bcaAcc = report.accountBreakdown.find((a) => a.accountId === accountAId);
    assert(!!bcaAcc, "BCA account must appear in breakdown");
    assertApprox(bcaAcc!.expense, 1500000, "BCA expense must be 1,500,000");
  });

  await test(18, "Account breakdown: net per account is correct", async () => {
    const report = await ReportService.getFinancialReport(USER_A_ID, SEP_FILTER);
    const bcaAcc = report.accountBreakdown.find((a) => a.accountId === accountAId);
    assert(!!bcaAcc, "BCA account must appear in breakdown");
    assertApprox(bcaAcc!.net, 6000000, "BCA net must be 6,000,000");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 5 — TIME SERIES
  // ──────────────────────────────────────────────────────────────────────────

  console.log("\n── Section 5: Time Series ──");

  await test(19, "Time series: daily granularity for ≤35 day range", async () => {
    const report = await ReportService.getFinancialReport(USER_A_ID, SEP_FILTER);
    assert(report.period.granularity === "daily", "September (30d) should be daily");
    assert(report.timeSeries.length === 30, `30 days expected, got ${report.timeSeries.length}`);
  });

  await test(20, "Time series: monthly granularity for >35 day range", async () => {
    const filter = { preset: "last_6_months" as const };
    const report = await ReportService.getFinancialReport(USER_A_ID, filter);
    assert(report.period.granularity === "monthly", "6 months should produce monthly granularity");
    assert(report.timeSeries.length >= 6, "should have at least 6 monthly points");
  });

  await test(21, "Time series: income on Sep 15 is 7,500,000", async () => {
    const report = await ReportService.getFinancialReport(USER_A_ID, SEP_FILTER);
    const sep15 = report.timeSeries.find((p) => p.date === "2026-09-15");
    assert(!!sep15, "Sep 15 must exist in time series");
    assertApprox(sep15!.income, 7500000, "Sep 15 income");
  });

  await test(22, "Time series: expense on Sep 15 is 1,000,000 and Sep 20 is 500,000", async () => {
    const report = await ReportService.getFinancialReport(USER_A_ID, SEP_FILTER);
    const sep15 = report.timeSeries.find((p) => p.date === "2026-09-15");
    const sep20 = report.timeSeries.find((p) => p.date === "2026-09-20");
    assert(!!sep15, "Sep 15 must exist");
    assert(!!sep20, "Sep 20 must exist");
    assertApprox(sep15!.expense, 1000000, "Sep 15 expense");
    assertApprox(sep20!.expense, 500000, "Sep 20 expense");
  });

  await test(23, "Time series: net on Sep 15 = 6,500,000 (7.5M - 1M)", async () => {
    const report = await ReportService.getFinancialReport(USER_A_ID, SEP_FILTER);
    const sep15 = report.timeSeries.find((p) => p.date === "2026-09-15");
    assert(!!sep15, "Sep 15 must exist");
    assertApprox(sep15!.net, 6500000, "Sep 15 net");
  });

  await test(24, "Time series: zero-fill — Sep 1 has income=0, expense=0", async () => {
    const report = await ReportService.getFinancialReport(USER_A_ID, SEP_FILTER);
    const sep1 = report.timeSeries.find((p) => p.date === "2026-09-01");
    assert(!!sep1, "Sep 1 must exist (zero-filled)");
    assert(sep1!.income === 0, "Sep 1 income must be 0");
    assert(sep1!.expense === 0, "Sep 1 expense must be 0");
    assert(sep1!.net === 0, "Sep 1 net must be 0");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 6 — FILTERS
  // ──────────────────────────────────────────────────────────────────────────

  console.log("\n── Section 6: Filters ──");

  await test(25, "Filter: custom startDate/endDate produces correct period", async () => {
    const filter = { preset: "custom" as const, startDate: "2026-09-01", endDate: "2026-09-14" };
    const report = await ReportService.getFinancialReport(USER_A_ID, filter);
    // Sep 15 income should NOT be included — only Sep 1–14
    assertApprox(report.summary.totalIncome, 0, "no income before Sep 15");
    assertApprox(report.summary.totalExpense, 0, "no expense before Sep 15");
  });

  await test(26, "Filter: accountId scopes summary to that account only", async () => {
    // E-Wallet has no transactions → income/expense = 0
    const filter = { ...SEP_FILTER, accountId: accountA2Id };
    const report = await ReportService.getFinancialReport(USER_A_ID, filter);
    assertApprox(report.summary.totalIncome, 0, "E-Wallet income must be 0");
    assertApprox(report.summary.totalExpense, 0, "E-Wallet expense must be 0");
  });

  await test(27, "Filter: categoryId scopes summary to that category only", async () => {
    const filter = { ...SEP_FILTER, categoryId: incomeCatId };
    const report = await ReportService.getFinancialReport(USER_A_ID, filter);
    // Only income transactions with this category
    assertApprox(report.summary.totalIncome, 7500000, "income category filter");
    assertApprox(report.summary.totalExpense, 0, "expense must be 0 when filtering on income cat");
  });

  await test(28, "Filter: type=INCOME returns only income", async () => {
    const filter = { ...SEP_FILTER, type: "INCOME" as const };
    const report = await ReportService.getFinancialReport(USER_A_ID, filter);
    assertApprox(report.summary.totalIncome, 7500000, "filtered income");
    assertApprox(report.summary.totalExpense, 0, "expense must be 0 when type=INCOME");
  });

  await test(29, "Filter: type=EXPENSE returns only expense", async () => {
    const filter = { ...SEP_FILTER, type: "EXPENSE" as const };
    const report = await ReportService.getFinancialReport(USER_A_ID, filter);
    assertApprox(report.summary.totalIncome, 0, "income must be 0 when type=EXPENSE");
    assertApprox(report.summary.totalExpense, 1500000, "filtered expense");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 7 — TIMEZONE
  // ──────────────────────────────────────────────────────────────────────────

  console.log("\n── Section 7: Timezone ──");

  await test(30, "Timezone: transaction at 00:00 WIB Sep 1 falls in September report", async () => {
    // 2026-09-01 00:00 WIB = 2026-08-31T17:00:00.000Z
    const midnightSep1Wib = new Date("2026-08-31T17:00:00.000Z");
    const [tz30tx] = await db
      .insert(transactions)
      .values({
        userId: USER_A_ID,
        accountId: accountAId,
        categoryId: incomeCatId,
        type: "INCOME",
        amount: "100000.00",
        description: "Midnight Sep 1 WIB",
        transactionDate: midnightSep1Wib,
        source: "WEB",
        status: "CONFIRMED",
      })
      .returning();

    try {
      const report = await ReportService.getFinancialReport(USER_A_ID, SEP_FILTER);
      // This transaction should be included (it is Sep 1 in Jakarta)
      // income should be 7,500,000 + 100,000 = 7,600,000
      assertApprox(report.summary.totalIncome, 7600000, "midnight Sep 1 WIB must be in September");
    } finally {
      await db.delete(transactions).where(eq(transactions.id, tz30tx.id));
    }
  });

  await test(31, "Timezone: transaction at 2026-08-31T17:00:00Z = Sep 1 00:00 WIB", async () => {
    // Same as above — verify the UTC→Jakarta conversion logic
    const utcTs = new Date("2026-08-31T17:00:00.000Z");
    const startUtc = jakartaDateStringToUtc("2026-09-01");
    const endExcUtc = jakartaDateStringToExclusiveUtcEnd("2026-09-30");
    assert(utcTs >= startUtc, "2026-08-31T17:00Z must be >= Sep 1 midnight Jakarta (in UTC)");
    assert(utcTs < endExcUtc, "2026-08-31T17:00Z must be < Sep 30 midnight Jakarta exclusive");
  });

  await test(32, "Timezone: this_month covers first and last Jakarta day of current month", async () => {
    const period = resolveReportPeriod({ preset: "this_month" });
    // startUtc should be midnight of day 1 of current Jakarta month
    // endExclusiveUtc should be midnight of day 1 of next Jakarta month
    assert(period.startDate.endsWith("-01"), "startDate must be day 1");
    assert(period.startUtc < period.endExclusiveUtc, "startUtc must be before endExclusiveUtc");
    // Check offset: startUtc + 7h = Jakarta midnight
    const jakartaStart = new Date(period.startUtc.getTime() + 7 * 60 * 60 * 1000);
    assert(jakartaStart.getUTCHours() === 0 && jakartaStart.getUTCMinutes() === 0,
      `startUtc must translate to midnight WIB, got ${jakartaStart.toISOString()}`);
  });

  await test(33, "Timezone: year boundary — last day of year in Jakarta, not UTC", async () => {
    const filter = { preset: "custom" as const, startDate: "2025-12-31", endDate: "2025-12-31" };
    const period = resolveReportPeriod(filter);
    // endExclusiveUtc should be 2026-01-01 00:00 Jakarta = 2025-12-31T17:00:00Z
    const expected = new Date("2025-12-31T17:00:00.000Z");
    assert(
      period.endExclusiveUtc.getTime() === expected.getTime(),
      `endExclusiveUtc for Dec 31 must be 2025-12-31T17:00:00Z, got ${period.endExclusiveUtc.toISOString()}`
    );
  });

  await test(34, "Timezone: leap year Feb 29 boundary", async () => {
    const filter = { preset: "custom" as const, startDate: "2028-02-29", endDate: "2028-02-29" };
    const period = resolveReportPeriod(filter);
    // 2028 is a leap year — Feb 29 exists
    assert(period.startDate === "2028-02-29", "startDate must be Feb 29");
    assert(period.endDate === "2028-02-29", "endDate must be Feb 29");
    // startUtc: 2028-02-29 00:00 WIB = 2028-02-28T17:00:00Z
    const expStart = new Date("2028-02-28T17:00:00.000Z");
    assert(
      period.startUtc.getTime() === expStart.getTime(),
      `startUtc must be ${expStart.toISOString()}, got ${period.startUtc.toISOString()}`
    );
    // endExclusiveUtc: 2028-03-01 00:00 WIB = 2028-02-29T17:00:00Z
    const expEnd = new Date("2028-02-29T17:00:00.000Z");
    assert(
      period.endExclusiveUtc.getTime() === expEnd.getTime(),
      `endExclusiveUtc must be ${expEnd.toISOString()}, got ${period.endExclusiveUtc.toISOString()}`
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 8 — SECURITY / ISOLATION
  // ──────────────────────────────────────────────────────────────────────────

  console.log("\n── Section 8: Security / User Isolation ──");

  await test(35, "Security: User A report does NOT include User B transactions", async () => {
    const reportA = await ReportService.getFinancialReport(USER_A_ID, SEP_FILTER);
    // User A income = 7,500,000; User B income = 3,000,000
    // If isolation broken, income would be 10,500,000
    assertApprox(reportA.summary.totalIncome, 7500000, "User A income must not include User B's 3M");
  });

  await test(36, "Security: User B cannot use User A's accountId as filter (IDOR)", async () => {
    let threw = false;
    try {
      await ReportService.getFinancialReport(USER_B_ID, {
        ...SEP_FILTER,
        accountId: accountAId, // User A's account
      });
    } catch (err: unknown) {
      threw = true;
      const msg = err instanceof Error ? err.message : String(err);
      assert(
        msg.includes("tidak ditemukan") || msg.includes("bukan milik"),
        `IDOR should throw ownership error, got: ${msg}`
      );
    }
    assert(threw, "IDOR: should throw when User B uses User A's accountId");
  });

  await test(37, "Security: User B cannot use User A's categoryId as filter (IDOR)", async () => {
    // User A's custom category — create one first
    const [customCat] = await db
      .insert(categories)
      .values({
        userId: USER_A_ID,
        name: "Custom Cat A",
        type: "EXPENSE",
        isDefault: false,
      })
      .returning();

    let threw = false;
    try {
      await ReportService.getFinancialReport(USER_B_ID, {
        ...SEP_FILTER,
        categoryId: customCat.id,
      });
    } catch (err: unknown) {
      threw = true;
      const msg = err instanceof Error ? err.message : String(err);
      assert(
        msg.includes("tidak ditemukan") || msg.includes("bukan milik"),
        `IDOR should throw ownership error, got: ${msg}`
      );
    } finally {
      await db.delete(categories).where(eq(categories.id, customCat.id));
    }
    assert(threw, "IDOR: should throw when User B uses User A's custom category");
  });

  await test(38, "Security: User A and User B get different summaries for same preset", async () => {
    const reportA = await ReportService.getFinancialReport(USER_A_ID, SEP_FILTER);
    const reportB = await ReportService.getFinancialReport(USER_B_ID, SEP_FILTER);
    assert(
      reportA.summary.totalIncome !== reportB.summary.totalIncome,
      "User A and B incomes must differ (A=7.5M, B=3M)"
    );
    assertApprox(reportA.summary.totalIncome, 7500000, "User A income");
    assertApprox(reportB.summary.totalIncome, 3000000, "User B income");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 9 — EXPORT (CSV)
  // ──────────────────────────────────────────────────────────────────────────

  console.log("\n── Section 9: CSV Export ──");

  await test(39, "Export CSV: generates non-empty string", async () => {
    const { csvContent } = await ReportService.exportToCsv(USER_A_ID, SEP_FILTER);
    assert(csvContent.length > 0, "csvContent must not be empty");
  });

  await test(40, "Export CSV: has correct 8 column headers", async () => {
    const { csvContent } = await ReportService.exportToCsv(USER_A_ID, SEP_FILTER);
    const lines = csvContent.replace(/^\uFEFF/, "").split("\r\n");
    const header = lines[0];
    const cols = header.split(",");
    assert(cols.length === 8, `Expected 8 columns, got ${cols.length}: ${header}`);
    assert(cols.includes("Tanggal (WIB)"), "Must include Tanggal (WIB)");
    assert(cols.includes("Tipe"), "Must include Tipe");
    assert(cols.includes("Deskripsi"), "Must include Deskripsi");
    assert(cols.includes("Kategori"), "Must include Kategori");
    assert(cols.includes("Akun"), "Must include Akun");
    assert(cols.includes("Nominal (Rp)"), "Must include Nominal (Rp)");
    assert(cols.includes("Sumber"), "Must include Sumber");
    assert(cols.includes("Status"), "Must include Status");
  });

  await test(41, "Export CSV: RFC-4180 escaping for commas in description", async () => {
    const { csvContent } = await ReportService.exportToCsv(USER_A_ID, SEP_FILTER);
    // "Makan siang, warung nasi" has a comma → must be quoted
    assert(
      csvContent.includes('"Makan siang, warung nasi"'),
      "Description with comma must be quoted in CSV"
    );
  });

  await test(42, "Export CSV: starts with UTF-8 BOM (\\uFEFF)", async () => {
    const { csvContent } = await ReportService.exportToCsv(USER_A_ID, SEP_FILTER);
    assert(csvContent.startsWith("\uFEFF"), "CSV must start with UTF-8 BOM");
  });

  await test(43, "Export CSV: data rows count matches transaction count", async () => {
    const { csvContent } = await ReportService.exportToCsv(USER_A_ID, SEP_FILTER);
    // Strip BOM then split by CRLF
    const lines = csvContent.replace(/^\uFEFF/, "").split("\r\n").filter((l) => l.length > 0);
    // 1 header + 3 data rows
    assert(lines.length === 4, `Expected 4 lines (1 header + 3 data), got ${lines.length}`);
  });

  await test(44, "Export CSV: filename contains date range", async () => {
    const { filename } = await ReportService.exportToCsv(USER_A_ID, SEP_FILTER);
    assert(filename.includes("2026-09-01"), `Filename must include start date: ${filename}`);
    assert(filename.includes("2026-09-30"), `Filename must include end date: ${filename}`);
    assert(filename.endsWith(".csv"), `Filename must end with .csv: ${filename}`);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 10 — EXPORT (XLSX)
  // ──────────────────────────────────────────────────────────────────────────

  console.log("\n── Section 10: XLSX Export ──");

  await test(45, "Export XLSX: generates non-empty Buffer", async () => {
    const { buffer } = await ReportService.exportToXlsx(USER_A_ID, SEP_FILTER);
    assert(Buffer.isBuffer(buffer), "must return a Buffer");
    assert(buffer.length > 0, "buffer must not be empty");
  });

  await test(46, "Export XLSX: filename contains date range", async () => {
    const { filename } = await ReportService.exportToXlsx(USER_A_ID, SEP_FILTER);
    assert(filename.includes("2026-09-01"), `Filename must include start date: ${filename}`);
    assert(filename.includes("2026-09-30"), `Filename must include end date: ${filename}`);
    assert(filename.endsWith(".xlsx"), `Filename must end with .xlsx: ${filename}`);
  });

  await test(47, "Export XLSX: workbook has exactly 4 sheets", async () => {
    const { buffer } = await ReportService.exportToXlsx(USER_A_ID, SEP_FILTER);
    const wb = XLSX.read(buffer, { type: "buffer" });
    assert(wb.SheetNames.length === 4, `Expected 4 sheets, got ${wb.SheetNames.length}: ${wb.SheetNames.join(", ")}`);
  });

  await test(48, "Export XLSX: Summary sheet contains totalIncome figure", async () => {
    const { buffer } = await ReportService.exportToXlsx(USER_A_ID, SEP_FILTER);
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets["Summary"];
    assert(!!ws, "Summary sheet must exist");
    const data = XLSX.utils.sheet_to_json<unknown>(ws, { header: 1 }) as unknown[][];
    const flat = data.flat();
    // 7500000 must appear somewhere in the summary
    const found = flat.some((cell) => cell === 7500000 || String(cell) === "7500000");
    assert(found, `7500000 (totalIncome) must appear in Summary sheet. Found: ${JSON.stringify(flat)}`);
  });

  await test(49, "Export XLSX: Transactions sheet has 3 data rows", async () => {
    const { buffer } = await ReportService.exportToXlsx(USER_A_ID, SEP_FILTER);
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets["Transactions"];
    assert(!!ws, "Transactions sheet must exist");
    const rows = XLSX.utils.sheet_to_json(ws);
    assert(rows.length === 3, `Expected 3 transaction rows, got ${rows.length}`);
  });

  await test(50, "Export XLSX: transaction amounts are numeric in Transactions sheet", async () => {
    const { buffer } = await ReportService.exportToXlsx(USER_A_ID, SEP_FILTER);
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets["Transactions"];
    assert(!!ws, "Transactions sheet must exist");
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
    // "Nominal (IDR)" column should be a number
    for (const row of rows) {
      const amount = row["Nominal (IDR)"];
      assert(typeof amount === "number", `Amount must be numeric, got ${typeof amount}: ${amount}`);
    }
  });

  await test(51, "Export XLSX: Category Breakdown sheet exists and has data", async () => {
    const { buffer } = await ReportService.exportToXlsx(USER_A_ID, SEP_FILTER);
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets["Category Breakdown"];
    assert(!!ws, "Category Breakdown sheet must exist");
    const rows = XLSX.utils.sheet_to_json(ws);
    assert(rows.length > 0, "Category Breakdown must have data rows");
  });

  await test(52, "Export XLSX: Account Breakdown sheet exists and has data", async () => {
    const { buffer } = await ReportService.exportToXlsx(USER_A_ID, SEP_FILTER);
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets["Account Breakdown"];
    assert(!!ws, "Account Breakdown sheet must exist");
    const rows = XLSX.utils.sheet_to_json(ws);
    assert(rows.length > 0, "Account Breakdown must have data rows");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 11 — FINANCIAL CORRECTNESS (Reference scenario)
  // ──────────────────────────────────────────────────────────────────────────

  console.log("\n── Section 11: Financial Correctness (Reference Scenario) ──");

  await test(53, "Financial correctness: Income 7.5M, Expense 1.5M → Net 6M", async () => {
    const report = await ReportService.getFinancialReport(USER_A_ID, SEP_FILTER);
    assertApprox(report.summary.totalIncome, 7500000, "Salary=7.5M");
    assertApprox(report.summary.totalExpense, 1500000, "Food(1M)+Transport(500K)=1.5M");
    assertApprox(report.summary.netCashFlow, 6000000, "Net=7.5M-1.5M=6M");
  });

  await test(54, "Financial correctness: Transfer 2M does NOT change income/expense/net", async () => {
    const report = await ReportService.getFinancialReport(USER_A_ID, SEP_FILTER);
    // Transfer is shown separately — should not contaminate income/expense/net
    assertApprox(report.summary.totalIncome, 7500000, "income unchanged by transfer");
    assertApprox(report.summary.totalExpense, 1500000, "expense unchanged by transfer");
    assertApprox(report.summary.netCashFlow, 6000000, "net unchanged by transfer");
    assertApprox(report.summary.totalTransfers, 2000000, "transfer tracked separately");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 12 — CONSISTENCY / PERFORMANCE
  // ──────────────────────────────────────────────────────────────────────────

  console.log("\n── Section 12: Consistency ──");

  await test(55, "Consistency: parallel calls return identical results", async () => {
    const [r1, r2, r3] = await Promise.all([
      ReportService.getFinancialReport(USER_A_ID, SEP_FILTER),
      ReportService.getFinancialReport(USER_A_ID, SEP_FILTER),
      ReportService.getFinancialReport(USER_A_ID, SEP_FILTER),
    ]);
    assertApprox(r1.summary.totalIncome, r2.summary.totalIncome, "parallel r1 vs r2 income");
    assertApprox(r2.summary.totalIncome, r3.summary.totalIncome, "parallel r2 vs r3 income");
    assertApprox(r1.summary.netCashFlow, r3.summary.netCashFlow, "parallel r1 vs r3 net");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────────────────────────────

  console.log("\n====================================================");
  console.log(`  RESULTS: ${passCount} PASS / ${failCount} FAIL`);
  if (failures.length > 0) {
    console.log("\n  FAILURES:");
    failures.forEach((f) => console.log(`    - ${f}`));
  }
  console.log("====================================================\n");

  await cleanup();

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase8Tests().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});

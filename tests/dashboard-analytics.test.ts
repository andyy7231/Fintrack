import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { db } from "@/lib/db";
import { user, accounts, categories, transactions, transfers } from "@/db/schema";
import { AccountService } from "@/services/account.service";
import { CategoryService } from "@/services/category.service";
import { TransactionService } from "@/services/transaction.service";
import { TransferService } from "@/services/transfer.service";
import { DashboardService } from "@/services/dashboard.service";
import { eq } from "drizzle-orm";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function assertAlmostEqual(actual: number, expected: number, label: string, tolerance = 0.01) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

/**
 * Build a Date at the given Jakarta local date/time, stored as UTC.
 * Jakarta is UTC+7, so subtract 7 hours.
 */
function jakartaDate(year: number, month: number, day: number, hour = 12): Date {
  return new Date(Date.UTC(year, month - 1, day, hour - 7, 0, 0, 0));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runTests() {
  console.log("====================================================");
  console.log("    FINTRACK PHASE 3 — DASHBOARD ANALYTICS TESTS    ");
  console.log("====================================================");

  const ts = Date.now();
  const userAId = `p3_user_a_${ts}`;
  const userBId = `p3_user_b_${ts}`;

  await db.insert(user).values([
    {
      id: userAId,
      name: "Phase3 User A",
      email: `${userAId}@test.com`,
      currency: "IDR",
      timezone: "Asia/Jakarta",
    },
    {
      id: userBId,
      name: "Phase3 User B",
      email: `${userBId}@test.com`,
      currency: "IDR",
      timezone: "Asia/Jakarta",
    },
  ]);

  try {
    // ─── Setup common data ───────────────────────────────────────────────────
    const allCats = await CategoryService.getCategories(userAId);
    const salaryCat = allCats.find((c) => c.name === "Gaji")!;
    const foodCat = allCats.find((c) => c.name === "Makanan & Minuman")!;

    // User A accounts
    const cashAcc = await AccountService.createAccount(userAId, {
      name: "Cash P3",
      type: "CASH",
      initialBalance: "1000000.00",
      currency: "IDR",
    });
    const bcaAcc = await AccountService.createAccount(userAId, {
      name: "BCA P3",
      type: "BANK",
      initialBalance: "2000000.00",
      currency: "IDR",
    });

    // ── TEST 1: KPI Accuracy ─────────────────────────────────────────────────
    console.log("\n[TEST 1] KPI Accuracy...");

    const now = new Date();
    const jakartaYear = parseInt(
      new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", year: "numeric" })
        .format(now)
    );
    const jakartaMonth = parseInt(
      new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", month: "numeric" })
        .format(now)
    );

    // Income: 3,000,000 (in current month Jakarta)
    await TransactionService.createTransaction(userAId, {
      accountId: cashAcc.id,
      categoryId: salaryCat.id,
      type: "INCOME",
      amount: "3000000.00",
      description: "Gaji September",
      transactionDate: jakartaDate(jakartaYear, jakartaMonth, 5),
    });

    // Expense: 1,200,000 (in current month Jakarta)
    await TransactionService.createTransaction(userAId, {
      accountId: cashAcc.id,
      categoryId: foodCat.id,
      type: "EXPENSE",
      amount: "1200000.00",
      description: "Belanja bulanan",
      transactionDate: jakartaDate(jakartaYear, jakartaMonth, 10),
    });

    // Transfer: 500,000 (must NOT affect income/expense)
    await TransferService.createTransfer(userAId, {
      fromAccountId: cashAcc.id,
      toAccountId: bcaAcc.id,
      amount: "500000.00",
      description: "Top-up BCA",
      transferDate: jakartaDate(jakartaYear, jakartaMonth, 12),
    });

    const kpis = await DashboardService.getKPIs(userAId);

    assertAlmostEqual(kpis.incomeThisMonth, 3_000_000, "KPI: income");
    assertAlmostEqual(kpis.expenseThisMonth, 1_200_000, "KPI: expense");
    assertAlmostEqual(kpis.netSavings, 1_800_000, "KPI: netSavings");
    assertAlmostEqual(
      kpis.savingRate,
      (1_800_000 / 3_000_000) * 100,
      "KPI: savingRate"
    );
    // totalNetWorth: 1M + 3M - 1.2M + 2M = 4.8M
    // (cash: 1M init + 3M income - 1.2M expense - 500k transfer-out = 2.3M)
    // (bca: 2M init + 500k transfer-in = 2.5M)
    assertAlmostEqual(kpis.totalNetWorth, 4_800_000, "KPI: totalNetWorth");

    console.log("✓ PASS: incomeThisMonth =", kpis.incomeThisMonth);
    console.log("✓ PASS: expenseThisMonth =", kpis.expenseThisMonth);
    console.log("✓ PASS: netSavings =", kpis.netSavings);
    console.log("✓ PASS: savingRate =", kpis.savingRate.toFixed(2) + "%");
    console.log("✓ PASS: totalNetWorth =", kpis.totalNetWorth);

    // ── TEST 2: Monthly Trend (6 calendar months) ────────────────────────────
    console.log("\n[TEST 2] Monthly Trend — 6 calendar months...");

    const trend = await DashboardService.getMonthlyTrend(userAId);

    assert(trend.length === 6, `Expected 6 months, got ${trend.length}`);

    // Current month should have income=3M, expense=1.2M
    const currentMonthKey = `${jakartaYear}-${String(jakartaMonth).padStart(2, "0")}`;
    const currentMonthData = trend.find((t) => t.monthKey === currentMonthKey);
    assert(!!currentMonthData, `Current month key ${currentMonthKey} missing`);
    assertAlmostEqual(currentMonthData!.income, 3_000_000, "Trend: current month income");
    assertAlmostEqual(currentMonthData!.expense, 1_200_000, "Trend: current month expense");

    // Previous months should be zero for this user (no transactions planted there)
    const prevMonths = trend.filter((t) => t.monthKey !== currentMonthKey);
    for (const m of prevMonths) {
      assert(m.income === 0, `Prev month ${m.monthKey} income should be 0, got ${m.income}`);
      assert(m.expense === 0, `Prev month ${m.monthKey} expense should be 0, got ${m.expense}`);
    }

    console.log("✓ PASS: Exactly 6 months returned");
    console.log("✓ PASS: Current month income/expense correct");
    console.log("✓ PASS: Empty months return zero");
    console.log("  Months:", trend.map((t) => `${t.label}: +${t.income}/-${t.expense}`).join(", "));

    // ── TEST 3: Category Breakdown ───────────────────────────────────────────
    console.log("\n[TEST 3] Expense by Category...");

    // Add another expense in same category
    await TransactionService.createTransaction(userAId, {
      accountId: cashAcc.id,
      categoryId: foodCat.id,
      type: "EXPENSE",
      amount: "300000.00",
      description: "Makan malam",
      transactionDate: jakartaDate(jakartaYear, jakartaMonth, 15),
    });

    // Add uncategorized expense
    await TransactionService.createTransaction(userAId, {
      accountId: cashAcc.id,
      categoryId: undefined, // null
      type: "EXPENSE",
      amount: "50000.00",
      description: "Parkir (tanpa kategori)",
      transactionDate: jakartaDate(jakartaYear, jakartaMonth, 16),
    });

    const catBreakdown = await DashboardService.getExpenseByCategory(userAId);
    assert(catBreakdown.length >= 2, "Expected at least 2 category groups");

    // Food: 1.2M + 300k = 1.5M
    const foodGroup = catBreakdown.find((c) => c.categoryName === "Makanan & Minuman");
    assert(!!foodGroup, "Makanan & Minuman category missing");
    assertAlmostEqual(foodGroup!.total, 1_500_000, "Category: food total");

    // Uncategorized: 50k
    const uncatGroup = catBreakdown.find((c) => c.categoryName === "Tanpa Kategori");
    assert(!!uncatGroup, "Tanpa Kategori group missing");
    assertAlmostEqual(uncatGroup!.total, 50_000, "Category: uncategorized total");

    // Percentages must sum to ~100
    const totalPct = catBreakdown.reduce((acc, c) => acc + c.percentage, 0);
    assert(Math.abs(totalPct - 100) < 1, `Percentages sum to ${totalPct}, expected ~100`);

    console.log("✓ PASS: Makanan & Minuman aggregated correctly:", foodGroup!.total);
    console.log("✓ PASS: Tanpa Kategori present:", uncatGroup!.total);
    console.log("✓ PASS: Percentages sum to ~100%:", totalPct.toFixed(1) + "%");

    // ── TEST 4: Daily Expense Trend ──────────────────────────────────────────
    console.log("\n[TEST 4] Daily Expense Trend...");

    const daily = await DashboardService.getDailyExpenseTrend(userAId);

    // Must include every day of current month
    const expectedDays = new Date(jakartaYear, jakartaMonth, 0).getDate();
    assert(
      daily.length === expectedDays,
      `Expected ${expectedDays} days, got ${daily.length}`
    );

    // Day 10 should have 1.2M (first food expense)
    const day10 = daily.find((d) => d.day === 10);
    assertAlmostEqual(day10!.expense, 1_200_000, "Daily: day 10 expense");

    // Day 15 should have 300k
    const day15 = daily.find((d) => d.day === 15);
    assertAlmostEqual(day15!.expense, 300_000, "Daily: day 15 expense");

    // Day 16 should have 50k
    const day16 = daily.find((d) => d.day === 16);
    assertAlmostEqual(day16!.expense, 50_000, "Daily: day 16 expense");

    // Day 1 should be zero (no expense)
    const day1 = daily.find((d) => d.day === 1);
    assertAlmostEqual(day1!.expense, 0, "Daily: day 1 expense (empty day)");

    console.log(`✓ PASS: ${expectedDays} daily points returned`);
    console.log("✓ PASS: Day 10 expense =", day10!.expense);
    console.log("✓ PASS: Day 15 expense =", day15!.expense);
    console.log("✓ PASS: Day 16 (uncategorized) expense =", day16!.expense);
    console.log("✓ PASS: Day 1 (empty day) = 0");

    // ── TEST 5: Transfer Exclusion ───────────────────────────────────────────
    console.log("\n[TEST 5] Transfer Exclusion from Charts & KPIs...");

    // KPI already computed above — the transfer (500k) must not affect income/expense
    // Income must still be 3M (not 3.5M), expense must be 1.5M+50k = 1.55M
    const kpis2 = await DashboardService.getKPIs(userAId);
    assertAlmostEqual(kpis2.incomeThisMonth, 3_000_000, "Transfer exclusion: income unchanged");
    assertAlmostEqual(kpis2.expenseThisMonth, 1_550_000, "Transfer exclusion: expense (1.2M+300k+50k)");

    // Monthly trend must exclude transfers
    const trend2 = await DashboardService.getMonthlyTrend(userAId);
    const cur = trend2.find((t) => t.monthKey === currentMonthKey)!;
    assertAlmostEqual(cur.income, 3_000_000, "Trend: income not inflated by transfer");
    assertAlmostEqual(cur.expense, 1_550_000, "Trend: expense not inflated by transfer");

    console.log("✓ PASS: Transfer NOT counted as income in KPIs");
    console.log("✓ PASS: Transfer NOT counted as expense in KPIs");
    console.log("✓ PASS: Transfer NOT counted in monthly trend");

    // ── TEST 6: User Isolation ───────────────────────────────────────────────
    console.log("\n[TEST 6] User Isolation (IDOR protection)...");

    // User B has no transactions
    const kpisB = await DashboardService.getKPIs(userBId);
    assert(kpisB.incomeThisMonth === 0, "User B income must be 0");
    assert(kpisB.expenseThisMonth === 0, "User B expense must be 0");
    assert(kpisB.totalNetWorth === 0, "User B net worth must be 0 (no accounts)");

    const trendB = await DashboardService.getMonthlyTrend(userBId);
    assert(trendB.length === 6, "User B trend must have 6 months");
    assert(
      trendB.every((m) => m.income === 0 && m.expense === 0),
      "User B trend must be all zeros"
    );

    const catB = await DashboardService.getExpenseByCategory(userBId);
    assert(catB.length === 0, "User B category breakdown must be empty");

    const dailyB = await DashboardService.getDailyExpenseTrend(userBId);
    assert(dailyB.every((d) => d.expense === 0), "User B daily trend must be all zeros");

    console.log("✓ PASS: User B KPIs all zero (no data bleed from User A)");
    console.log("✓ PASS: User B trend all zeros");
    console.log("✓ PASS: User B category breakdown empty");
    console.log("✓ PASS: User B daily trend all zeros");

    // ── TEST 7: Zero Income Handling ─────────────────────────────────────────
    console.log("\n[TEST 7] Zero-income edge case...");

    const zeroUserIdBase = `p3_zero_${ts}`;
    await db.insert(user).values({
      id: zeroUserIdBase,
      name: "Zero Income User",
      email: `${zeroUserIdBase}@test.com`,
      currency: "IDR",
      timezone: "Asia/Jakarta",
    });

    try {
      const kpisZero = await DashboardService.getKPIs(zeroUserIdBase);
      assert(!isNaN(kpisZero.savingRate), "Saving rate must not be NaN");
      assert(isFinite(kpisZero.savingRate), "Saving rate must not be Infinity");
      assert(kpisZero.savingRate === 0, `Saving rate must be 0 when income=0, got ${kpisZero.savingRate}`);
      console.log("✓ PASS: savingRate = 0 when income = 0 (no NaN, no Infinity)");
    } finally {
      await db.delete(user).where(eq(user.id, zeroUserIdBase));
    }

    // ── TEST 8: Negative Savings ─────────────────────────────────────────────
    console.log("\n[TEST 8] Negative savings (expense > income)...");

    const negUserIdBase = `p3_neg_${ts}`;
    await db.insert(user).values({
      id: negUserIdBase,
      name: "Negative Saver",
      email: `${negUserIdBase}@test.com`,
      currency: "IDR",
      timezone: "Asia/Jakarta",
    });

    try {
      const negAcc = await AccountService.createAccount(negUserIdBase, {
        name: "Neg Cash",
        type: "CASH",
        initialBalance: "5000000.00",
        currency: "IDR",
      });
      const negCats = await CategoryService.getCategories(negUserIdBase);
      const negSalary = negCats.find((c) => c.name === "Gaji")!;
      const negFood = negCats.find((c) => c.name === "Makanan & Minuman")!;

      await TransactionService.createTransaction(negUserIdBase, {
        accountId: negAcc.id,
        categoryId: negSalary.id,
        type: "INCOME",
        amount: "1000000.00",
        description: "Freelance kecil",
        transactionDate: jakartaDate(jakartaYear, jakartaMonth, 3),
      });
      await TransactionService.createTransaction(negUserIdBase, {
        accountId: negAcc.id,
        categoryId: negFood.id,
        type: "EXPENSE",
        amount: "1200000.00",
        description: "Makan besar-besaran",
        transactionDate: jakartaDate(jakartaYear, jakartaMonth, 5),
      });

      const kpisNeg = await DashboardService.getKPIs(negUserIdBase);
      assertAlmostEqual(kpisNeg.netSavings, -200_000, "Negative savings: netSavings");
      assert(kpisNeg.netSavings < 0, "netSavings must be negative");
      assert(kpisNeg.savingRate < 0, "savingRate must be negative");
      assertAlmostEqual(kpisNeg.savingRate, -20, "Negative savings: savingRate");
      assert(!isNaN(kpisNeg.savingRate), "savingRate must not be NaN");

      console.log("✓ PASS: netSavings =", kpisNeg.netSavings, "(negative, not clamped)");
      console.log("✓ PASS: savingRate =", kpisNeg.savingRate.toFixed(2) + "%", "(negative, not clamped)");
    } finally {
      await db.delete(transactions).where(eq(transactions.userId, negUserIdBase));
      await db.delete(accounts).where(eq(accounts.userId, negUserIdBase));
      await db.delete(user).where(eq(user.id, negUserIdBase));
    }

    // ── TEST 9: Account Balance Widget ───────────────────────────────────────
    console.log("\n[TEST 9] Account Balances Widget...");

    const accBalances = await DashboardService.getAccountBalances(userAId);
    assert(accBalances.length === 2, `Expected 2 active accounts, got ${accBalances.length}`);

    const cashBalance = accBalances.find((a) => a.name === "Cash P3");
    const bcaBalance = accBalances.find((a) => a.name === "BCA P3");
    assert(!!cashBalance, "Cash P3 not found");
    assert(!!bcaBalance, "BCA P3 not found");

    // Cash: 1M init + 3M income - (1.2M+300k+50k) expense - 500k transfer-out = 1.95M
    assertAlmostEqual(cashBalance!.currentBalance, 1_950_000, "Cash P3 balance");
    // BCA: 2M init + 500k transfer-in = 2.5M
    assertAlmostEqual(bcaBalance!.currentBalance, 2_500_000, "BCA P3 balance");

    console.log("✓ PASS: Cash P3 balance =", cashBalance!.currentBalance);
    console.log("✓ PASS: BCA P3 balance =", bcaBalance!.currentBalance);

    // ── TEST 10: Recent Transactions ─────────────────────────────────────────
    console.log("\n[TEST 10] Recent Transactions...");

    const recent = await DashboardService.getRecentTransactions(userAId, 8);
    assert(recent.length >= 4, `Expected at least 4 recent transactions, got ${recent.length}`);
    assert(
      recent.every((t) => t.type === "INCOME" || t.type === "EXPENSE"),
      "Recent transactions must only have INCOME or EXPENSE types"
    );

    console.log("✓ PASS: Recent transactions count:", recent.length);
    console.log("✓ PASS: All types are INCOME or EXPENSE (no TRANSFER)");

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log("\n====================================================");
    console.log("    ALL PHASE 3 DASHBOARD ANALYTICS TESTS PASSED    ");
    console.log("====================================================");
  } finally {
    console.log("\nCleaning up Phase 3 test data...");
    await db.delete(transfers).where(eq(transfers.userId, userAId));
    await db.delete(transfers).where(eq(transfers.userId, userBId));
    await db.delete(transactions).where(eq(transactions.userId, userAId));
    await db.delete(transactions).where(eq(transactions.userId, userBId));
    await db.delete(accounts).where(eq(accounts.userId, userAId));
    await db.delete(accounts).where(eq(accounts.userId, userBId));
    await db.delete(categories).where(eq(categories.userId, userAId));
    await db.delete(categories).where(eq(categories.userId, userBId));
    await db.delete(user).where(eq(user.id, userAId));
    await db.delete(user).where(eq(user.id, userBId));
    console.log("Cleanup completed.");
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ TEST FAILED:", err);
    process.exit(1);
  });

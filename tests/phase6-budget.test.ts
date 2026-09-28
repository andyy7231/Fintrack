/**
 * FINTRACK PHASE 6 — BUDGET MANAGEMENT TESTS
 *
 * Covers:
 *   - CRUD (create, read, update, delete)
 *   - EXPENSE-only enforcement
 *   - Overlap / duplicate detection
 *   - Spending aggregation (live from transactions table)
 *   - Over-budget calculation
 *   - Transaction change impact (create / delete re-calculation)
 *   - IDOR / user isolation
 *   - Period boundaries (MONTHLY Jakarta timezone)
 *   - Custom period (startDate / endDate)
 *   - Budget amounts update
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { db } from "@/lib/db";
import { user, accounts, categories, transactions, budgets } from "@/db/schema";
import { BudgetService } from "@/services/budget.service";
import { TransactionService } from "@/services/transaction.service";
import { eq, inArray } from "drizzle-orm";

// ─── Tiny assertion helpers ───────────────────────────────────────────────────

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function assertApprox(a: number, b: number, message: string, epsilon = 0.01): void {
  assert(Math.abs(a - b) <= epsilon, `${message} (got ${a}, expected ${b})`);
}

// ─── Test data IDs ─────────────────────────────────────────────────────────────

const RUN_ID = Date.now();
const USER_A_ID = `p6_user_a_${RUN_ID}`;
const USER_B_ID = `p6_user_b_${RUN_ID}`;

let accountAId: string;
let expenseCatId: string; // EXPENSE category (system default "Makanan & Minuman")
let incomeCatId: string;  // INCOME category (system default "Gaji")
let customExpCatId: string; // custom EXPENSE cat for User A

// ─── Setup ────────────────────────────────────────────────────────────────────

async function setup() {
  // Create test users
  await db.insert(user).values([
    {
      id: USER_A_ID,
      name: "Budget User A",
      email: `${USER_A_ID}@test.local`,
      currency: "IDR",
      timezone: "Asia/Jakarta",
    },
    {
      id: USER_B_ID,
      name: "Budget User B",
      email: `${USER_B_ID}@test.local`,
      currency: "IDR",
      timezone: "Asia/Jakarta",
    },
  ]);

  // Create account for User A
  const [acc] = await db
    .insert(accounts)
    .values({
      userId: USER_A_ID,
      name: "Kas Test P6",
      type: "CASH",
      initialBalance: "10000000",
      currency: "IDR",
    })
    .returning();
  accountAId = acc.id;

  // Fetch system default categories
  const sysCats = await db.select().from(categories).where(eq(categories.isDefault, true));
  const food = sysCats.find((c) => c.name === "Makanan & Minuman" && c.type === "EXPENSE");
  const salary = sysCats.find((c) => c.type === "INCOME");

  if (!food) throw new Error("Default category 'Makanan & Minuman' not found in seed data");
  if (!salary) throw new Error("Default INCOME category not found in seed data");

  expenseCatId = food.id;
  incomeCatId = salary.id;

  // Create a custom EXPENSE category for User A
  const [custCat] = await db
    .insert(categories)
    .values({
      userId: USER_A_ID,
      name: "Transport P6",
      type: "EXPENSE",
      icon: "🚗",
      color: "#3B82F6",
      isDefault: false,
    })
    .returning();
  customExpCatId = custCat.id;
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

async function cleanup() {
  await db.delete(budgets).where(
    inArray(budgets.userId, [USER_A_ID, USER_B_ID])
  );
  await db.delete(transactions).where(
    inArray(transactions.userId, [USER_A_ID, USER_B_ID])
  );
  await db.delete(accounts).where(
    inArray(accounts.userId, [USER_A_ID, USER_B_ID])
  );
  await db.delete(categories).where(
    inArray(categories.userId, [USER_A_ID, USER_B_ID])
  );
  await db.delete(user).where(inArray(user.id, [USER_A_ID, USER_B_ID]));
}

// ─── Helper: Insert transaction directly for testing ──────────────────────────

async function insertExpense(
  userId: string,
  catId: string,
  amount: string,
  dateStr: string // "YYYY-MM-DD" in Jakarta local time
): Promise<string> {
  // Convert jakarta local date to UTC (subtract 7h offset)
  const [y, m, d] = dateStr.split("-").map(Number);
  const jakartaMidnight = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  const utcDate = new Date(jakartaMidnight.getTime() - 7 * 60 * 60 * 1000);

  const tx = await TransactionService.createTransaction(userId, {
    accountId: accountAId,
    categoryId: catId,
    type: "EXPENSE",
    amount,
    description: "Test expense P6",
    transactionDate: utcDate,
  });

  return tx.id;
}

// ─── Test runner ──────────────────────────────────────────────────────────────

async function runPhase6Tests() {
  console.log("====================================================");
  console.log("       FINTRACK PHASE 6 — BUDGET MANAGEMENT         ");
  console.log("====================================================");

  await setup();

  let passCount = 0;
  let failCount = 0;
  const failures: string[] = [];

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passCount++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`         ${msg}`);
      failCount++;
      failures.push(`${name}: ${msg}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: Create MONTHLY budget — EXPENSE category
  // ──────────────────────────────────────────────────────────────────────────
  let budget1Id: string;
  await test("Create MONTHLY budget for EXPENSE category", async () => {
    const budget = await BudgetService.createBudget(USER_A_ID, {
      periodType: "MONTHLY",
      categoryId: expenseCatId,
      amount: "1500000",
      currency: "IDR",
      year: 2026,
      month: 9,
    });

    assert(!!budget.id, "Budget ID should be set");
    assert(budget.userId === USER_A_ID, "userId should match");
    assert(budget.categoryId === expenseCatId, "categoryId should match");
    assert(budget.periodType === "MONTHLY", "periodType should be MONTHLY");
    assertApprox(budget.limitAmount, 1_500_000, "limitAmount should be 1500000");
    assertApprox(budget.spentAmount, 0, "spentAmount should be 0 (no transactions yet)");
    assert(!budget.isOverBudget, "should not be over budget with 0 spending");
    assert(budget.currency === "IDR", "currency should be IDR");

    budget1Id = budget.id;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: Reject budget for INCOME category
  // ──────────────────────────────────────────────────────────────────────────
  await test("Reject budget creation for INCOME category", async () => {
    let threw = false;
    try {
      await BudgetService.createBudget(USER_A_ID, {
        periodType: "MONTHLY",
        categoryId: incomeCatId,
        amount: "1000000",
        currency: "IDR",
        year: 2026,
        month: 9,
      });
    } catch (e: unknown) {
      threw = true;
      const msg = e instanceof Error ? e.message : "";
      assert(msg.toLowerCase().includes("expense"), `Error should mention EXPENSE, got: ${msg}`);
    }
    assert(threw, "Should have thrown for INCOME category");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3: Reject duplicate overlapping budget
  // ──────────────────────────────────────────────────────────────────────────
  await test("Reject duplicate/overlapping budget for same category+period", async () => {
    let threw = false;
    try {
      await BudgetService.createBudget(USER_A_ID, {
        periodType: "MONTHLY",
        categoryId: expenseCatId,
        amount: "999999",
        currency: "IDR",
        year: 2026,
        month: 9,
      });
    } catch {
      threw = true;
    }
    assert(threw, "Should have thrown for overlapping budget");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4: Get budget by ID with IDOR protection
  // ──────────────────────────────────────────────────────────────────────────
  await test("Get budget by ID — own budget returns correctly", async () => {
    const b = await BudgetService.getBudget(USER_A_ID, budget1Id);
    assert(b !== null, "Should find own budget");
    assert(b!.id === budget1Id, "Budget ID should match");
  });

  await test("Get budget by ID — IDOR: other user cannot access", async () => {
    const b = await BudgetService.getBudget(USER_B_ID, budget1Id);
    assert(b === null, "User B should NOT see User A's budget (IDOR protection)");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5: Live spending aggregation — add transactions, see spentAmount update
  // ──────────────────────────────────────────────────────────────────────────
  let txId2: string;
  await test("Spending aggregates correctly from transactions (September 2026)", async () => {
    // Insert two expenses in September 2026 Jakarta
    await insertExpense(USER_A_ID, expenseCatId, "300000", "2026-09-15");
    txId2 = await insertExpense(USER_A_ID, expenseCatId, "200000", "2026-09-20");

    const b = await BudgetService.getBudget(USER_A_ID, budget1Id);
    assert(b !== null, "Budget should still exist");
    assertApprox(b!.spentAmount, 500_000, "spentAmount should be 300000 + 200000 = 500000");
    assertApprox(b!.remainingAmount, 1_000_000, "remaining should be 1500000 - 500000 = 1000000");
    assertApprox(b!.usagePercentage, 33.33, "usagePercentage ~ 33.33%", 0.1);
    assert(!b!.isOverBudget, "should not be over budget (500k < 1.5M)");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 6: Transaction outside budget period is NOT counted
  // ──────────────────────────────────────────────────────────────────────────
  await test("Transaction outside budget period does NOT affect spending", async () => {
    // August 2026 — outside the Sept 2026 budget
    await insertExpense(USER_A_ID, expenseCatId, "999999", "2026-08-31");

    const b = await BudgetService.getBudget(USER_A_ID, budget1Id);
    // Still 500000 — August tx should NOT be included
    assertApprox(b!.spentAmount, 500_000, "August expense should NOT be counted in Sept budget");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 7: Over-budget detection
  // ──────────────────────────────────────────────────────────────────────────
  await test("Over-budget detection when spending exceeds limit", async () => {
    // Add 1200000 more → total 1700000 > 1500000 limit
    await insertExpense(USER_A_ID, expenseCatId, "1200000", "2026-09-25");

    const b = await BudgetService.getBudget(USER_A_ID, budget1Id);
    assertApprox(b!.spentAmount, 1_700_000, "spentAmount should be 1.7M");
    assert(b!.isOverBudget, "isOverBudget should be true");
    assertApprox(b!.remainingAmount, -200_000, "remaining should be negative (-200000)");
    assert(b!.displayPercentage === 100, "displayPercentage capped at 100");
    assert(b!.usagePercentage > 100, "usagePercentage should exceed 100");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 8: Delete transaction recalculates spending
  // ──────────────────────────────────────────────────────────────────────────
  await test("Deleting a transaction recalculates budget spending", async () => {
    // Delete the 200000 transaction
    await TransactionService.deleteTransaction(USER_A_ID, txId2);

    const b = await BudgetService.getBudget(USER_A_ID, budget1Id);
    // Now: 300000 + 1200000 = 1500000 (exactly at limit)
    assertApprox(b!.spentAmount, 1_500_000, "spentAmount after delete should be 1500000");
    // At exactly limit — NOT over budget (0 remaining = not over)
    assert(!b!.isOverBudget, "exactly at limit should not be isOverBudget");
    assertApprox(b!.remainingAmount, 0, "remaining should be 0");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 9: listBudgets — User A sees own budgets, User B sees none
  // ──────────────────────────────────────────────────────────────────────────
  await test("listBudgets returns correct user isolation", async () => {
    const listA = await BudgetService.listBudgets(USER_A_ID);
    const listB = await BudgetService.listBudgets(USER_B_ID);

    assert(listA.length >= 1, "User A should have at least 1 budget");
    assert(listA.every((b) => b.userId === USER_A_ID), "All User A budgets must belong to User A");
    assert(listB.length === 0, "User B should have 0 budgets");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 10: Create CUSTOM period budget
  // ──────────────────────────────────────────────────────────────────────────
  let customBudgetId: string;
  await test("Create CUSTOM period budget", async () => {
    const budget = await BudgetService.createBudget(USER_A_ID, {
      periodType: "CUSTOM",
      categoryId: customExpCatId,
      amount: "500000",
      currency: "IDR",
      startDate: "2026-09-01",
      endDate: "2026-09-30",
    });

    assert(budget.periodType === "CUSTOM", "periodType should be CUSTOM");
    assertApprox(budget.limitAmount, 500_000, "limitAmount should be 500000");
    assert(!budget.isOverBudget, "No spending in custom cat yet");

    customBudgetId = budget.id;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 11: Custom budget spending aggregation
  // ──────────────────────────────────────────────────────────────────────────
  await test("Custom period budget aggregates spending correctly", async () => {
    await insertExpense(USER_A_ID, customExpCatId, "200000", "2026-09-10");
    await insertExpense(USER_A_ID, customExpCatId, "150000", "2026-09-29");
    // Outside custom range:
    await insertExpense(USER_A_ID, customExpCatId, "999999", "2026-10-01");

    const b = await BudgetService.getBudget(USER_A_ID, customBudgetId);
    assertApprox(b!.spentAmount, 350_000, "Only Sep 1–30 expenses counted (200k+150k=350k)");
    assert(!b!.isOverBudget, "350k < 500k limit, not over");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 12: Update budget amount
  // ──────────────────────────────────────────────────────────────────────────
  await test("Update budget — change amount", async () => {
    const updated = await BudgetService.updateBudget(USER_A_ID, customBudgetId, {
      amount: "300000",
    });

    assert(updated !== null, "Update should succeed");
    assertApprox(updated!.limitAmount, 300_000, "limitAmount should be updated to 300000");
    // 350k > 300k → now over budget
    assert(updated!.isOverBudget, "Should be over budget after reducing limit below spent");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 13: Update budget — IDOR protection
  // ──────────────────────────────────────────────────────────────────────────
  await test("Update budget — IDOR: User B cannot update User A's budget", async () => {
    const result = await BudgetService.updateBudget(USER_B_ID, budget1Id, {
      amount: "1",
    });
    assert(result === null, "User B should NOT be able to update User A's budget");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 14: Delete budget — IDOR protection
  // ──────────────────────────────────────────────────────────────────────────
  await test("Delete budget — IDOR: User B cannot delete User A's budget", async () => {
    const deleted = await BudgetService.deleteBudget(USER_B_ID, customBudgetId);
    assert(!deleted, "User B should NOT be able to delete User A's budget");

    // Verify it still exists for User A
    const b = await BudgetService.getBudget(USER_A_ID, customBudgetId);
    assert(b !== null, "Budget should still exist after failed IDOR delete");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 15: Delete budget — success
  // ──────────────────────────────────────────────────────────────────────────
  await test("Delete budget — success and subsequent GET returns null", async () => {
    const deleted = await BudgetService.deleteBudget(USER_A_ID, customBudgetId);
    assert(deleted, "Delete should return true");

    const b = await BudgetService.getBudget(USER_A_ID, customBudgetId);
    assert(b === null, "Deleted budget should return null on GET");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 16: getBudgetSummary — alias for listBudgets
  // ──────────────────────────────────────────────────────────────────────────
  await test("getBudgetSummary returns same result as listBudgets", async () => {
    const summary = await BudgetService.getBudgetSummary(USER_A_ID);
    const list = await BudgetService.listBudgets(USER_A_ID);

    assert(summary.length === list.length, "Summary and list should have same count");
    if (summary.length > 0) {
      assert(
        summary[0].id === list[0].id,
        "First budget in summary and list should match"
      );
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 17: Jakarta month boundary — Sept 2026 transactions on boundary dates
  // ──────────────────────────────────────────────────────────────────────────
  await test("Jakarta month boundary: Aug 31 23:00 UTC = Sep 1 06:00 WIB — included", async () => {
    // Aug 31 23:00 UTC = Sep 1 06:00 Jakarta → INCLUDED in Sept 2026 budget
    const [txOnBoundary] = await db
      .insert(transactions)
      .values({
        userId: USER_A_ID,
        accountId: accountAId,
        categoryId: expenseCatId,
        type: "EXPENSE",
        amount: "50000",
        description: "Boundary transaction (Sep 1 WIB)",
        transactionDate: new Date("2026-08-31T23:00:00.000Z"), // Aug 31 23:00 UTC = Sep 1 06:00 WIB
        source: "WEB",
        status: "CONFIRMED",
      })
      .returning();

    const bBefore = await BudgetService.getBudget(USER_A_ID, budget1Id);
    assert(bBefore !== null, "Budget should exist");
    // The 50000 should now be included in September budget
    // Previous spentAmount was 1500000, now should be 1550000
    assertApprox(
      bBefore!.spentAmount,
      1_550_000,
      "Sep 1 WIB transaction should be counted in September budget"
    );

    // Cleanup this boundary tx
    await db.delete(transactions).where(eq(transactions.id, txOnBoundary.id));
  });

  await test("Jakarta month boundary: Sep 30 17:00 UTC = Oct 1 00:00 WIB — excluded", async () => {
    // Sep 30 17:00 UTC = Oct 1 00:00 Jakarta → EXCLUDED from Sept 2026 budget
    const [txNextMonth] = await db
      .insert(transactions)
      .values({
        userId: USER_A_ID,
        accountId: accountAId,
        categoryId: expenseCatId,
        type: "EXPENSE",
        amount: "75000",
        description: "October WIB transaction (excluded from Sept budget)",
        transactionDate: new Date("2026-09-30T17:00:00.000Z"), // = Oct 1 00:00 WIB
        source: "WEB",
        status: "CONFIRMED",
      })
      .returning();

    const b = await BudgetService.getBudget(USER_A_ID, budget1Id);
    // Should still be 1500000 (the Oct WIB tx is excluded)
    assertApprox(
      b!.spentAmount,
      1_500_000,
      "Oct 1 WIB transaction should NOT be counted in September budget"
    );

    // Cleanup
    await db.delete(transactions).where(eq(transactions.id, txNextMonth.id));
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 18: Different categories with same period are independent
  // ──────────────────────────────────────────────────────────────────────────
  await test("Multiple budgets (different categories) can coexist in same period", async () => {
    // customExpCatId was deleted in test 15; create a new budget for transport
    // First re-insert the custom cat if needed
    const transportBudget = await BudgetService.createBudget(USER_A_ID, {
      periodType: "MONTHLY",
      categoryId: customExpCatId,
      amount: "800000",
      currency: "IDR",
      year: 2026,
      month: 9,
    });

    assert(transportBudget.id !== budget1Id, "Should be a distinct budget");

    const list = await BudgetService.listBudgets(USER_A_ID);
    assert(list.length >= 2, "User A should have at least 2 budgets now");

    // Clean up transport budget
    await BudgetService.deleteBudget(USER_A_ID, transportBudget.id);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 19: INCOME transactions do NOT affect budget spending
  // ──────────────────────────────────────────────────────────────────────────
  await test("INCOME transactions are excluded from budget spending calculation", async () => {
    const spendingBefore = (await BudgetService.getBudget(USER_A_ID, budget1Id))!.spentAmount;

    // Insert an income transaction with the expense category — shouldn't happen normally
    // but TransactionService validates category type; test via direct insert
    await db.insert(transactions).values({
      userId: USER_A_ID,
      accountId: accountAId,
      categoryId: incomeCatId,
      type: "INCOME",
      amount: "9999999",
      description: "INCOME should not affect expense budget",
      transactionDate: new Date("2026-09-15T00:00:00.000Z"),
      source: "WEB",
      status: "CONFIRMED",
    });

    const spendingAfter = (await BudgetService.getBudget(USER_A_ID, budget1Id))!.spentAmount;
    assertApprox(spendingAfter, spendingBefore, "INCOME tx should NOT change expense budget spending");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 20: CANCELLED transactions do NOT affect budget spending
  // ──────────────────────────────────────────────────────────────────────────
  await test("CANCELLED transactions are excluded from budget spending calculation", async () => {
    const spendingBefore = (await BudgetService.getBudget(USER_A_ID, budget1Id))!.spentAmount;

    await db.insert(transactions).values({
      userId: USER_A_ID,
      accountId: accountAId,
      categoryId: expenseCatId,
      type: "EXPENSE",
      amount: "7777777",
      description: "CANCELLED expense — must not count",
      transactionDate: new Date("2026-09-12T00:00:00.000Z"),
      source: "WEB",
      status: "CANCELLED",
    });

    const spendingAfter = (await BudgetService.getBudget(USER_A_ID, budget1Id))!.spentAmount;
    assertApprox(spendingAfter, spendingBefore, "CANCELLED tx should NOT change budget spending");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────────────────────────────

  console.log("\n====================================================");
  console.log(
    `  RESULTS: ${passCount} PASS / ${failCount} FAIL`
  );
  if (failures.length > 0) {
    console.log("\n  FAILURES:");
    failures.forEach((f) => console.log(`    - ${f}`));
  }
  console.log("====================================================\n");

  await cleanup();

  if (failCount > 0) {
    process.exit(1);
  }
}

runPhase6Tests().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});

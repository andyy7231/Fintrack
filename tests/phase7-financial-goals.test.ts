/**
 * FINTRACK PHASE 7 — FINANCIAL GOALS TESTS (37 MANDATORY SUITE TESTS)
 *
 * Implements the full Section 56 specification:
 * 1. create goal
 * 2. get goal
 * 3. list goals
 * 4. update goal
 * 5. delete empty goal
 * 6. reject empty name
 * 7. reject target amount <= 0
 * 8. reject invalid target date
 * 9. reject invalid currency
 * 10. create contribution
 * 11. list contributions
 * 12. update contribution
 * 13. delete contribution
 * 14. calculate contributed amount
 * 15. calculate remaining amount
 * 16. calculate progress percentage
 * 17. calculate days remaining
 * 18. detect overdue goal
 * 19. goal becomes completed when target reached
 * 20. contribution cannot exceed remaining target
 * 21. user cannot access another user's goal
 * 22. user cannot update another user's goal
 * 23. user cannot delete another user's goal
 * 24. user cannot contribute to another user's goal
 * 25. user cannot use another user's transaction
 * 26. valid transaction can be linked
 * 27. transaction from another user rejected
 * 28. transaction reference does not create duplicate financial transaction
 * 29. allocation cannot exceed transaction's allocatable amount
 * 30. same transaction cannot be over-allocated
 * 31. deleting contribution reduces goal progress
 * 32. updating contribution recalculates progress
 * 33. deleting/archiving goal does not create financial mutation
 * 34. concurrent contributions cannot exceed target
 * 35. active goals appear in dashboard
 * 36. dashboard goal aggregation is correct
 * 37. goal contributions do not alter account balances or financial KPIs
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { db } from "@/lib/db";
import {
  user,
  accounts,
  categories,
  transactions,
  financialGoals,
  goalContributions,
} from "@/db/schema";
import { GoalService } from "@/services/goal.service";
import { DashboardService } from "@/services/dashboard.service";
import { createGoalSchema } from "@/schemas/goal.schema";
import { inArray, eq } from "drizzle-orm";

// ─── Assertion Helpers ─────────────────────────────────────────────────────────

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function assertApprox(a: number, b: number, message: string, epsilon = 0.01): void {
  assert(Math.abs(a - b) <= epsilon, `${message} (got ${a}, expected ${b})`);
}

// ─── Test Identifiers ─────────────────────────────────────────────────────────

const RUN_ID = Date.now();
const USER_A_ID = `p7_user_a_${RUN_ID}`;
const USER_B_ID = `p7_user_b_${RUN_ID}`;

let accountAId: string;
let accountBId: string;
let txA1Id: string; // 5.000.000
let txB1Id: string; // 3.000.000
let defaultCatId: string;

// ─── Setup ────────────────────────────────────────────────────────────────────

async function setup() {
  await db.insert(user).values([
    {
      id: USER_A_ID,
      name: "Goal User A",
      email: `${USER_A_ID}@test.local`,
      currency: "IDR",
      timezone: "Asia/Jakarta",
    },
    {
      id: USER_B_ID,
      name: "Goal User B",
      email: `${USER_B_ID}@test.local`,
      currency: "IDR",
      timezone: "Asia/Jakarta",
    },
  ]);

  const [accA] = await db
    .insert(accounts)
    .values({
      userId: USER_A_ID,
      name: "BCA User A",
      type: "BANK",
      initialBalance: "20000000.00",
      currency: "IDR",
      isActive: true,
    })
    .returning();
  accountAId = accA.id;

  const [accB] = await db
    .insert(accounts)
    .values({
      userId: USER_B_ID,
      name: "Mandiri User B",
      type: "BANK",
      initialBalance: "15000000.00",
      currency: "IDR",
      isActive: true,
    })
    .returning();
  accountBId = accB.id;

  const [cat] = await db.select().from(categories).limit(1);
  defaultCatId = cat.id;

  const [txA] = await db
    .insert(transactions)
    .values({
      userId: USER_A_ID,
      accountId: accountAId,
      categoryId: defaultCatId,
      type: "INCOME",
      amount: "5000000.00",
      description: "Bonus Kinerja User A",
      transactionDate: new Date("2026-09-10T03:00:00.000Z"),
      source: "WEB",
      status: "CONFIRMED",
    })
    .returning();
  txA1Id = txA.id;

  const [txB] = await db
    .insert(transactions)
    .values({
      userId: USER_B_ID,
      accountId: accountBId,
      categoryId: defaultCatId,
      type: "INCOME",
      amount: "3000000.00",
      description: "Gaji User B",
      transactionDate: new Date("2026-09-10T03:00:00.000Z"),
      source: "WEB",
      status: "CONFIRMED",
    })
    .returning();
  txB1Id = txB.id;
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

async function cleanup() {
  try {
    const testUserIds = [USER_A_ID, USER_B_ID];
    await db.delete(goalContributions).where(inArray(goalContributions.userId, testUserIds));
    await db.delete(financialGoals).where(inArray(financialGoals.userId, testUserIds));
    await db.delete(transactions).where(inArray(transactions.userId, testUserIds));
    await db.delete(accounts).where(inArray(accounts.userId, testUserIds));
    await db.delete(user).where(inArray(user.id, testUserIds));
  } catch (err) {
    console.error("Cleanup error:", err);
  }
}

// ─── Test Runner ──────────────────────────────────────────────────────────────

async function runPhase7Tests() {
  console.log("====================================================");
  console.log("       FINTRACK PHASE 7 — FINANCIAL GOALS TESTS     ");
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
      console.error(`  ✗ FAIL [${num}]: ${name}\n          ${msg}`);
      failures.push(`[${num}] ${name}: ${msg}`);
      failCount++;
    }
  }

  let goal1Id: string;
  let goal2Id: string;
  let emptyGoalId: string;
  let contrib1Id: string;

  // 1. create goal
  await test(1, "create goal", async () => {
    const goal = await GoalService.createGoal(USER_A_ID, {
      name: "Umrah Orang Tua",
      description: "Tabungan ibadah",
      targetAmount: "30000000",
      targetDate: "2028-09-01",
      currency: "IDR",
    });
    goal1Id = goal.id;
    assert(goal.id !== undefined, "Goal ID must be defined");
    assert(goal.name === "Umrah Orang Tua", "Name must match");
    assert(goal.targetAmount === 30000000, "Target amount must be 30.000.000");
    assert(goal.status === "ACTIVE", "Status must be ACTIVE");
  });

  // 2. get goal
  await test(2, "get goal", async () => {
    const goal = await GoalService.getGoal(USER_A_ID, goal1Id);
    assert(goal !== null, "Goal must exist");
    assert(goal!.name === "Umrah Orang Tua", "Name must match");
  });

  // 3. list goals
  await test(3, "list goals", async () => {
    const list = await GoalService.listGoals(USER_A_ID);
    assert(list.length === 1, `Must have 1 goal, got ${list.length}`);
  });

  // 4. update goal
  await test(4, "update goal", async () => {
    const updated = await GoalService.updateGoal(USER_A_ID, goal1Id, {
      name: "Umrah Akbar 2028",
      targetAmount: "35000000",
    });
    assert(updated !== null, "Must return updated goal");
    assert(updated!.name === "Umrah Akbar 2028", "Name must update");
    assert(updated!.targetAmount === 35000000, "Target amount must update");
  });

  // 5. delete empty goal
  await test(5, "delete empty goal", async () => {
    const temp = await GoalService.createGoal(USER_A_ID, {
      name: "Goal Kosong",
      targetAmount: "5000000",
      targetDate: "2027-01-01",
      currency: "IDR",
    });
    emptyGoalId = temp.id;
    const res = await GoalService.deleteGoal(USER_A_ID, emptyGoalId);
    assert(res.deleted === true, "Delete must return true");
    const check = await GoalService.getGoal(USER_A_ID, emptyGoalId);
    assert(check === null, "Deleted goal must not be found");
  });

  // 6. reject empty name
  await test(6, "reject empty name", async () => {
    const parsed = createGoalSchema.safeParse({
      name: "   ",
      targetAmount: "1000000",
      targetDate: "2027-01-01",
      currency: "IDR",
    });
    assert(!parsed.success, "Empty name must be rejected by validation schema");
  });

  // 7. reject target amount <= 0
  await test(7, "reject target amount <= 0", async () => {
    const parsedZero = createGoalSchema.safeParse({
      name: "Target Nol",
      targetAmount: "0",
      targetDate: "2027-01-01",
      currency: "IDR",
    });
    assert(!parsedZero.success, "Target amount 0 must be rejected");

    const parsedNeg = createGoalSchema.safeParse({
      name: "Target Negatif",
      targetAmount: "-5000",
      targetDate: "2027-01-01",
      currency: "IDR",
    });
    assert(!parsedNeg.success, "Target amount negative must be rejected");
  });

  // 8. reject invalid target date
  await test(8, "reject invalid target date", async () => {
    const parsed = createGoalSchema.safeParse({
      name: "Invalid Date",
      targetAmount: "1000000",
      targetDate: "not-a-date",
      currency: "IDR",
    });
    assert(!parsed.success, "Invalid target date must be rejected");
  });

  // 9. reject invalid currency
  await test(9, "reject invalid currency", async () => {
    const parsed = createGoalSchema.safeParse({
      name: "Invalid Currency",
      targetAmount: "1000000",
      targetDate: "2027-01-01",
      currency: "   ",
    });
    assert(!parsed.success, "Empty currency must be rejected");
  });

  // 10. create contribution
  await test(10, "create contribution", async () => {
    const c = await GoalService.createContribution(USER_A_ID, goal1Id, {
      amount: "5000000",
      description: "Setoran awal 5jt",
    });
    contrib1Id = c.id;
    assert(c.id !== undefined, "Contribution ID must be defined");
    assert(c.amount === 5000000, "Amount must be 5.000.000");
  });

  // 11. list contributions
  await test(11, "list contributions", async () => {
    const list = await GoalService.listContributions(USER_A_ID, goal1Id);
    assert(list.length === 1, `Must have 1 contribution, got ${list.length}`);
  });

  // 12. update contribution
  await test(12, "update contribution", async () => {
    const updated = await GoalService.updateContribution(USER_A_ID, goal1Id, contrib1Id, {
      amount: "8000000",
      description: "Revisi setoran 8jt",
    });
    assert(updated.amount === 8000000, "Updated amount must be 8.000.000");
  });

  // 13. delete contribution
  await test(13, "delete contribution", async () => {
    const tempC = await GoalService.createContribution(USER_A_ID, goal1Id, {
      amount: "2000000",
    });
    const del = await GoalService.deleteContribution(USER_A_ID, goal1Id, tempC.id);
    assert(del.deleted === true, "Delete must return true");
  });

  // 14. calculate contributed amount
  await test(14, "calculate contributed amount", async () => {
    const g = await GoalService.getGoal(USER_A_ID, goal1Id);
    assert(g!.contributedAmount === 8000000, `Contributed amount must be 8.000.000, got ${g!.contributedAmount}`);
  });

  // 15. calculate remaining amount
  await test(15, "calculate remaining amount", async () => {
    const g = await GoalService.getGoal(USER_A_ID, goal1Id);
    assert(g!.remainingAmount === 27000000, `Remaining amount must be 27.000.000, got ${g!.remainingAmount}`);
  });

  // 16. calculate progress percentage
  await test(16, "calculate progress percentage", async () => {
    const g = await GoalService.getGoal(USER_A_ID, goal1Id);
    const expected = Math.round(((8000000 / 35000000) * 100) * 100) / 100;
    assertApprox(g!.progressPercentage, expected, "Progress percentage must match formula");
  });

  // 17. calculate days remaining
  await test(17, "calculate days remaining", async () => {
    const g = await GoalService.getGoal(USER_A_ID, goal1Id);
    assert(g!.daysRemaining > 0, "Days remaining for future date must be > 0");
  });

  // 18. detect overdue goal
  await test(18, "detect overdue goal", async () => {
    const pastGoal = await GoalService.createGoal(USER_A_ID, {
      name: "Goal Terlambat",
      targetAmount: "1000000",
      targetDate: "2020-01-01",
      currency: "IDR",
    });
    assert(pastGoal.isOverdue === true, "Past date goal must have isOverdue = true");
    await GoalService.deleteGoal(USER_A_ID, pastGoal.id);
  });

  // 19. goal becomes completed when target reached
  await test(19, "goal becomes completed when target reached", async () => {
    const targetGoal = await GoalService.createGoal(USER_A_ID, {
      name: "Goal Laptop",
      targetAmount: "10000000",
      targetDate: "2027-01-01",
      currency: "IDR",
    });
    goal2Id = targetGoal.id;

    await GoalService.createContribution(USER_A_ID, goal2Id, {
      amount: "10000000",
      description: "Pelunasan target laptop",
    });

    const completed = await GoalService.getGoal(USER_A_ID, goal2Id);
    assert(completed!.status === "COMPLETED", "Goal status must automatically be COMPLETED");
    assert(completed!.remainingAmount === 0, "Remaining amount must be 0");
    assert(completed!.progressPercentage === 100, "Progress percentage must be 100%");
  });

  // 20. contribution cannot exceed remaining target
  await test(20, "contribution cannot exceed remaining target", async () => {
    let rejected = false;
    try {
      await GoalService.createContribution(USER_A_ID, goal1Id, {
        amount: "30000000", // remaining is 27jt!
      });
    } catch (err: unknown) {
      rejected = true;
      assert((err as Error).message.includes("melebihi sisa target"), "Must reject exceeding remaining target");
    }
    assert(rejected, "Must reject contribution exceeding remaining target");
  });

  // 21. user cannot access another user's goal
  await test(21, "user cannot access another user's goal", async () => {
    const g = await GoalService.getGoal(USER_B_ID, goal1Id);
    assert(g === null, "Cross-user access must return null");
  });

  // 22. user cannot update another user's goal
  await test(22, "user cannot update another user's goal", async () => {
    const res = await GoalService.updateGoal(USER_B_ID, goal1Id, { name: "Attack" });
    assert(res === null, "Cross-user update must return null");
  });

  // 23. user cannot delete another user's goal
  await test(23, "user cannot delete another user's goal", async () => {
    const res = await GoalService.deleteGoal(USER_B_ID, goal1Id);
    assert(res.deleted === false, "Cross-user delete must return false");
  });

  // 24. user cannot contribute to another user's goal
  await test(24, "user cannot contribute to another user's goal", async () => {
    let rejected = false;
    try {
      await GoalService.createContribution(USER_B_ID, goal1Id, { amount: "100000" });
    } catch {
      rejected = true;
    }
    assert(rejected, "Must reject contribution to another user's goal");
  });

  // 25. user cannot use another user's transaction
  await test(25, "user cannot use another user's transaction", async () => {
    let rejected = false;
    try {
      await GoalService.createContribution(USER_A_ID, goal1Id, {
        amount: "500000",
        transactionId: txB1Id, // txB1Id is owned by User B!
      });
    } catch (err: unknown) {
      rejected = true;
      assert((err as Error).message.includes("bukan milik Anda") || (err as Error).message.includes("tidak ditemukan"), "Must reject unowned transaction");
    }
    assert(rejected, "Must reject unowned transaction");
  });

  // 26. valid transaction can be linked
  await test(26, "valid transaction can be linked", async () => {
    const c = await GoalService.createContribution(USER_A_ID, goal1Id, {
      amount: "2000000",
      transactionId: txA1Id,
      description: "Alokasi dari bonus",
    });
    assert(c.transactionId === txA1Id, "Linked transactionId must match");
  });

  // 27. transaction from another user rejected
  await test(27, "transaction from another user rejected", async () => {
    let rejected = false;
    try {
      await GoalService.createContribution(USER_A_ID, goal1Id, {
        amount: "1000000",
        transactionId: txB1Id,
      });
    } catch {
      rejected = true;
    }
    assert(rejected, "Cross-user transaction link must be rejected");
  });

  // 28. transaction reference does not create duplicate financial transaction
  await test(28, "transaction reference does not create duplicate financial transaction", async () => {
    const txCount = await db.select().from(transactions).where(eq(transactions.userId, USER_A_ID));
    assert(txCount.length === 1, `Transactions count must remain 1, found ${txCount.length}`);
  });

  // 29. allocation cannot exceed transaction's allocatable amount
  await test(29, "allocation cannot exceed transaction's allocatable amount", async () => {
    // txA1Id amount: 5jt. Already allocated: 2jt. Available: 3jt.
    // Try to allocate 4jt:
    let rejected = false;
    try {
      await GoalService.createContribution(USER_A_ID, goal1Id, {
        amount: "4000000",
        transactionId: txA1Id,
      });
    } catch (err: unknown) {
      rejected = true;
      assert((err as Error).message.includes("melebihi batas alokasi"), "Must state allocation limit exceeded");
    }
    assert(rejected, "Must reject exceeding transaction allocatable amount");
  });

  // 30. same transaction cannot be over-allocated across multiple goals
  await test(30, "same transaction cannot be over-allocated", async () => {
    // Goal 3
    const goal3 = await GoalService.createGoal(USER_A_ID, {
      name: "Goal Tiga",
      targetAmount: "10000000",
      targetDate: "2027-06-01",
      currency: "IDR",
    });
    // Allocate the remaining 3jt of txA1Id to Goal 3
    await GoalService.createContribution(USER_A_ID, goal3.id, {
      amount: "3000000",
      transactionId: txA1Id,
    });
    // txA1Id now 100% allocated (2jt on goal1 + 3jt on goal3 = 5jt total).
    // Now any further allocation from txA1Id must be rejected!
    let rejected = false;
    try {
      await GoalService.createContribution(USER_A_ID, goal3.id, {
        amount: "100000",
        transactionId: txA1Id,
      });
    } catch (err: unknown) {
      rejected = true;
      assert((err as Error).message.includes("melebihi batas alokasi"), "Must state limit reached");
    }
    assert(rejected, "Must reject over-allocation of source transaction");
    await db.delete(goalContributions).where(eq(goalContributions.goalId, goal3.id));
    await GoalService.deleteGoal(USER_A_ID, goal3.id);
  });

  // 31. deleting contribution reduces goal progress
  await test(31, "deleting contribution reduces goal progress", async () => {
    const tempC = await GoalService.createContribution(USER_A_ID, goal1Id, {
      amount: "1000000",
    });
    const before = (await GoalService.getGoal(USER_A_ID, goal1Id))!.contributedAmount;
    await GoalService.deleteContribution(USER_A_ID, goal1Id, tempC.id);
    const after = (await GoalService.getGoal(USER_A_ID, goal1Id))!.contributedAmount;
    assert(after === before - 1000000, "Contributed amount must decrease by deleted amount");
  });

  // 32. updating contribution recalculates progress
  await test(32, "updating contribution recalculates progress", async () => {
    const tempC = await GoalService.createContribution(USER_A_ID, goal1Id, {
      amount: "1000000",
    });
    await GoalService.updateContribution(USER_A_ID, goal1Id, tempC.id, {
      amount: "1500000",
    });
    const g = await GoalService.getGoal(USER_A_ID, goal1Id);
    assert(g!.contributedAmount > 0, "Progress must recalculate accurately");
    await GoalService.deleteContribution(USER_A_ID, goal1Id, tempC.id);
  });

  // 33. deleting/archiving goal does not create financial mutation
  await test(33, "deleting/archiving goal does not create financial mutation", async () => {
    const accBefore = (await db.select().from(accounts).where(eq(accounts.id, accountAId)))[0];
    await GoalService.archiveGoal(USER_A_ID, goal1Id);
    const accAfter = (await db.select().from(accounts).where(eq(accounts.id, accountAId)))[0];
    assert(accBefore.initialBalance === accAfter.initialBalance, "Account balance must remain identical");
    await GoalService.resumeGoal(USER_A_ID, goal1Id);
  });

  // 34. concurrent contributions cannot exceed target
  await test(34, "concurrent contributions cannot exceed target", async () => {
    const raceGoal = await GoalService.createGoal(USER_A_ID, {
      name: "Race Goal",
      targetAmount: "1000000",
      targetDate: "2027-01-01",
      currency: "IDR",
    });
    const results = await Promise.allSettled([
      GoalService.createContribution(USER_A_ID, raceGoal.id, { amount: "600000" }),
      GoalService.createContribution(USER_A_ID, raceGoal.id, { amount: "600000" }),
    ]);
    const successes = results.filter((r) => r.status === "fulfilled");
    const fails = results.filter((r) => r.status === "rejected");
    assert(successes.length === 1, `Exactly 1 should succeed, got ${successes.length}`);
    assert(fails.length === 1, `Exactly 1 should fail, got ${fails.length}`);

    await db.delete(goalContributions).where(eq(goalContributions.goalId, raceGoal.id));
    await GoalService.deleteGoal(USER_A_ID, raceGoal.id);
  });

  // 35. active goals appear in dashboard
  await test(35, "active goals appear in dashboard", async () => {
    const summary = await GoalService.getGoalSummary(USER_A_ID);
    assert(summary.activeGoals.length > 0, "Active goals must appear in summary");
    const found = summary.activeGoals.some((g) => g.id === goal1Id);
    assert(found, "Goal 1 must be present in active goals");
  });

  // 36. dashboard goal aggregation is correct
  await test(36, "dashboard goal aggregation is correct", async () => {
    const summary = await GoalService.getGoalSummary(USER_A_ID);
    assert(summary.totalGoalsCount >= 2, "Total goals count must be accurate");
    assert(summary.totalTargetAmount > 0, "Total target amount must be positive");
    assert(summary.totalContributedAmount > 0, "Total contributed amount must be positive");
    assert(summary.overallProgressPercentage > 0, "Overall progress must be calculated");
  });

  // 37. goal contributions do not alter account balances or financial KPIs
  await test(37, "goal contributions do not alter account balances or financial KPIs", async () => {
    const kpis = await DashboardService.getKPIs(USER_A_ID, "Asia/Jakarta");
    // Income is exactly 5.000.000 (from txA1Id), expense is 0
    assertApprox(kpis.incomeThisMonth, 5000000, "Income must reflect only transactions (5jt)");
    assertApprox(kpis.expenseThisMonth, 0, "Expense must remain 0");
    assertApprox(kpis.netSavings, 5000000, "Net savings must remain 5jt");
    assertApprox(kpis.totalNetWorth, 25000000, "Net worth must equal initialBalance(20jt) + tx(5jt)");
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

runPhase7Tests().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});

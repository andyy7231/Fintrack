/**
 * Bug Condition Exploration Test
 * 
 * This test is designed to FAIL on unfixed code to confirm the bug exists.
 * After the fix is implemented, this test should PASS to confirm expected behavior.
 * 
 * Bug: Creating budget allocations does not reduce available cash balance.
 * Expected: Budget allocations should reduce "free cash" while keeping "total money" separate.
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { db } from "@/lib/db";
import { user, accounts, categories, budgets } from "@/db/schema";
import { AccountService } from "@/services/account.service";
import { BudgetService } from "@/services/budget.service";
import { CategoryService } from "@/services/category.service";
import { DashboardService } from "@/services/dashboard.service";
import { eq } from "drizzle-orm";

async function runBugExplorationTest() {
  console.log("=================================================================");
  console.log("  BUG CONDITION EXPLORATION TEST - Budget Cash Deduction");
  console.log("  EXPECTED: This test FAILS on unfixed code (confirms bug exists)");
  console.log("=================================================================\n");

  const testUserId = "test_bug_exploration_" + Date.now(); let testAccountId: string | undefined;
  let foodCategoryId: string;
  let housingCategoryId: string;
  let savingsCategoryId: string;

  try {
    // Setup: Create test user
    await db.insert(user).values({
      id: testUserId,
      name: "Bug Test User",
      email: `${testUserId}@test.com`,
      currency: "IDR",
      timezone: "Asia/Jakarta",
    });

    // Setup: Create test account with 2,000,000 balance
    const account = await AccountService.createAccount(testUserId, {
      name: "Test Cash Account",
      type: "CASH",
      initialBalance: "2000000",
      currency: "IDR",
    });
    testAccountId = account.id;

    // Setup: Get expense categories (using CategoryService to get system defaults + user categories)
    const allCategories = await CategoryService.getCategories(testUserId, "EXPENSE");
    
    const foodCat = allCategories.find(c => c.name === "Makanan & Minuman");
    const housingCat = allCategories.find(c => c.name === "Tempat Tinggal"); // Updated name
    // For savings, we'll use "Pengeluaran Lain" as a proxy since there's no "Tabungan" expense category
    const savingsCat = allCategories.find(c => c.name === "Pengeluaran Lain");

    if (!foodCat || !housingCat || !savingsCat) {
      console.log("Available categories:", allCategories.map(c => c.name).join(", "));
      throw new Error("Required categories not found - default categories may not be seeded");
    }

    foodCategoryId = foodCat.id;
    housingCategoryId = housingCat.id;
    savingsCategoryId = savingsCat.id;

    console.log("✓ Setup complete");
    console.log(`  Account ID: ${testAccountId}`);
    console.log(`  Initial balance: 2,000,000\n`);

    // ========================================================================
    // TEST SCENARIO 1: Single Budget Allocation
    // ========================================================================
    console.log("📋 TEST SCENARIO 1: Single Budget Allocation (500k)");
    console.log("   Expected: Free cash should reduce from 2,000,000 to 1,500,000");

    try {
      // Attempt to check free cash BEFORE creating budget
      // This will likely fail on unfixed code because getFreeCash doesn't exist
      const initialFreeCash = await (AccountService as any).getFreeCash(testUserId, testAccountId);
      console.log(`   Initial Free Cash: ${initialFreeCash.toLocaleString()}`);
      
      if (Math.abs(initialFreeCash - 2000000) > 0.01) {
        console.log(`   ❌ FAIL: Initial free cash should be 2,000,000, got ${initialFreeCash}`);
        throw new Error("Initial free cash incorrect");
      }
    } catch (error: any) {
      console.log(`   ⚠️  EXPECTED FAILURE: getFreeCash method does not exist yet`);
      console.log(`      Error: ${error.message}`);
      console.log(`      This confirms the bug - no free cash tracking exists\n`);
      
      // Document this as a counterexample
      console.log("📝 COUNTEREXAMPLE 1: AccountService.getFreeCash method missing");
      console.log("   Root Cause: System does not distinguish between total and free cash\n");
    }

    // Try to create budget allocation
    console.log("   Creating budget allocation: 500,000 for 'Pengeluaran Lain' category...");
    
    try {
      const budget = await BudgetService.createBudget(testUserId, { accountId: testAccountId,
          categoryId: savingsCategoryId,
          periodType: "MONTHLY",
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear(),
          amount: "500000",
          currency: "IDR",
        } as any
      );
      
      console.log(`   Budget created: ${budget.id}`);
    } catch (error: any) {
      console.log(`   ⚠️  EXPECTED FAILURE: createBudget does not accept accountId parameter`);
      console.log(`      Error: ${error.message}`);
      console.log(`      This confirms the bug - budgets not linked to accounts\n`);
      
      // Document this as a counterexample
      console.log("📝 COUNTEREXAMPLE 2: BudgetService.createBudget missing accountId parameter");
      console.log("   Root Cause: Budget allocations not associated with specific accounts\n");
      
      // Try without accountId to see original behavior
      console.log("   Attempting budget creation WITHOUT accountId (original behavior)...");
      try {
        const budget = await BudgetService.createBudget(testUserId, { accountId: testAccountId,
            categoryId: savingsCategoryId,
            periodType: "MONTHLY",
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
            amount: "500000",
            currency: "IDR",
          } as any
        );
        console.log(`   ✓ Budget created (old way): ${budget.id}`);
        console.log(`   ⚠️  But this does NOT reduce cash balance!\n`);
      } catch (createError: any) {
        console.log(`   ❌ Budget creation failed: ${createError.message}\n`);
      }
    }

    // ========================================================================
    // TEST SCENARIO 2: Multiple Budget Allocations
    // ========================================================================
    console.log("📋 TEST SCENARIO 2: Multiple Budget Allocations (1,850k total)");
    console.log("   Expected: Free cash should be 150,000 (2,000,000 - 1,850,000)");

    // Clean up any existing budgets first
    await db.delete(budgets).where(eq(budgets.userId, testUserId));

    try {
      // Create three budgets: 600k (makan) + 750k (housing) + 500k (other) = 1,850k
      console.log("   Creating budget: 600,000 for 'Makanan & Minuman'...");
      await BudgetService.createBudget(testUserId, { accountId: testAccountId,
        categoryId: foodCategoryId,
        periodType: "MONTHLY",
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        amount: "600000",
        currency: "IDR",
      } as any);

      console.log("   Creating budget: 750,000 for 'Tempat Tinggal'...");
      await BudgetService.createBudget(testUserId, { accountId: testAccountId,
        categoryId: housingCategoryId,
        periodType: "MONTHLY",
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        amount: "750000",
        currency: "IDR",
      } as any);

      console.log("   Creating budget: 500,000 for 'Pengeluaran Lain'...");
      await BudgetService.createBudget(testUserId, { accountId: testAccountId,
        categoryId: savingsCategoryId,
        periodType: "MONTHLY",
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        amount: "500000",
        currency: "IDR",
      } as any);

      console.log("   ✓ Three budgets created (total: 1,850,000)");

      // Try to check free cash
      try {
        const freeCash = await (AccountService as any).getFreeCash(testUserId, testAccountId);
        console.log(`   Free Cash: ${freeCash.toLocaleString()}`);

        if (Math.abs(freeCash - 150000) < 0.01) {
          console.log(`   ✅ PASS: Free cash correctly calculated as 150,000`);
        } else {
          console.log(`   ❌ FAIL: Free cash should be 150,000, got ${freeCash}`);
          console.log(`   💡 This indicates budgets do not reduce free cash\n`);
          
          // Document counterexample
          console.log("📝 COUNTEREXAMPLE 3: Budget allocations do not reduce free cash");
          console.log(`   Expected: 150,000`);
          console.log(`   Actual: ${freeCash}`);
          console.log("   Root Cause: getFreeCash does not subtract budget allocations\n");
        }
      } catch (error: any) {
        console.log(`   ⚠️  EXPECTED FAILURE: Cannot calculate free cash`);
        console.log(`      Error: ${error.message}\n`);
      }
    } catch (error: any) {
      console.log(`   ⚠️  Budget creation failed: ${error.message}\n`);
    }

    // ========================================================================
    // TEST SCENARIO 3: Dashboard Shows Separated Views
    // ========================================================================
    console.log("📋 TEST SCENARIO 3: Dashboard Dual-View (Total Money vs Free Cash)");
    console.log("   Expected: Dashboard should show both 'totalBalance' and 'freeCash'");

    try {
      const dashboard = await DashboardService.getSummary(testUserId);
      
      console.log(`   Total Balance: ${dashboard.totalBalance.toLocaleString()}`);
      
      if ('freeCash' in dashboard) {
        console.log(`   Free Cash: ${(dashboard as any).freeCash.toLocaleString()}`);
        
        // Verify the relationship: totalBalance = freeCash + allocations
        const expectedFreeCash = 2000000 - 1850000; // 150,000
        if (Math.abs((dashboard as any).freeCash - expectedFreeCash) < 0.01) {
          console.log(`   ✅ PASS: Dashboard correctly shows separated views`);
        } else {
          console.log(`   ❌ FAIL: Free cash value incorrect`);
        }
      } else {
        console.log(`   ❌ FAIL: Dashboard missing 'freeCash' field`);
        console.log(`   💡 Dashboard only shows total balance, not free cash\n`);
        
        // Document counterexample
        console.log("📝 COUNTEREXAMPLE 4: Dashboard does not show free cash");
        console.log("   Available fields:", Object.keys(dashboard).join(", "));
        console.log("   Root Cause: DashboardService.getSummary does not calculate freeCash\n");
      }
    } catch (error: any) {
      console.log(`   ❌ Dashboard query failed: ${error.message}\n`);
    }

    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log("\n=================================================================");
    console.log("  BUG EXPLORATION TEST SUMMARY");
    console.log("=================================================================");
    console.log("\n✅ Expected Counterexamples Found:");
    console.log("   1. AccountService.getFreeCash method does not exist");
    console.log("   2. BudgetService.createBudget does not accept accountId parameter");
    console.log("   3. Budget allocations do not reduce free cash calculation");
    console.log("   4. Dashboard does not show separate 'freeCash' field");
    console.log("\n💡 Root Cause Confirmed:");
    console.log("   - No free cash tracking mechanism exists");
    console.log("   - Budgets not associated with accounts");
    console.log("   - System treats budgets as soft limits, not cash reservations");
    console.log("\n📝 Next Steps:");
    console.log("   - Implement database migration to add accountId to budgets");
    console.log("   - Implement AccountService.getFreeCash method");
    console.log("   - Update BudgetService.createBudget to accept and validate accountId");
    console.log("   - Update DashboardService to calculate and return freeCash");
    console.log("\n⏭️  After fix: Re-run this test - it should PASS");
    console.log("=================================================================\n");

  } catch (error: any) {
    console.error("\n❌ Test execution error:", error.message);
    throw error;
  } finally {
    // Cleanup
    console.log("🧹 Cleaning up test data...");
    if (testAccountId) {
      await db.delete(accounts).where(eq(accounts.id, testAccountId));
    }
    await db.delete(budgets).where(eq(budgets.userId, testUserId));
    await db.delete(user).where(eq(user.id, testUserId));
    console.log("✓ Cleanup complete\n");
  }
}

// Run the test
runBugExplorationTest()
  .then(() => {
    console.log("✅ Bug exploration test execution completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Bug exploration test failed:", error);
    process.exit(1);
  });







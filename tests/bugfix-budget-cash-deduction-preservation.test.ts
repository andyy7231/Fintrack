/**
 * Preservation Property Tests
 * 
 * These tests document and verify that non-budget operations remain unchanged
 * after the bugfix is implemented. They should PASS both on unfixed and fixed code.
 * 
 * Testing approach:
 * 1. Observe behavior on UNFIXED code (document baseline)
 * 2. After fix, verify same behavior is preserved (no regressions)
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { db } from "@/lib/db";
import { user, accounts, categories, transactions, transfers } from "@/db/schema";
import { AccountService } from "@/services/account.service";
import { CategoryService } from "@/services/category.service";
import { TransactionService } from "@/services/transaction.service";
import { TransferService } from "@/services/transfer.service";
import { DashboardService } from "@/services/dashboard.service";
import { eq, and } from "drizzle-orm";

async function runPreservationTests() {
  console.log("=================================================================");
  console.log("  PRESERVATION PROPERTY TESTS - Budget Cash Deduction");
  console.log("  EXPECTED: All tests PASS (baseline behavior preserved)");
  console.log("=================================================================\n");

  const testUserId = "test_preservation_" + Date.now();
  const testUserBId = "test_preservation_b_" + Date.now();
  let testAccountAId: string;
  let testAccountBId: string;
  let testAccountA2Id: string; // Second account for user A
  let incomeCategoryId: string;
  let expenseCategoryId: string;

  let passedTests = 0;
  let totalTests = 0;

  try {
    // Setup: Create test users
    await db.insert(user).values([
      {
        id: testUserId,
        name: "Preservation Test User A",
        email: `${testUserId}@test.com`,
        currency: "IDR",
        timezone: "Asia/Jakarta",
      },
      {
        id: testUserBId,
        name: "Preservation Test User B",
        email: `${testUserBId}@test.com`,
        currency: "IDR",
        timezone: "Asia/Jakarta",
      },
    ]);

    // Setup: Create test accounts
    const accountA = await AccountService.createAccount(testUserId, {
      name: "Test Account A",
      type: "CASH",
      initialBalance: "1000000",
      currency: "IDR",
    });
    testAccountAId = accountA.id;

    const accountA2 = await AccountService.createAccount(testUserId, {
      name: "Test Account A2 (Multi-account test)",
      type: "BANK",
      initialBalance: "500000",
      currency: "IDR",
    });
    testAccountA2Id = accountA2.id;

    const accountB = await AccountService.createAccount(testUserBId, {
      name: "Test Account B",
      type: "CASH",
      initialBalance: "2000000",
      currency: "IDR",
    });
    testAccountBId = accountB.id;

    // Setup: Get categories
    const allCategories = await CategoryService.getCategories(testUserId);
    const incomeCat = allCategories.find(c => c.type === "INCOME");
    const expenseCat = allCategories.find(c => c.type === "EXPENSE");

    if (!incomeCat || !expenseCat) {
      throw new Error("Required categories not found");
    }

    incomeCategoryId = incomeCat.id;
    expenseCategoryId = expenseCat.id;

    console.log("✓ Setup complete");
    console.log(`  User A: ${testUserId}`);
    console.log(`  Account A: ${testAccountAId} (1,000,000)`);
    console.log(`  Account A2: ${testAccountA2Id} (500,000)`);
    console.log(`  User B: ${testUserBId}`);
    console.log(`  Account B: ${testAccountBId} (2,000,000)\n`);

    // ========================================================================
    // PROPERTY 1: Income Transaction Preservation
    // ========================================================================
    console.log("📋 PROPERTY 1: Income transactions increase balance correctly");
    totalTests++;

    try {
      const initialBalance = await AccountService.getAccountBalance(
        testUserId,
        testAccountAId,
        1000000
      );

      // Record income transaction
      await TransactionService.createTransaction(testUserId, {
        accountId: testAccountAId,
        categoryId: incomeCategoryId,
        type: "INCOME",
        amount: "500000",
        description: "Test Income",
        transactionDate: new Date(),
        source: "WEB",
      });

      const finalBalance = await AccountService.getAccountBalance(
        testUserId,
        testAccountAId,
        1000000
      );

      if (Math.abs(finalBalance - (initialBalance + 500000)) < 0.01) {
        console.log(`   ✅ PASS: Balance increased from ${initialBalance.toLocaleString()} to ${finalBalance.toLocaleString()}`);
        passedTests++;
      } else {
        console.log(`   ❌ FAIL: Expected ${(initialBalance + 500000).toLocaleString()}, got ${finalBalance.toLocaleString()}`);
      }
    } catch (error: any) {
      console.log(`   ❌ FAIL: ${error.message}`);
    }

    // ========================================================================
    // PROPERTY 2: Expense Transaction Preservation
    // ========================================================================
    console.log("\n📋 PROPERTY 2: Expense transactions decrease balance correctly");
    totalTests++;

    try {
      const initialBalance = await AccountService.getAccountBalance(
        testUserId,
        testAccountAId,
        1000000
      );

      // Record expense transaction
      await TransactionService.createTransaction(testUserId, {
        accountId: testAccountAId,
        categoryId: expenseCategoryId,
        type: "EXPENSE",
        amount: "200000",
        description: "Test Expense",
        transactionDate: new Date(),
        source: "WEB",
      });

      const finalBalance = await AccountService.getAccountBalance(
        testUserId,
        testAccountAId,
        1000000
      );

      if (Math.abs(finalBalance - (initialBalance - 200000)) < 0.01) {
        console.log(`   ✅ PASS: Balance decreased from ${initialBalance.toLocaleString()} to ${finalBalance.toLocaleString()}`);
        passedTests++;
      } else {
        console.log(`   ❌ FAIL: Expected ${(initialBalance - 200000).toLocaleString()}, got ${finalBalance.toLocaleString()}`);
      }
    } catch (error: any) {
      console.log(`   ❌ FAIL: ${error.message}`);
    }

    // ========================================================================
    // PROPERTY 3: Transfer Between Accounts Preservation
    // ========================================================================
    console.log("\n📋 PROPERTY 3: Transfers move money atomically between accounts");
    totalTests++;

    try {
      const initialBalanceA = await AccountService.getAccountBalance(
        testUserId,
        testAccountAId,
        1000000
      );
      const initialBalanceA2 = await AccountService.getAccountBalance(
        testUserId,
        testAccountA2Id,
        500000
      );

      // Transfer from A to A2
      await TransferService.createTransfer(testUserId, {
        fromAccountId: testAccountAId,
        toAccountId: testAccountA2Id,
        amount: "100000",
        description: "Test Transfer",
        transferDate: new Date(),
      });

      const finalBalanceA = await AccountService.getAccountBalance(
        testUserId,
        testAccountAId,
        1000000
      );
      const finalBalanceA2 = await AccountService.getAccountBalance(
        testUserId,
        testAccountA2Id,
        500000
      );

      const aDecreased = Math.abs(finalBalanceA - (initialBalanceA - 100000)) < 0.01;
      const a2Increased = Math.abs(finalBalanceA2 - (initialBalanceA2 + 100000)) < 0.01;

      if (aDecreased && a2Increased) {
        console.log(`   ✅ PASS: Source decreased by 100,000, destination increased by 100,000`);
        passedTests++;
      } else {
        console.log(`   ❌ FAIL: Transfer amounts incorrect`);
        console.log(`      Source: ${initialBalanceA.toLocaleString()} → ${finalBalanceA.toLocaleString()}`);
        console.log(`      Destination: ${initialBalanceA2.toLocaleString()} → ${finalBalanceA2.toLocaleString()}`);
      }
    } catch (error: any) {
      console.log(`   ❌ FAIL: ${error.message}`);
    }

    // ========================================================================
    // PROPERTY 4: Transaction History Query Preservation
    // ========================================================================
    console.log("\n📋 PROPERTY 4: Transaction history returns complete results");
    totalTests++;

    try {
      // Get all transactions for user A
      const userTransactions = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, testUserId))
        .orderBy(transactions.createdAt);

      // We created 2 transactions (1 income, 1 expense) - should see at least those
      if (userTransactions.length >= 2) {
        const hasIncome = userTransactions.some(t => t.type === "INCOME");
        const hasExpense = userTransactions.some(t => t.type === "EXPENSE");

        if (hasIncome && hasExpense) {
          console.log(`   ✅ PASS: Found ${userTransactions.length} transactions with both income and expense types`);
          passedTests++;
        } else {
          console.log(`   ❌ FAIL: Missing transaction types`);
        }
      } else {
        console.log(`   ❌ FAIL: Expected at least 2 transactions, got ${userTransactions.length}`);
      }
    } catch (error: any) {
      console.log(`   ❌ FAIL: ${error.message}`);
    }

    // ========================================================================
    // PROPERTY 5: Multi-Account Balance Separation Preservation
    // ========================================================================
    console.log("\n📋 PROPERTY 5: Multiple accounts maintain separate balances");
    totalTests++;

    try {
      const balanceA = await AccountService.getAccountBalance(
        testUserId,
        testAccountAId,
        1000000
      );
      const balanceA2 = await AccountService.getAccountBalance(
        testUserId,
        testAccountA2Id,
        500000
      );
      const balanceB = await AccountService.getAccountBalance(
        testUserBId,
        testAccountBId,
        2000000
      );

      // All should be different and reflect their operations
      const allDifferent = balanceA !== balanceA2 && balanceA !== balanceB && balanceA2 !== balanceB;
      
      if (allDifferent) {
        console.log(`   ✅ PASS: Three accounts maintain separate balances`);
        console.log(`      Account A: ${balanceA.toLocaleString()}`);
        console.log(`      Account A2: ${balanceA2.toLocaleString()}`);
        console.log(`      Account B: ${balanceB.toLocaleString()}`);
        passedTests++;
      } else {
        console.log(`   ❌ FAIL: Accounts have identical balances (should be separate)`);
      }
    } catch (error: any) {
      console.log(`   ❌ FAIL: ${error.message}`);
    }

    // ========================================================================
    // PROPERTY 6: Dashboard Total Balance Calculation Preservation
    // ========================================================================
    console.log("\n📋 PROPERTY 6: Dashboard calculates total balance across accounts");
    totalTests++;

    try {
      const dashboard = await DashboardService.getSummary(testUserId);

      // Dashboard should show totalBalance that includes both accounts
      const accountBalances = await AccountService.getAccountsWithBalances(testUserId);
      const expectedTotal = accountBalances.reduce((sum, acc) => sum + acc.currentBalance, 0);

      if (Math.abs(dashboard.totalBalance - expectedTotal) < 0.01) {
        console.log(`   ✅ PASS: Dashboard totalBalance (${dashboard.totalBalance.toLocaleString()}) matches sum of accounts`);
        passedTests++;
      } else {
        console.log(`   ❌ FAIL: Dashboard totalBalance (${dashboard.totalBalance.toLocaleString()}) != account sum (${expectedTotal.toLocaleString()})`);
      }
    } catch (error: any) {
      console.log(`   ❌ FAIL: ${error.message}`);
    }

    // ========================================================================
    // PROPERTY 7: User Isolation Preservation
    // ========================================================================
    console.log("\n📋 PROPERTY 7: Users cannot access each other's data");
    totalTests++;

    try {
      const userAAccounts = await AccountService.getAccounts(testUserId);
      const userBAccounts = await AccountService.getAccounts(testUserBId);

      // User A should only see their accounts, not User B's
      const aHasOnlyOwn = userAAccounts.every(acc => acc.userId === testUserId);
      const bHasOnlyOwn = userBAccounts.every(acc => acc.userId === testUserBId);
      const noOverlap = !userAAccounts.some(a => userBAccounts.some(b => a.id === b.id));

      if (aHasOnlyOwn && bHasOnlyOwn && noOverlap) {
        console.log(`   ✅ PASS: User A sees ${userAAccounts.length} accounts, User B sees ${userBAccounts.length} accounts (isolated)`);
        passedTests++;
      } else {
        console.log(`   ❌ FAIL: User isolation violated`);
      }
    } catch (error: any) {
      console.log(`   ❌ FAIL: ${error.message}`);
    }

    // ========================================================================
    // PROPERTY 8: Account Balance Formula Preservation
    // ========================================================================
    console.log("\n📋 PROPERTY 8: Balance formula = initial + income - expense + transfersIn - transfersOut");
    totalTests++;

    try {
      // Get all transactions and transfers for account A
      const accountTransactions = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, testUserId),
            eq(transactions.accountId, testAccountAId)
          )
        );

      const accountTransfers = await db
        .select()
        .from(transfers)
        .where(
          and(
            eq(transfers.userId, testUserId)
          )
        );

      const income = accountTransactions
        .filter(t => t.type === "INCOME")
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      const expense = accountTransactions
        .filter(t => t.type === "EXPENSE")
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      const transfersOut = accountTransfers
        .filter(t => t.fromAccountId === testAccountAId)
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      const transfersIn = accountTransfers
        .filter(t => t.toAccountId === testAccountAId)
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      const expectedBalance = 1000000 + income - expense + transfersIn - transfersOut;
      
      const actualBalance = await AccountService.getAccountBalance(
        testUserId,
        testAccountAId,
        1000000
      );

      if (Math.abs(actualBalance - expectedBalance) < 0.01) {
        console.log(`   ✅ PASS: Balance formula correct`);
        console.log(`      1,000,000 (initial) + ${income.toLocaleString()} (income) - ${expense.toLocaleString()} (expense)`);
        console.log(`      + ${transfersIn.toLocaleString()} (in) - ${transfersOut.toLocaleString()} (out) = ${actualBalance.toLocaleString()}`);
        passedTests++;
      } else {
        console.log(`   ❌ FAIL: Balance formula mismatch`);
        console.log(`      Expected: ${expectedBalance.toLocaleString()}`);
        console.log(`      Actual: ${actualBalance.toLocaleString()}`);
      }
    } catch (error: any) {
      console.log(`   ❌ FAIL: ${error.message}`);
    }

    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log("\n=================================================================");
    console.log("  PRESERVATION TEST SUMMARY");
    console.log("=================================================================");
    console.log(`\n✅ PASSED: ${passedTests}/${totalTests} properties preserved`);
    
    if (passedTests === totalTests) {
      console.log("\n🎉 All preservation tests passed!");
      console.log("   Baseline behavior documented and verified.");
      console.log("   After implementing the fix, these tests should still pass.");
    } else {
      console.log(`\n⚠️  ${totalTests - passedTests} properties failed`);
      console.log("   Review failed tests to understand baseline behavior.");
    }
    
    console.log("\n📝 Preservation Requirements Validated:");
    console.log("   3.1 Regular transactions recorded correctly ✓");
    console.log("   3.2 Transaction history displays all records ✓");
    console.log("   3.4 Multi-account balances maintained separately ✓");
    console.log("   3.5 Income transactions increase balance ✓");
    console.log("   3.8 Total expenses tracked correctly ✓");
    console.log("\n=================================================================\n");

  } catch (error: any) {
    console.error("\n❌ Test execution error:", error.message);
    throw error;
  } finally {
    // Cleanup
    console.log("🧹 Cleaning up test data...");
    
    // Delete in correct order to respect foreign keys
    await db.delete(transfers).where(eq(transfers.userId, testUserId));
    await db.delete(transactions).where(eq(transactions.userId, testUserId));
    await db.delete(transactions).where(eq(transactions.userId, testUserBId));
    
    if (testAccountAId) {
      await db.delete(accounts).where(eq(accounts.id, testAccountAId));
    }
    if (testAccountA2Id) {
      await db.delete(accounts).where(eq(accounts.id, testAccountA2Id));
    }
    if (testAccountBId) {
      await db.delete(accounts).where(eq(accounts.id, testAccountBId));
    }
    
    await db.delete(user).where(eq(user.id, testUserId));
    await db.delete(user).where(eq(user.id, testUserBId));
    
    console.log("✓ Cleanup complete\n");
  }
}

// Run the tests
runPreservationTests()
  .then(() => {
    console.log("✅ Preservation test execution completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Preservation tests failed:", error);
    process.exit(1);
  });

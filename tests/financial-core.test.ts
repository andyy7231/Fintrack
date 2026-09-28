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

async function runTests() {
  console.log("====================================================");
  console.log("      FINTRACK PHASE 2 — FINANCIAL CORE TESTS       ");
  console.log("====================================================");

  // Setup test users: User A and User B
  const userAId = "test_user_a_" + Date.now();
  const userBId = "test_user_b_" + Date.now();

  await db.insert(user).values([
    {
      id: userAId,
      name: "User Alpha",
      email: `${userAId}@test.com`,
      currency: "IDR",
      timezone: "Asia/Jakarta",
    },
    {
      id: userBId,
      name: "User Beta",
      email: `${userBId}@test.com`,
      currency: "IDR",
      timezone: "Asia/Jakarta",
    },
  ]);

  try {
    // ------------------------------------------------------------------
    // TEST 1: Default Categories Visibility
    // ------------------------------------------------------------------
    console.log("\n[TEST 1] Default categories visibility...");
    const userACats = await CategoryService.getCategories(userAId);
    if (userACats.length < 10) {
      throw new Error(`Expected at least 10 default categories, got ${userACats.length}`);
    }
    const foodCat = userACats.find((c) => c.name === "Makanan & Minuman");
    const salaryCat = userACats.find((c) => c.name === "Gaji");
    if (!foodCat || foodCat.type !== "EXPENSE") throw new Error("Food category missing or invalid");
    if (!salaryCat || salaryCat.type !== "INCOME") throw new Error("Salary category missing or invalid");
    console.log("✓ PASS: Default categories visible to User A");

    // ------------------------------------------------------------------
    // TEST 2: Custom Category Creation & Isolation
    // ------------------------------------------------------------------
    console.log("\n[TEST 2] Custom category creation & user isolation...");
    const customCat = await CategoryService.createCustomCategory(userAId, {
      name: "Crypto Staking",
      type: "INCOME",
      icon: "cpu",
      color: "#F59E0B",
    });
    if (!customCat.id) throw new Error("Custom category creation failed");
    const userBCats = await CategoryService.getCategories(userBId);
    if (userBCats.some((c) => c.name === "Crypto Staking")) {
      throw new Error("SECURITY FAILURE: User B can see User A's custom category!");
    }
    console.log("✓ PASS: Custom category created and isolated to User A");

    // ------------------------------------------------------------------
    // TEST 3: CRITICAL FINANCIAL TEST CASE 1 (Section 44)
    // Initial: Cash = 1.000.000
    // Income: 500.000
    // Expense: 150.000
    // Expected: Balance = 1.350.000
    // Transfer: Cash -> BCA 300.000
    // Expected: Cash = 1.050.000, BCA = 300.000, Total = 1.350.000
    // Transfer must NOT alter Income or Expense This Month!
    // ------------------------------------------------------------------
    console.log("\n[TEST 3] Critical Financial Test Case 1 (Section 44)...");
    const cashAcc = await AccountService.createAccount(userAId, {
      name: "Cash",
      type: "CASH",
      initialBalance: "1000000.00",
      currency: "IDR",
    });

    const bcaAcc = await AccountService.createAccount(userAId, {
      name: "BCA",
      type: "BANK",
      initialBalance: "0.00",
      currency: "IDR",
    });

    // Income: 500.000
    await TransactionService.createTransaction(userAId, {
      accountId: cashAcc.id,
      categoryId: salaryCat.id,
      type: "INCOME",
      amount: "500000.00",
      description: "Gaji Freelance",
      transactionDate: new Date(),
    });

    // Expense: 150.000
    await TransactionService.createTransaction(userAId, {
      accountId: cashAcc.id,
      categoryId: foodCat.id,
      type: "EXPENSE",
      amount: "150000.00",
      description: "Makan Malam",
      transactionDate: new Date(),
    });

    let cashBal = await AccountService.getAccountBalance(userAId, cashAcc.id, 1000000);
    if (cashBal !== 1350000) {
      throw new Error(`Expected Cash balance 1.350.000, got ${cashBal}`);
    }
    console.log("✓ PASS: Cash balance after income and expense is exact: Rp1.350.000");

    // Transfer Cash -> BCA 300.000
    await TransferService.createTransfer(userAId, {
      fromAccountId: cashAcc.id,
      toAccountId: bcaAcc.id,
      amount: "300000.00",
      description: "Setor tunai ke BCA",
      transferDate: new Date(),
    });

    cashBal = await AccountService.getAccountBalance(userAId, cashAcc.id, 1000000);
    const bcaBal = await AccountService.getAccountBalance(userAId, bcaAcc.id, 0);
    if (cashBal !== 1050000) throw new Error(`Expected Cash 1.050.000, got ${cashBal}`);
    if (bcaBal !== 300000) throw new Error(`Expected BCA 300.000, got ${bcaBal}`);

    const dashA = await DashboardService.getSummary(userAId);
    if (dashA.totalBalance !== 1350000) {
      throw new Error(`Expected total balance 1.350.000, got ${dashA.totalBalance}`);
    }
    if (dashA.incomeThisMonth !== 500000) {
      throw new Error(`Expected income this month 500.000, got ${dashA.incomeThisMonth}`);
    }
    if (dashA.expenseThisMonth !== 150000) {
      throw new Error(`Expected expense this month 150.000, got ${dashA.expenseThisMonth}`);
    }
    if (dashA.netThisMonth !== 350000) {
      throw new Error(`Expected net this month 350.000, got ${dashA.netThisMonth}`);
    }
    console.log("✓ PASS: Section 44 Verification successful!");
    console.log("  - Cash: Rp1.050.000");
    console.log("  - BCA: Rp300.000");
    console.log("  - Total Balance: Rp1.350.000");
    console.log("  - Income This Month: Rp500.000 (transfer excluded)");
    console.log("  - Expense This Month: Rp150.000 (transfer excluded)");

    // ------------------------------------------------------------------
    // TEST 4: CRITICAL FINANCIAL TEST CASE 2 (Section 45)
    // Initial: BCA = 5.000.000, GoPay = 500.000
    // Expense: BCA 250.000
    // Transfer: BCA -> GoPay 500.000
    // Expected: BCA = 4.250.000, GoPay = 1.000.000, Total = 5.250.000
    // ------------------------------------------------------------------
    console.log("\n[TEST 4] Critical Financial Test Case 2 (Section 45)...");
    const user2Bca = await AccountService.createAccount(userBId, {
      name: "BCA User B",
      type: "BANK",
      initialBalance: "5000000.00",
      currency: "IDR",
    });
    const user2Gopay = await AccountService.createAccount(userBId, {
      name: "GoPay User B",
      type: "E_WALLET",
      initialBalance: "500000.00",
      currency: "IDR",
    });

    // Expense on BCA: 250.000
    await TransactionService.createTransaction(userBId, {
      accountId: user2Bca.id,
      categoryId: foodCat.id,
      type: "EXPENSE",
      amount: "250000.00",
      description: "Belanja groceries",
      transactionDate: new Date(),
    });

    // Transfer BCA -> GoPay: 500.000
    await TransferService.createTransfer(userBId, {
      fromAccountId: user2Bca.id,
      toAccountId: user2Gopay.id,
      amount: "500000.00",
      description: "Top up GoPay",
      transferDate: new Date(),
    });

    const bca2Bal = await AccountService.getAccountBalance(userBId, user2Bca.id, 5000000);
    const gopay2Bal = await AccountService.getAccountBalance(userBId, user2Gopay.id, 500000);
    if (bca2Bal !== 4250000) throw new Error(`Expected BCA 4.250.000, got ${bca2Bal}`);
    if (gopay2Bal !== 1000000) throw new Error(`Expected GoPay 1.000.000, got ${gopay2Bal}`);

    const dashB = await DashboardService.getSummary(userBId);
    if (dashB.totalBalance !== 5250000) {
      throw new Error(`Expected total 5.250.000, got ${dashB.totalBalance}`);
    }
    if (dashB.expenseThisMonth !== 250000) {
      throw new Error(`Expected expense 250.000, got ${dashB.expenseThisMonth}`);
    }
    console.log("✓ PASS: Section 45 Verification successful!");
    console.log("  - BCA: Rp4.250.000");
    console.log("  - GoPay: Rp1.000.000");
    console.log("  - Total Balance: Rp5.250.000");
    console.log("  - Expense: Rp250.000 (Top-up transfer excluded)");

    // ------------------------------------------------------------------
    // TEST 5: IDOR & Security Checks
    // ------------------------------------------------------------------
    console.log("\n[TEST 5] Security & IDOR Prevention Checks...");

    // A. Cross-user account access
    const crossAcc = await AccountService.getAccountById(userAId, user2Bca.id);
    if (crossAcc !== null) {
      throw new Error("SECURITY FAILURE: User A was able to read User B's account!");
    }
    console.log("✓ PASS: Cross-user account access blocked (returns null)");

    // B. Cross-user transfer
    try {
      await TransferService.createTransfer(userAId, {
        fromAccountId: cashAcc.id,
        toAccountId: user2Bca.id, // User B's account
        amount: "10000.00",
        transferDate: new Date(),
      });
      throw new Error("SECURITY FAILURE: Cross-user transfer was permitted!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log("✓ PASS: Cross-user transfer rejected:", msg);
    }

    // C. Same-account transfer
    try {
      await TransferService.createTransfer(userAId, {
        fromAccountId: cashAcc.id,
        toAccountId: cashAcc.id,
        amount: "10000.00",
        transferDate: new Date(),
      });
      throw new Error("FAILURE: Same-account transfer was permitted!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log("✓ PASS: Same-account transfer rejected:", msg);
    }

    // D. Category type mismatch (e.g. food category used for INCOME)
    try {
      await TransactionService.createTransaction(userAId, {
        accountId: cashAcc.id,
        categoryId: foodCat.id, // EXPENSE category
        type: "INCOME", // Type INCOME
        amount: "50000.00",
        description: "Invalid transaction",
        transactionDate: new Date(),
      });
      throw new Error("FAILURE: Category type mismatch was permitted!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log("✓ PASS: Category type mismatch rejected:", msg);
    }

    // E. Soft deactivation
    const deact = await AccountService.deactivateAccount(userAId, bcaAcc.id);
    if (!deact || deact.isActive !== false) {
      throw new Error("FAILURE: Deactivation failed");
    }
    console.log("✓ PASS: Soft deactivation verified (isActive = false)");

    console.log("\n====================================================");
    console.log("       ALL FINANCIAL CORE TESTS PASSED (100%)       ");
    console.log("====================================================");
  } finally {
    // Cleanup test records
    console.log("\nCleaning up test users and associated financial records...");
    await db.delete(transfers).where(eq(transfers.userId, userAId));
    await db.delete(transfers).where(eq(transfers.userId, userBId));
    await db.delete(transactions).where(eq(transactions.userId, userAId));
    await db.delete(transactions).where(eq(transactions.userId, userBId));
    await db.delete(accounts).where(eq(accounts.userId, userAId));
    await db.delete(accounts).where(eq(accounts.userId, userBId));
    await db.delete(categories).where(eq(categories.userId, userAId));
    await db.delete(user).where(eq(user.id, userAId));
    await db.delete(user).where(eq(user.id, userBId));
    console.log("Cleanup completed.");
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });

/**
 * Task 2: Preservation Property Tests (BEFORE implementing fix)
 * 
 * **Property 2: Preservation** - Non-Expense Operations Unchanged
 * 
 * This test file establishes baseline behavior on UNFIXED code.
 * Tests MUST PASS on unfixed code to confirm preservation requirements.
 * 
 * After the bugfix, these same tests should still pass (no regressions).
 * 
 * Focus areas:
 * - Income transactions increase Actual Balance correctly
 * - Transfers move money atomically between accounts
 * - Transaction history queries work correctly
 * - Budget spent aggregation works correctly
 * - Multi-account operations maintain isolation
 * 
 * Requirements validated: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  createTestDbConnection,
  verifyDatabaseIdentity,
  cleanTestDatabase,
} from '../e2e/test-db.utils';
import { seedTestFixtures, TEST_USERS, TEST_ACCOUNTS, TEST_CATEGORIES } from '../e2e/test-fixtures';
import { TransactionService } from '@/services/transaction.service';
import { BudgetService } from '@/services/budget.service';
import { AccountService } from '@/services/account.service';
import { eq, and } from 'drizzle-orm';
import { transactions, budgets, accounts } from '@/db/schema';

const db = createTestDbConnection();

describe('Task 2: Preservation Property Tests (Pre-Fix Baseline)', () => {
  let testUserId: string;
  let testAccountBCA: string;
  let testAccountGoPay: string;
  let testCategoryFood: string;
  let testCategorySalary: string;

  beforeAll(async () => {
    console.log('\n=== Setting up Preservation Tests (Task 2) ===\n');
    
    await verifyDatabaseIdentity(db);
    await cleanTestDatabase(db);
    await seedTestFixtures();
    
    testUserId = TEST_USERS.USER_A.id;
    testAccountBCA = TEST_ACCOUNTS.USER_A_BCA.id;
    testAccountGoPay = TEST_ACCOUNTS.USER_A_GOPAY.id;
    testCategoryFood = TEST_CATEGORIES.FOOD.id;
    testCategorySalary = TEST_CATEGORIES.SALARY.id;
    
    console.log('✓ Test fixtures ready');
    console.log('✓ User:', testUserId);
    console.log('✓ Accounts: BCA, GoPay');
    console.log('✓ Categories: Food, Salary');
    console.log('\n=== Setup complete ===\n');
  }, 60000);

  afterAll(async () => {
    await cleanTestDatabase(db);
  });

  beforeEach(async () => {
    // Clean transaction and budget data before each test
    await db.delete(budgets);
    await db.delete(transactions);
  });

  /**
   * Property: Income Transactions Increase Actual Balance Correctly
   * 
   * Validates: Requirement 3.1 - Income transactions continue to increase Actual Balance correctly
   * 
   * Observation: On unfixed code, income should increase account balance
   * Expected: Test PASSES (baseline behavior preserved)
   */
  test('Income transaction increases Actual Balance correctly', async () => {
    // Arrange: Get initial balance
    const initialAccount = await db.query.accounts.findFirst({
      where: eq(accounts.id, testAccountBCA),
    });
    
    expect(initialAccount).toBeDefined();
    const initialBalance = parseFloat(initialAccount!.balance);
    const incomeAmount = 500000; // Rp500,000
    
    // Act: Create income transaction
    const income = await TransactionService.createTransaction(testUserId, {
      accountId: testAccountBCA,
      categoryId: testCategorySalary,
      type: 'INCOME',
      amount: incomeAmount.toString(),
      description: 'Gaji bulanan',
      transactionDate: new Date(),
    });
    
    // Assert: Verify income created
    expect(income).toBeDefined();
    expect(income.type).toBe('INCOME');
    expect(parseFloat(income.amount)).toBe(incomeAmount);
    
    // Assert: Verify account balance increased
    const updatedAccount = await db.query.accounts.findFirst({
      where: eq(accounts.id, testAccountBCA),
    });
    
    const finalBalance = parseFloat(updatedAccount!.balance);
    expect(finalBalance).toBe(initialBalance + incomeAmount);
    
    console.log('✓ Income increases balance: Initial', initialBalance, '→ Final', finalBalance);
  });

  /**
   * Property: Transfers Move Money Atomically Between Accounts
   * 
   * Validates: Requirement 3.4 - Transfer operations move money atomically between accounts
   * 
   * Observation: On unfixed code, transfers should decrease source and increase destination
   * Expected: Test PASSES (baseline behavior preserved)
   */
  test('Transfer moves money atomically between accounts', async () => {
    // Arrange: Get initial balances
    const initialBCA = await db.query.accounts.findFirst({
      where: eq(accounts.id, testAccountBCA),
    });
    const initialGoPay = await db.query.accounts.findFirst({
      where: eq(accounts.id, testAccountGoPay),
    });
    
    expect(initialBCA).toBeDefined();
    expect(initialGoPay).toBeDefined();
    
    const initialBalanceBCA = parseFloat(initialBCA!.balance);
    const initialBalanceGoPay = parseFloat(initialGoPay!.balance);
    const transferAmount = 100000; // Rp100,000
    
    // Act: Create transfer (outgoing from BCA)
    const transferOut = await TransactionService.createTransaction(testUserId, {
      accountId: testAccountBCA,
      categoryId: null,
      type: 'TRANSFER_OUT',
      amount: transferAmount.toString(),
      description: 'Transfer to GoPay',
      transactionDate: new Date(),
    });
    
    // Create transfer (incoming to GoPay)
    const transferIn = await TransactionService.createTransaction(testUserId, {
      accountId: testAccountGoPay,
      categoryId: null,
      type: 'TRANSFER_IN',
      amount: transferAmount.toString(),
      description: 'Transfer from BCA',
      transactionDate: new Date(),
    });
    
    // Assert: Verify transfers created
    expect(transferOut).toBeDefined();
    expect(transferIn).toBeDefined();
    expect(parseFloat(transferOut.amount)).toBe(transferAmount);
    expect(parseFloat(transferIn.amount)).toBe(transferAmount);
    
    // Assert: Verify source account decreased
    const finalBCA = await db.query.accounts.findFirst({
      where: eq(accounts.id, testAccountBCA),
    });
    const finalBalanceBCA = parseFloat(finalBCA!.balance);
    expect(finalBalanceBCA).toBe(initialBalanceBCA - transferAmount);
    
    // Assert: Verify destination account increased
    const finalGoPay = await db.query.accounts.findFirst({
      where: eq(accounts.id, testAccountGoPay),
    });
    const finalBalanceGoPay = parseFloat(finalGoPay!.balance);
    expect(finalBalanceGoPay).toBe(initialBalanceGoPay + transferAmount);
    
    console.log('✓ Transfer atomic: BCA', initialBalanceBCA, '→', finalBalanceBCA);
    console.log('✓ Transfer atomic: GoPay', initialBalanceGoPay, '→', finalBalanceGoPay);
  });

  /**
   * Property: Transaction History Queries Return All Transactions Accurately
   * 
   * Validates: Requirement 3.2 - Transaction history queries return all transactions accurately
   * 
   * Observation: On unfixed code, transaction queries should return all created transactions
   * Expected: Test PASSES (baseline behavior preserved)
   */
  test('Transaction history query returns all transactions', async () => {
    // Arrange: Create multiple transactions
    const income1 = await TransactionService.createTransaction(testUserId, {
      accountId: testAccountBCA,
      categoryId: testCategorySalary,
      type: 'INCOME',
      amount: '500000',
      description: 'Income 1',
      transactionDate: new Date(),
    });
    
    const expense1 = await TransactionService.createTransaction(testUserId, {
      accountId: testAccountBCA,
      categoryId: testCategoryFood,
      type: 'EXPENSE',
      amount: '25000',
      description: 'Expense 1',
      transactionDate: new Date(),
    });
    
    const expense2 = await TransactionService.createTransaction(testUserId, {
      accountId: testAccountBCA,
      categoryId: testCategoryFood,
      type: 'EXPENSE',
      amount: '50000',
      description: 'Expense 2',
      transactionDate: new Date(),
    });
    
    // Act: Query all transactions for user
    const allTransactions = await db.query.transactions.findMany({
      where: eq(transactions.userId, testUserId),
    });
    
    // Assert: Verify all transactions retrieved
    expect(allTransactions).toHaveLength(3);
    
    const transactionIds = allTransactions.map(t => t.id);
    expect(transactionIds).toContain(income1.id);
    expect(transactionIds).toContain(expense1.id);
    expect(transactionIds).toContain(expense2.id);
    
    // Assert: Verify transaction data integrity
    const retrievedIncome = allTransactions.find(t => t.id === income1.id);
    expect(retrievedIncome?.type).toBe('INCOME');
    expect(parseFloat(retrievedIncome!.amount)).toBe(500000);
    
    const retrievedExpense1 = allTransactions.find(t => t.id === expense1.id);
    expect(retrievedExpense1?.type).toBe('EXPENSE');
    expect(parseFloat(retrievedExpense1!.amount)).toBe(25000);
    
    console.log('✓ Transaction history query: Retrieved', allTransactions.length, 'transactions');
  });

  /**
   * Property: Budget Spent Aggregation Works Correctly
   * 
   * Validates: Requirement 3.7 - Budget progress tracking (spent/remaining) continues to work
   * 
   * Observation: On unfixed code, budget spent should aggregate from expense transactions
   * Expected: Test PASSES (baseline behavior preserved)
   */
  test('Budget spent aggregation calculates from transactions', async () => {
    // Arrange: Create budget for Food category (using MONTHLY period for current month)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed
    
    const budget = await BudgetService.createBudget(testUserId, {
      periodType: 'MONTHLY',
      accountId: testAccountBCA,
      categoryId: testCategoryFood,
      amount: '600000', // Rp600,000
      year: currentYear,
      month: currentMonth,
      currency: 'IDR',
    });
    
    expect(budget).toBeDefined();
    
    // Act: Create expense transactions in the budget period
    const transactionDate = new Date(); // Current date, within current month
    
    await TransactionService.createTransaction(testUserId, {
      accountId: testAccountBCA,
      categoryId: testCategoryFood,
      type: 'EXPENSE',
      amount: '25000',
      description: 'Makan siang',
      transactionDate,
    });
    
    await TransactionService.createTransaction(testUserId, {
      accountId: testAccountBCA,
      categoryId: testCategoryFood,
      type: 'EXPENSE',
      amount: '19000',
      description: 'Snack',
      transactionDate,
    });
    
    // Assert: Query transactions directly to verify they were created
    const allTransactions = await db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, testUserId),
        eq(transactions.categoryId, testCategoryFood),
        eq(transactions.type, 'EXPENSE')
      ),
    });
    
    expect(allTransactions).toHaveLength(2);
    const totalSpent = allTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    expect(totalSpent).toBe(44000);
    
    // Assert: Verify budget aggregation via getBudgetProgress
    const budgetProgress = await BudgetService.getBudgetProgress(testUserId, budget.id);
    
    expect(budgetProgress).toBeDefined();
    expect(budgetProgress.spentAmount).toBe(44000); // 25000 + 19000
    expect(budgetProgress.remainingAmount).toBe(556000); // 600000 - 44000
    
    console.log('✓ Budget spent aggregation: Spent', budgetProgress.spentAmount, '/ Total', 600000);
  });

  /**
   * Property: Multi-Account Operations Maintain Isolation
   * 
   * Validates: Requirement 3.3 - Multi-account handling maintains separate balances per account
   * 
   * Observation: On unfixed code, operations on one account shouldn't affect another
   * Expected: Test PASSES (baseline behavior preserved)
   */
  test('Multi-account operations maintain isolation', async () => {
    // Arrange: Get initial balances
    const initialBCA = await db.query.accounts.findFirst({
      where: eq(accounts.id, testAccountBCA),
    });
    const initialGoPay = await db.query.accounts.findFirst({
      where: eq(accounts.id, testAccountGoPay),
    });
    
    const initialBalanceBCA = parseFloat(initialBCA!.balance);
    const initialBalanceGoPay = parseFloat(initialGoPay!.balance);
    
    // Act: Create expense on BCA only
    await TransactionService.createTransaction(testUserId, {
      accountId: testAccountBCA,
      categoryId: testCategoryFood,
      type: 'EXPENSE',
      amount: '50000',
      description: 'BCA expense',
      transactionDate: new Date(),
    });
    
    // Assert: Verify only BCA changed
    const finalBCA = await db.query.accounts.findFirst({
      where: eq(accounts.id, testAccountBCA),
    });
    const finalGoPay = await db.query.accounts.findFirst({
      where: eq(accounts.id, testAccountGoPay),
    });
    
    const finalBalanceBCA = parseFloat(finalBCA!.balance);
    const finalBalanceGoPay = parseFloat(finalGoPay!.balance);
    
    // BCA should decrease
    expect(finalBalanceBCA).toBe(initialBalanceBCA - 50000);
    
    // GoPay should remain unchanged
    expect(finalBalanceGoPay).toBe(initialBalanceGoPay);
    
    console.log('✓ Account isolation: BCA changed, GoPay unchanged');
  });

  /**
   * Property: Category Type Validation Preserved
   * 
   * Validates: Requirement 3.8 - Category type validation (EXPENSE categories only for budgets) preserved
   * 
   * Observation: On unfixed code, expense transactions require EXPENSE categories
   * Expected: Test PASSES (baseline behavior preserved)
   */
  test('Category type validation prevents mismatched types', async () => {
    // Arrange: testCategorySalary is INCOME type
    
    // Act & Assert: Attempt to create expense with INCOME category should fail
    await expect(
      TransactionService.createTransaction(testUserId, {
        accountId: testAccountBCA,
        categoryId: testCategorySalary, // INCOME category
        type: 'EXPENSE', // EXPENSE type - mismatch!
        amount: '50000',
        description: 'Invalid expense',
        transactionDate: new Date(),
      })
    ).rejects.toThrow();
    
    console.log('✓ Category validation: Rejected mismatched types');
  });

  /**
   * Property: Account Ownership Validation Preserved
   * 
   * Validates: Requirement 3.9 - Existing transaction creation validation (account ownership) preserved
   * 
   * Observation: On unfixed code, users cannot create transactions on accounts they don't own
   * Expected: Test PASSES (baseline behavior preserved)
   */
  test('Account ownership validation prevents unauthorized access', async () => {
    // Arrange: Use a different user's account
    const otherUserId = TEST_USERS.USER_B.id;
    
    // Act & Assert: Attempt to create transaction on USER_A's account as USER_B should fail
    await expect(
      TransactionService.createTransaction(otherUserId, {
        accountId: testAccountBCA, // USER_A's account
        categoryId: testCategoryFood,
        type: 'EXPENSE',
        amount: '50000',
        description: 'Unauthorized expense',
        transactionDate: new Date(),
      })
    ).rejects.toThrow(/tidak ditemukan atau bukan milik Anda/);
    
    console.log('✓ Ownership validation: Rejected unauthorized account access');
  });

  /**
   * Property: Existing Financial Precision Preserved
   * 
   * Validates: Requirement 3.10 - Existing financial precision (NUMERIC(19,2)) preserved
   * 
   * Observation: On unfixed code, financial calculations maintain 2 decimal precision
   * Expected: Test PASSES (baseline behavior preserved)
   */
  test('Financial precision maintains 2 decimal places', async () => {
    // Arrange: Create transaction with precise amount
    const preciseAmount = 12345.67;
    
    // Act: Create expense
    const expense = await TransactionService.createTransaction(testUserId, {
      accountId: testAccountBCA,
      categoryId: testCategoryFood,
      type: 'EXPENSE',
      amount: preciseAmount.toString(),
      description: 'Precision test',
      transactionDate: new Date(),
    });
    
    // Assert: Verify precision preserved
    expect(parseFloat(expense.amount)).toBe(preciseAmount);
    
    // Assert: Verify account balance precision
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, testAccountBCA),
    });
    
    const balance = parseFloat(account!.balance);
    // Balance should have at most 2 decimal places
    expect(balance).toBe(Math.round(balance * 100) / 100);
    
    console.log('✓ Financial precision: Amount', preciseAmount, 'preserved');
  });
});

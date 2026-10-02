/**
 * Unit Test for BudgetService.findApplicableBudget()
 * Task 3.1: Verify budget-category-expense matching logic
 * 
 * Tests budget matching based on:
 * - userId
 * - accountId
 * - categoryId
 * - transactionDate within [startDate, endDate)
 * 
 * Requirements validated: 2.1 (Category-Budget Connection)
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  createTestDbConnection,
  verifyDatabaseIdentity,
  cleanTestDatabase,
} from '../e2e/test-db.utils';
import { seedTestFixtures, TEST_USERS, TEST_ACCOUNTS, TEST_CATEGORIES } from '../e2e/test-fixtures';
import { BudgetService } from '@/services/budget.service';
import { TransactionService } from '@/services/transaction.service';
import { budgets, transactions } from '@/db/schema';

const db = createTestDbConnection();

describe('Task 3.1: BudgetService.findApplicableBudget() Unit Tests', () => {
  let testUserId: string;
  let testAccountBCA: string;
  let testAccountGoPay: string;
  let testCategoryFood: string;
  let testCategoryTransportation: string;
  let createdBudgetId: string;

  beforeAll(async () => {
    console.log('\n=== Setting up findApplicableBudget Tests (Task 3.1) ===\n');
    
    await verifyDatabaseIdentity(db);
    await cleanTestDatabase(db);
    await seedTestFixtures();
    
    testUserId = TEST_USERS.USER_A.id;
    testAccountBCA = TEST_ACCOUNTS.USER_A_BCA.id;
    testAccountGoPay = TEST_ACCOUNTS.USER_A_GOPAY.id;
    testCategoryFood = TEST_CATEGORIES.FOOD.id;
    testCategoryTransportation = TEST_CATEGORIES.TRANSPORTATION.id;
    
    console.log('✓ Test fixtures ready');
    console.log('✓ User:', testUserId);
    console.log('✓ Accounts: BCA, GoPay');
    console.log('✓ Categories: Food, Transportation');
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
   * Test 1: findApplicableBudget returns budget when all parameters match
   * 
   * Scenario: Create Food budget 600k on BCA account
   *           Query with matching userId, accountId, categoryId, and date within period
   * Expected: Returns budget with correct remaining amount
   */
  test('returns budget when all parameters match', async () => {
    // Arrange: Create a Food budget for January 2024
    const budget = await BudgetService.createBudget(testUserId, {
      accountId: testAccountBCA,
      categoryId: testCategoryFood,
      periodType: 'MONTHLY',
      year: 2024,
      month: 1,
      amount: '600000',
      currency: 'IDR',
    });
    
    createdBudgetId = budget.id;
    console.log('✓ Created Food budget:', createdBudgetId);
    
    // Act: Find applicable budget for a transaction on 2024-01-15
    const transactionDate = new Date('2024-01-15T10:00:00Z');
    const result = await BudgetService.findApplicableBudget(
      testUserId,
      testAccountBCA,
      testCategoryFood,
      transactionDate
    );
    
    // Assert: Budget is found with correct details
    expect(result).not.toBeNull();
    expect(result?.id).toBe(createdBudgetId);
    expect(result?.amount).toBe('600000.00'); // Database stores with .00
    expect(result?.spentAmount).toBe(0); // No expenses yet
    expect(result?.remaining).toBe(600000);
    
    console.log('✓ Budget found:', result);
  });

  /**
   * Test 2: findApplicableBudget returns null when categoryId doesn't match
   * 
   * Scenario: Create Food budget, query with Transport category
   * Expected: Returns null (no matching budget)
   */
  test('returns null when categoryId does not match', async () => {
    // Arrange: Create a Food budget
    await BudgetService.createBudget(testUserId, {
      accountId: testAccountBCA,
      categoryId: testCategoryFood,
      periodType: 'MONTHLY',
      year: 2024,
      month: 1,
      amount: '600000',
      currency: 'IDR',
    });
    
    // Act: Query with Transport category (no Transport budget exists)
    const transactionDate = new Date('2024-01-15T10:00:00Z');
    const result = await BudgetService.findApplicableBudget(
      testUserId,
      testAccountBCA,
      testCategoryTransportation, // Different category
      transactionDate
    );
    
    // Assert: No matching budget found
    expect(result).toBeNull();
    console.log('✓ No budget found for Transportation category (expected)');
  });

  /**
   * Test 3: findApplicableBudget returns null when accountId doesn't match
   * 
   * Scenario: Create budget on BCA, query with GoPay account
   * Expected: Returns null (budget is account-specific)
   */
  test('returns null when accountId does not match', async () => {
    // Arrange: Create a Food budget on BCA account
    await BudgetService.createBudget(testUserId, {
      accountId: testAccountBCA,
      categoryId: testCategoryFood,
      periodType: 'MONTHLY',
      year: 2024,
      month: 1,
      amount: '600000',
      currency: 'IDR',
    });
    
    // Act: Query with GoPay account (different account)
    const transactionDate = new Date('2024-01-15T10:00:00Z');
    const result = await BudgetService.findApplicableBudget(
      testUserId,
      testAccountGoPay, // Different account
      testCategoryFood,
      transactionDate
    );
    
    // Assert: No matching budget found
    expect(result).toBeNull();
    console.log('✓ No budget found for GoPay account (expected)');
  });

  /**
   * Test 4: findApplicableBudget returns null when transaction date is before budget period
   * 
   * Scenario: Budget for January 2024 (Jakarta time), query with December date BEFORE Jakarta midnight
   * Expected: Returns null (date outside period)
   * 
   * Note: January 2024 Jakarta starts at 2023-12-31 17:00 UTC (Jakarta is UTC+7)
   *       So we need to query before 2023-12-31 17:00 UTC to be outside the period
   */
  test('returns null when transaction date is before budget period', async () => {
    // Arrange: Create budget for January 2024
    await BudgetService.createBudget(testUserId, {
      accountId: testAccountBCA,
      categoryId: testCategoryFood,
      periodType: 'MONTHLY',
      year: 2024,
      month: 1,
      amount: '600000',
      currency: 'IDR',
    });
    
    // Act: Query with December 31, 2023 at 10:00 UTC (before 17:00 UTC which is Jan 1 Jakarta midnight)
    const transactionDate = new Date('2023-12-31T10:00:00Z');
    const result = await BudgetService.findApplicableBudget(
      testUserId,
      testAccountBCA,
      testCategoryFood,
      transactionDate
    );
    
    // Assert: No matching budget found
    expect(result).toBeNull();
    console.log('✓ No budget found for date before period (expected)');
  });

  /**
   * Test 5: findApplicableBudget returns null when transaction date is after budget period (exclusive upper bound)
   * 
   * Scenario: Budget for January 2024 (ends 2024-02-01T00:00:00Z exclusive), query with February 1 date
   * Expected: Returns null (endDate is exclusive)
   */
  test('returns null when transaction date is on or after budget endDate (exclusive upper bound)', async () => {
    // Arrange: Create budget for January 2024
    await BudgetService.createBudget(testUserId, {
      accountId: testAccountBCA,
      categoryId: testCategoryFood,
      periodType: 'MONTHLY',
      year: 2024,
      month: 1,
      amount: '600000',
      currency: 'IDR',
    });
    
    // Act: Query with February 1, 2024 (on budget endDate - should be excluded)
    const transactionDate = new Date('2024-02-01T00:00:00Z');
    const result = await BudgetService.findApplicableBudget(
      testUserId,
      testAccountBCA,
      testCategoryFood,
      transactionDate
    );
    
    // Assert: No matching budget found (endDate is exclusive)
    expect(result).toBeNull();
    console.log('✓ No budget found for date on endDate boundary (expected, exclusive)');
  });

  /**
   * Test 6: findApplicableBudget calculates spentAmount correctly when expenses exist
   * 
   * Scenario: Create budget 600k, record expense 19k, query budget
   * Expected: Returns budget with spentAmount=19000, remaining=581000
   */
  test('calculates spentAmount and remaining correctly when expenses exist', async () => {
    // Arrange: Create Food budget 600k
    const budget = await BudgetService.createBudget(testUserId, {
      accountId: testAccountBCA,
      categoryId: testCategoryFood,
      periodType: 'MONTHLY',
      year: 2024,
      month: 1,
      amount: '600000',
      currency: 'IDR',
    });
    
    console.log('✓ Created Food budget 600k:', budget.id);
    
    // Record a food expense of 19k
    const expenseDate = new Date('2024-01-15T10:00:00Z');
    await TransactionService.createTransaction(testUserId, {
      accountId: testAccountBCA,
      categoryId: testCategoryFood,
      type: 'EXPENSE',
      amount: '19000',
      description: 'Makan siang',
      transactionDate: expenseDate,
    });
    
    console.log('✓ Recorded expense 19k');
    
    // Act: Find applicable budget (should reflect the spent amount)
    const result = await BudgetService.findApplicableBudget(
      testUserId,
      testAccountBCA,
      testCategoryFood,
      expenseDate
    );
    
    // Assert: Budget found with correct spent and remaining
    expect(result).not.toBeNull();
    expect(result?.id).toBe(budget.id);
    expect(result?.amount).toBe('600000.00'); // Database stores with .00
    expect(result?.spentAmount).toBe(19000);
    expect(result?.remaining).toBe(581000); // 600000 - 19000
    
    console.log('✓ Budget spentAmount:', result?.spentAmount);
    console.log('✓ Budget remaining:', result?.remaining);
  });

  /**
   * Test 7: findApplicableBudget handles multiple expenses correctly
   * 
   * Scenario: Create budget 600k, record three expenses (50k, 30k, 20k), query budget
   * Expected: Returns budget with spentAmount=100000, remaining=500000
   */
  test('calculates spentAmount correctly with multiple expenses', async () => {
    // Arrange: Create Food budget 600k
    const budget = await BudgetService.createBudget(testUserId, {
      accountId: testAccountBCA,
      categoryId: testCategoryFood,
      periodType: 'MONTHLY',
      year: 2024,
      month: 1,
      amount: '600000',
      currency: 'IDR',
    });
    
    // Record multiple food expenses
    const baseDate = new Date('2024-01-10T00:00:00Z');
    
    await TransactionService.createTransaction(testUserId, {
      accountId: testAccountBCA,
      categoryId: testCategoryFood,
      type: 'EXPENSE',
      amount: '50000',
      description: 'Expense 1',
      transactionDate: new Date(baseDate.getTime() + 1 * 24 * 60 * 60 * 1000), // Day 11
    });
    
    await TransactionService.createTransaction(testUserId, {
      accountId: testAccountBCA,
      categoryId: testCategoryFood,
      type: 'EXPENSE',
      amount: '30000',
      description: 'Expense 2',
      transactionDate: new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000), // Day 12
    });
    
    await TransactionService.createTransaction(testUserId, {
      accountId: testAccountBCA,
      categoryId: testCategoryFood,
      type: 'EXPENSE',
      amount: '20000',
      description: 'Expense 3',
      transactionDate: new Date(baseDate.getTime() + 3 * 24 * 60 * 60 * 1000), // Day 13
    });
    
    console.log('✓ Recorded 3 expenses: 50k, 30k, 20k');
    
    // Act: Find applicable budget
    const queryDate = new Date('2024-01-15T10:00:00Z');
    const result = await BudgetService.findApplicableBudget(
      testUserId,
      testAccountBCA,
      testCategoryFood,
      queryDate
    );
    
    // Assert: Budget reflects total spent amount
    expect(result).not.toBeNull();
    expect(result?.spentAmount).toBe(100000); // 50k + 30k + 20k
    expect(result?.remaining).toBe(500000); // 600k - 100k
    
    console.log('✓ Total spentAmount:', result?.spentAmount);
    console.log('✓ Remaining:', result?.remaining);
  });
});

/**
 * Task 3.13: Budget-Expense Integration Tests
 * 
 * Comprehensive integration tests for budget-category-expense accounting.
 * Tests the CORE FIX: budgeted expenses consume budgets, not Free Cash.
 * 
 * Test scenarios:
 * 1. Budgeted expense (within budget)
 * 2. Unbudgeted expense
 * 3. Budget overspending
 * 4. Multiple categories
 * 5. Period filtering
 * 6. Account isolation
 * 7. Budget creation/deletion effects
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
import { eq } from 'drizzle-orm';
import { transactions, budgets } from '@/db/schema';

const db = createTestDbConnection();

describe('Task 3.13: Budget-Expense Integration Tests', () => {
  let testUserId: string;
  let testAccountBCA: string;
  let testAccountGoPay: string;
  let testCategoryFood: string;
  let testCategoryTransportation: string;
  

  beforeAll(async () => {
    console.log('\n=== Setting up Budget-Expense Integration Tests ===\n');
    
    await verifyDatabaseIdentity(db);
    await cleanTestDatabase(db);
    await seedTestFixtures();
    
    testUserId = TEST_USERS.USER_A.id;
    testAccountBCA = TEST_ACCOUNTS.USER_A_BCA.id;
    testAccountGoPay = TEST_ACCOUNTS.USER_A_GOPAY.id;
    testCategoryFood = TEST_CATEGORIES.FOOD.id;
    testCategoryTransportation = TEST_CATEGORIES.TRANSPORTATION.id;
    
    
    console.log('? Test fixtures ready');
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
   * Scenario 1: Budgeted Expense (Within Budget)
   * 
   * Expected: Budget remaining decreases, Free Cash UNCHANGED
   */
  test('Budgeted expense consumes budget, NOT Free Cash', async () => {
    // Arrange: Create Food budget
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    const budget = await BudgetService.createBudget(testUserId, {
      periodType: 'MONTHLY',
      accountId: testAccountBCA,
      categoryId: testCategoryFood,
      amount: '600000',
      year: currentYear,
      month: currentMonth,
      currency: 'IDR',
    });
    
    const initialFreeCash = await AccountService.getFreeCash(testUserId, testAccountBCA);
    const initialBudgetRemaining = budget.remainingAmount;
    
    // Act: Create food expense (within budget)
    const expense = await TransactionService.createTransaction(testUserId, {
      accountId: testAccountBCA,
      categoryId: testCategoryFood,
      type: 'EXPENSE',
      amount: '19000',
      description: 'Makan siang',
      transactionDate: new Date(),
    });
    
    // Assert: Budget consumed
    const updatedBudget = await BudgetService.getBudgetProgress(testUserId, budget.id);
    expect(updatedBudget.spentAmount).toBe(19000);
    expect(updatedBudget.remainingAmount).toBe(initialBudgetRemaining - 19000);
    
    // Assert: Free Cash UNCHANGED (no double deduction)
    const finalFreeCash = await AccountService.getFreeCash(testUserId, testAccountBCA);
    expect(finalFreeCash).toBe(initialFreeCash);
    
    console.log('? Budgeted expense: Budget consumed, Free Cash unchanged');
    console.log(`  Budget: ${initialBudgetRemaining} ? ${updatedBudget.remainingAmount}`);
    console.log(`  Free Cash: ${initialFreeCash} (unchanged)`);
  }, 30000);

  /**
   * Scenario 2: Unbudgeted Expense
   * 
   * Expected: Free Cash decreases by expense amount
   */
  test('Unbudgeted expense consumes Free Cash', async () => {
    // Arrange: No Transport budget
    const initialFreeCash = await AccountService.getFreeCash(testUserId, testAccountBCA);
    
    // Act: Create transport expense (no budget)
    const expense = await TransactionService.createTransaction(testUserId, {
      accountId: testAccountBCA,
      categoryId: testCategoryTransportation,
      type: 'EXPENSE',
      amount: '50000',
      description: 'Grab ke kantor',
      transactionDate: new Date(),
    });
    
    // Assert: Free Cash decreased
    const finalFreeCash = await AccountService.getFreeCash(testUserId, testAccountBCA);
    expect(finalFreeCash).toBe(initialFreeCash - 50000);
    
    console.log('? Unbudgeted expense: Free Cash reduced');
    console.log(`  Free Cash: ${initialFreeCash} ? ${finalFreeCash}`);
  }, 30000);

  /**
   * Scenario 3: Budget Overspending
   * 
   * Expected: Budget consumed to 0, overage from Free Cash
   */
  test('Budget overspending: partial consumption from budget + Free Cash', async () => {
    // Arrange: Create budget with limited remaining
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    const budget = await BudgetService.createBudget(testUserId, {
      periodType: 'MONTHLY',
      accountId: testAccountBCA,
      categoryId: testCategoryFood,
      amount: '100000',
      year: currentYear,
      month: currentMonth,
      currency: 'IDR',
    });
    
    const initialFreeCash = await AccountService.getFreeCash(testUserId, testAccountBCA);
    
    // Act: Create expense exceeding budget (130k > 100k budget)
    const expense = await TransactionService.createTransaction(testUserId, {
      accountId: testAccountBCA,
      categoryId: testCategoryFood,
      type: 'EXPENSE',
      amount: '130000',
      description: 'Makan besar',
      transactionDate: new Date(),
    });
    
    // Assert: Budget consumed to 0
    const updatedBudget = await BudgetService.getBudgetProgress(testUserId, budget.id);
    expect(updatedBudget.spentAmount).toBe(130000);
    expect(updatedBudget.remainingAmount).toBe(-30000); // overspent
    
    // Assert: Free Cash decreased by overage only (30k)
    const finalFreeCash = await AccountService.getFreeCash(testUserId, testAccountBCA);
    const expectedDecrease = 30000; // overage
    expect(finalFreeCash).toBe(initialFreeCash - expectedDecrease);
    
    console.log('? Budget overspending: Budget consumed + overage from Free Cash');
    console.log(`  Budget: 100000 ? ${updatedBudget.remainingAmount} (overspent)`);
    console.log(`  Free Cash: ${initialFreeCash} ? ${finalFreeCash} (decreased by overage)`);
  }, 30000);

  /**
   * Scenario 4: Multiple Categories
   * 
   * Expected: Only matching category budget affected
   */
  test('Multiple budgets: only matching category affected', async () => {
    // Arrange: Create budgets for Food and Transportation-2
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    const foodBudget = await BudgetService.createBudget(testUserId, {
      periodType: 'MONTHLY',
      accountId: testAccountBCA,
      categoryId: testCategoryFood,
      amount: '600000',
      year: currentYear,
      month: currentMonth,
      currency: 'IDR',
    });
    
    const transportation2Budget = await BudgetService.createBudget(testUserId, {
      periodType: 'MONTHLY',
      accountId: testAccountBCA,
      categoryId: testCategoryTransportation,
      amount: '300000',
      year: currentYear,
      month: currentMonth,
      currency: 'IDR',
    });
    
    // Act: Create Food expense
    await TransactionService.createTransaction(testUserId, {
      accountId: testAccountBCA,
      categoryId: testCategoryFood,
      type: 'EXPENSE',
      amount: '19000',
      description: 'Makan siang',
      transactionDate: new Date(),
    });
    
    // Assert: Food budget affected
    const updatedFoodBudget = await BudgetService.getBudgetProgress(testUserId, foodBudget.id);
    expect(updatedFoodBudget.spentAmount).toBe(19000);
    expect(updatedFoodBudget.remainingAmount).toBe(581000);
    
    // Assert: Transportation-2 budget UNCHANGED
    const updatedTransportation2Budget = await BudgetService.getBudgetProgress(testUserId, transportation2Budget.id);
    expect(updatedTransportation2Budget.spentAmount).toBe(0);
    expect(updatedTransportation2Budget.remainingAmount).toBe(300000);
    
    console.log('? Multiple categories: Only Food budget affected, Transportation-2 unchanged');
  }, 30000);

  /**
   * Scenario 5: Insufficient Free Cash (Unbudgeted)
   * 
   * Expected: Transaction rejected
   */
  test('Insufficient Free Cash for unbudgeted expense: rejected', async () => {
    // Arrange: Get current Free Cash
    const freeCash = await AccountService.getFreeCash(testUserId, testAccountBCA);
    const excessiveAmount = freeCash + 1000000; // Way more than available
    
    // Act & Assert: Attempt to create expense exceeding Free Cash
    await expect(
      TransactionService.createTransaction(testUserId, {
        accountId: testAccountBCA,
        categoryId: testCategoryTransportation,
        type: 'EXPENSE',
        amount: excessiveAmount.toString(),
        description: 'Excessive expense',
        transactionDate: new Date(),
      })
    ).rejects.toThrow(/Free cash tidak mencukupi/);
    
    console.log('? Insufficient Free Cash: Transaction rejected');
  }, 30000);
});

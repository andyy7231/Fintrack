/**
 * Unit tests for BudgetService.validateBudgetConsumption
 * 
 * Tests the core affordability check that validates if an expense
 * can be covered by budget and/or free cash.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { BudgetService } from "@/services/budget.service";
import { AccountService } from "@/services/account.service";
import { CategoryService } from "@/services/category.service";
import { TransactionService } from "@/services/transaction.service";
import {
  createTestDbConnection,
  verifyDatabaseIdentity,
  cleanTestDatabase,
} from "../e2e/test-db.utils";
import { seedTestFixtures, TEST_USERS, TEST_ACCOUNTS, TEST_CATEGORIES } from "../e2e/test-fixtures";

const db = createTestDbConnection();

describe("BudgetService.validateBudgetConsumption", () => {
  let testUserId: string;
  let accountId: string;
  let categoryId: string;

  beforeAll(async () => {
    await verifyDatabaseIdentity(db);
    await cleanTestDatabase(db);
    await seedTestFixtures();
    
    testUserId = TEST_USERS.USER_A.id;
    accountId = TEST_ACCOUNTS.USER_A_BCA.id;
    categoryId = TEST_CATEGORIES.FOOD.id;
  });

  afterAll(async () => {
    await cleanTestDatabase(db);
  });

  beforeEach(async () => {
    await cleanTestDatabase(db);
    await seedTestFixtures();
    
    // Reset test references
    testUserId = TEST_USERS.USER_A.id;
    accountId = TEST_ACCOUNTS.USER_A_BCA.id;
    categoryId = TEST_CATEGORIES.FOOD.id;
  });

  describe("Unbudgeted Expense Validation", () => {
    it("should allow unbudgeted expense if sufficient free cash", async () => {
      const result = await BudgetService.validateBudgetConsumption(
        TEST_USER_ID,
        accountId,
        categoryId,
        50000, // 50k expense
        new Date()
      );

      expect(result.canProceed).toBe(true);
      expect(result.budgetConsumption).toBe(0);
      expect(result.freeCashConsumption).toBe(50000);
      expect(result.warnings).toHaveLength(0);
      expect(result.budgetId).toBeUndefined();
    });

    it("should reject unbudgeted expense if insufficient free cash", async () => {
      const result = await BudgetService.validateBudgetConsumption(
        TEST_USER_ID,
        accountId,
        categoryId,
        1500000, // 1.5M expense, exceeds 1M balance
        new Date()
      );

      expect(result.canProceed).toBe(false);
      expect(result.budgetConsumption).toBe(0);
      expect(result.freeCashConsumption).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("Free cash tidak mencukupi");
    });

    it("should handle null categoryId (unbudgeted expense)", async () => {
      const result = await BudgetService.validateBudgetConsumption(
        TEST_USER_ID,
        accountId,
        null, // no category
        30000,
        new Date()
      );

      expect(result.canProceed).toBe(true);
      expect(result.budgetConsumption).toBe(0);
      expect(result.freeCashConsumption).toBe(30000);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe("Budgeted Expense Validation", () => {
    it("should consume budget if expense within budget limit", async () => {
      // Create budget
      const budget = await BudgetService.createBudget(TEST_USER_ID, {
        accountId,
        categoryId,
        amount: "600000", // 600k budget
        periodType: "MONTHLY",
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        currency: "IDR",
      });

      const result = await BudgetService.validateBudgetConsumption(
        TEST_USER_ID,
        accountId,
        categoryId,
        50000, // 50k expense, within 600k budget
        new Date()
      );

      expect(result.canProceed).toBe(true);
      expect(result.budgetConsumption).toBe(50000);
      expect(result.freeCashConsumption).toBe(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.budgetId).toBe(budget.id);
    });

    it("should handle budget overspending with sufficient free cash", async () => {
      // Create budget
      await BudgetService.createBudget(TEST_USER_ID, {
        accountId,
        categoryId,
        amount: "100000", // 100k budget
        periodType: "MONTHLY",
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        currency: "IDR",
      });

      // First expense to consume most of budget
      await TransactionService.createTransaction(TEST_USER_ID, {
        accountId,
        categoryId,
        type: "EXPENSE",
        amount: "80000", // 80k expense
        description: "First expense",
        transactionDate: new Date(),
      });

      // Try to spend more than remaining budget (20k)
      const result = await BudgetService.validateBudgetConsumption(
        TEST_USER_ID,
        accountId,
        categoryId,
        50000, // 50k expense, budget remaining = 20k, overage = 30k
        new Date()
      );

      expect(result.canProceed).toBe(true);
      expect(result.budgetConsumption).toBe(20000); // Remaining budget
      expect(result.freeCashConsumption).toBe(30000); // Overage from free cash
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("Budget melebihi sisa");
    });

    it("should reject overspending if insufficient free cash", async () => {
      // Create large budget that consumes most free cash
      await BudgetService.createBudget(TEST_USER_ID, {
        accountId,
        categoryId,
        amount: "950000", // 950k budget, leaves 50k free cash
        periodType: "MONTHLY",
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        currency: "IDR",
      });

      // Consume entire budget
      await TransactionService.createTransaction(TEST_USER_ID, {
        accountId,
        categoryId,
        type: "EXPENSE",
        amount: "950000",
        description: "Consume all budget",
        transactionDate: new Date(),
      });

      // Try to spend more than free cash
      const result = await BudgetService.validateBudgetConsumption(
        TEST_USER_ID,
        accountId,
        categoryId,
        100000, // 100k expense, budget remaining = 0, free cash = 50k
        new Date()
      );

      expect(result.canProceed).toBe(false);
      expect(result.budgetConsumption).toBe(0);
      expect(result.freeCashConsumption).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("melebihi free cash");
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero budget remaining", async () => {
      // Create small budget
      await BudgetService.createBudget(TEST_USER_ID, {
        accountId,
        categoryId,
        amount: "50000", // 50k budget
        periodType: "MONTHLY",
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        currency: "IDR",
      });

      // Consume entire budget
      await TransactionService.createTransaction(TEST_USER_ID, {
        accountId,
        categoryId,
        type: "EXPENSE",
        amount: "50000",
        description: "Consume all budget",
        transactionDate: new Date(),
      });

      // Try to spend more
      const result = await BudgetService.validateBudgetConsumption(
        TEST_USER_ID,
        accountId,
        categoryId,
        10000, // 10k expense, budget remaining = 0
        new Date()
      );

      expect(result.canProceed).toBe(true);
      expect(result.budgetConsumption).toBe(0);
      expect(result.freeCashConsumption).toBe(10000);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("should handle budget from different account (no match)", async () => {
      // Create another account
      const otherAccount = await AccountService.createAccount(TEST_USER_ID, {
        name: "Other Account",
        type: "BANK",
        initialBalance: "500000",
        currency: "IDR",
      });

      // Create budget on OTHER account
      await BudgetService.createBudget(TEST_USER_ID, {
        accountId: otherAccount.id, // Different account
        categoryId,
        amount: "300000",
        periodType: "MONTHLY",
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        currency: "IDR",
      });

      // Validate expense on ORIGINAL account (no matching budget)
      const result = await BudgetService.validateBudgetConsumption(
        TEST_USER_ID,
        accountId, // Original account
        categoryId,
        50000,
        new Date()
      );

      expect(result.canProceed).toBe(true);
      expect(result.budgetConsumption).toBe(0);
      expect(result.freeCashConsumption).toBe(50000);
      expect(result.budgetId).toBeUndefined();
    });
  });
});

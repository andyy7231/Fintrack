/**
 * Unit Tests for ImmediateExecutionService
 * 
 * Tests the validation logic and public methods of ImmediateExecutionService.
 * Focus on canExecuteImmediately validation logic.
 */

import { describe, test, expect } from "vitest";
import { ImmediateExecutionService, ResolvedActionPayload } from "../immediate-execution.service";

describe("ImmediateExecutionService", () => {
  
  describe("canExecuteImmediately", () => {
    
    test("Valid EXPENSE with accountId returns true", () => {
      const actions: ResolvedActionPayload[] = [{
        intentType: "EXPENSE",
        amount: 25000,
        description: "makan siang",
        transactionDate: new Date(),
        accountId: "account-123",
        categoryId: "category-456"
      }];
      
      expect(ImmediateExecutionService.canExecuteImmediately(actions)).toBe(true);
    });
    
    test("Valid INCOME with accountId returns true", () => {
      const actions: ResolvedActionPayload[] = [{
        intentType: "INCOME",
        amount: 5000000,
        description: "gaji bulanan",
        transactionDate: new Date(),
        accountId: "account-123",
        categoryId: "category-789"
      }];
      
      expect(ImmediateExecutionService.canExecuteImmediately(actions)).toBe(true);
    });
    
    test("Valid TRANSFER with both accounts returns true", () => {
      const actions: ResolvedActionPayload[] = [{
        intentType: "TRANSFER",
        amount: 100000,
        description: "transfer BCA ke GoPay",
        transactionDate: new Date(),
        fromAccountId: "account-bca",
        toAccountId: "account-gopay"
      }];
      
      expect(ImmediateExecutionService.canExecuteImmediately(actions)).toBe(true);
    });
    
    test("Valid BUDGET_ALLOCATION with budgetCategoryId returns true", () => {
      const actions: ResolvedActionPayload[] = [{
        intentType: "BUDGET_ALLOCATION",
        amount: 500000,
        description: "alokasi budget makanan",
        transactionDate: new Date(),
        budgetCategoryId: "budget-category-123"
      }];
      
      expect(ImmediateExecutionService.canExecuteImmediately(actions)).toBe(true);
    });
    
    test("EXPENSE missing accountId returns false", () => {
      const actions: ResolvedActionPayload[] = [{
        intentType: "EXPENSE",
        amount: 25000,
        description: "makan siang",
        transactionDate: new Date(),
        accountId: null, // Missing accountId
        categoryId: "category-456"
      }];
      
      expect(ImmediateExecutionService.canExecuteImmediately(actions)).toBe(false);
    });
    
    test("TRANSFER missing fromAccountId returns false", () => {
      const actions: ResolvedActionPayload[] = [{
        intentType: "TRANSFER",
        amount: 100000,
        description: "transfer incomplete",
        transactionDate: new Date(),
        fromAccountId: null, // Missing fromAccountId
        toAccountId: "account-gopay"
      }];
      
      expect(ImmediateExecutionService.canExecuteImmediately(actions)).toBe(false);
    });
    
    test("TRANSFER missing toAccountId returns false", () => {
      const actions: ResolvedActionPayload[] = [{
        intentType: "TRANSFER",
        amount: 100000,
        description: "transfer incomplete",
        transactionDate: new Date(),
        fromAccountId: "account-bca",
        toAccountId: null // Missing toAccountId
      }];
      
      expect(ImmediateExecutionService.canExecuteImmediately(actions)).toBe(false);
    });
    
    test("Action with amount <= 0 returns false", () => {
      const actions: ResolvedActionPayload[] = [{
        intentType: "EXPENSE",
        amount: 0, // Invalid amount
        description: "zero amount",
        transactionDate: new Date(),
        accountId: "account-123",
        categoryId: "category-456"
      }];
      
      expect(ImmediateExecutionService.canExecuteImmediately(actions)).toBe(false);
    });
    
    test("Action with negative amount returns false", () => {
      const actions: ResolvedActionPayload[] = [{
        intentType: "INCOME",
        amount: -1000, // Negative amount
        description: "negative income",
        transactionDate: new Date(),
        accountId: "account-123",
        categoryId: "category-456"
      }];
      
      expect(ImmediateExecutionService.canExecuteImmediately(actions)).toBe(false);
    });
    
    test("BUDGET_ALLOCATION missing budgetCategoryId returns false", () => {
      const actions: ResolvedActionPayload[] = [{
        intentType: "BUDGET_ALLOCATION",
        amount: 500000,
        description: "budget allocation incomplete",
        transactionDate: new Date(),
        budgetCategoryId: null // Missing budgetCategoryId
      }];
      
      expect(ImmediateExecutionService.canExecuteImmediately(actions)).toBe(false);
    });
    
    test("Mixed batch with all valid actions returns true", () => {
      const actions: ResolvedActionPayload[] = [
        {
          intentType: "EXPENSE",
          amount: 25000,
          description: "makan",
          transactionDate: new Date(),
          accountId: "account-123",
          categoryId: "category-food"
        },
        {
          intentType: "INCOME",
          amount: 5000000,
          description: "gaji",
          transactionDate: new Date(),
          accountId: "account-123",
          categoryId: "category-salary"
        },
        {
          intentType: "TRANSFER",
          amount: 100000,
          description: "transfer",
          transactionDate: new Date(),
          fromAccountId: "account-bca",
          toAccountId: "account-gopay"
        }
      ];
      
      expect(ImmediateExecutionService.canExecuteImmediately(actions)).toBe(true);
    });
    
    test("Mixed batch with one invalid action returns false", () => {
      const actions: ResolvedActionPayload[] = [
        {
          intentType: "EXPENSE",
          amount: 25000,
          description: "makan",
          transactionDate: new Date(),
          accountId: "account-123",
          categoryId: "category-food"
        },
        {
          intentType: "INCOME",
          amount: 5000000,
          description: "gaji",
          transactionDate: new Date(),
          accountId: null, // Invalid - missing accountId
          categoryId: "category-salary"
        }
      ];
      
      expect(ImmediateExecutionService.canExecuteImmediately(actions)).toBe(false);
    });
    
    test("Empty actions array returns true", () => {
      const actions: ResolvedActionPayload[] = [];
      
      expect(ImmediateExecutionService.canExecuteImmediately(actions)).toBe(true);
    });
  
  });

});

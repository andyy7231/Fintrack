/**
 * Budget Fix Tests for Immediate Execution
 * 
 * Unit tests to verify budget applicability and response formatting fixes
 */

import { describe, test, expect } from "vitest";
import { formatSingleImmediateSuccess, SingleImmediateResult } from "../response-formatter.service";

describe("Budget Fix: Response Formatting", () => {
  
  test("Expense with active budget for its category shows budget info", () => {
    const result: SingleImmediateResult = {
      type: "EXPENSE",
      categoryName: "Makanan & Minuman",
      amount: 5000,
      description: "kopi",
      totalBalance: 1967700,
      budgetInfo: {
        categoryName: "Makanan & Minuman",
        remainingAmount: 502000,
        spentAmount: 498000,
        limitAmount: 1000000,
      },
    };
    
    const response = formatSingleImmediateSuccess(result);
    
    // Should show budget info
    expect(response).toContain("Sisa budget");
    expect(response).toContain("502.000");
    expect(response).toContain("Makanan & Minuman");
    expect(response).toContain("Sisa uang keseluruhan");
    expect(response).toContain("1.967.700");
    
    // Should have proper formatting with line breaks
    expect(response).toContain("\n");
  });

  test("Expense without budget shows only overall balance (NO budget info)", () => {
    const result: SingleImmediateResult = {
      type: "EXPENSE",
      categoryName: "Tagihan & Utilitas",
      amount: 5000,
      description: "galon",
      totalBalance: 1967700,
      budgetInfo: undefined, // No budget for this category
    };
    
    const response = formatSingleImmediateSuccess(result);
    
    // Should NOT show budget info
    expect(response).not.toContain("Sisa budget");
    
    // Should show category and balance
    expect(response).toContain("Tagihan");
    expect(response).toContain("5.000");
    expect(response).toContain("Sisa uang keseluruhan");
    expect(response).toContain("1.967.700");
    
    // Should have proper formatting
    expect(response).toContain("\n");
  });

  test("Budget from wrong category should not be shown", () => {
    // Simulates scenario: user has budget for "Makanan" but transaction is "Tagihan"
    // budgetInfo should be undefined because fix ensures only matching budget is passed
    const result: SingleImmediateResult = {
      type: "EXPENSE",
      categoryName: "Tagihan & Utilitas",
      amount: 5000,
      description: "galon",
      totalBalance: 1967700,
      budgetInfo: undefined, // Correctly undefined - no budget for Tagihan
    };
    
    const response = formatSingleImmediateSuccess(result);
    
    // Should NOT show any budget info
    expect(response).not.toContain("Makanan & Minuman");
    expect(response).not.toContain("Sisa budget");
    
    // Should show correct category
    expect(response).toContain("Tagihan");
  });

  test("Response has proper line breaks (not one long paragraph)", () => {
    const result: SingleImmediateResult = {
      type: "EXPENSE",
      categoryName: "Makanan & Minuman",
      amount: 5000,
      description: "kopi",
      totalBalance: 1967700,
      budgetInfo: {
        categoryName: "Makanan & Minuman",
        remainingAmount: 502000,
        spentAmount: 498000,
        limitAmount: 1000000,
      },
    };
    
    const response = formatSingleImmediateSuccess(result);
    
    // Check formatting structure - multiple lines, not one paragraph
    const lines = response.split("\n");
    expect(lines.length).toBeGreaterThan(3);
    
    // Each section on separate line
    expect(response).toMatch(/berhasil dicatat\n/);
    expect(response).toMatch(/Makanan & Minuman\n/);
    expect(response).toMatch(/Rp5\.000\n/);
  });

  test("Income shows only balance, never budget", () => {
    const result: SingleImmediateResult = {
      type: "INCOME",
      categoryName: "Gaji",
      amount: 5000000,
      description: "gaji bulanan",
      totalBalance: 6967700,
      budgetInfo: undefined, // Income never has budget
    };
    
    const response = formatSingleImmediateSuccess(result);
    
    // Should NOT show budget (income doesn't have budget)
    expect(response).not.toContain("Sisa budget");
    
    // Should show income info
    expect(response).toContain("Pemasukan");
    expect(response).toContain("5.000.000");
    expect(response).toContain("Sisa uang keseluruhan");
  });

  test("Expense without category name still works", () => {
    const result: SingleImmediateResult = {
      type: "EXPENSE",
      categoryName: null,
      amount: 5000,
      description: "misc",
      totalBalance: 1967700,
      budgetInfo: undefined,
    };
    
    const response = formatSingleImmediateSuccess(result);
    
    // Should use fallback "lainnya"
    expect(response).toContain("lainnya");
    expect(response).toContain("5.000");
    expect(response).not.toContain("Sisa budget");
  });
});

/**
 * Demonstration: Bug Fix Verification
 * 
 * This test demonstrates the actual bug scenario from user report
 */

import { test, expect } from "vitest";
import { formatSingleImmediateSuccess } from "../response-formatter.service";

test("BUG FIX DEMO: galon 5k should NOT show Makanan & Minuman budget", () => {
  // BEFORE FIX: Would show "Sisa budget Makanan & Minuman" incorrectly
  // AFTER FIX: Shows only overall balance (no budget for Tagihan category)
  
  const result = {
    type: "EXPENSE" as const,
    categoryName: "Tagihan & Utilitas", // Galon is Tagihan, not Makanan
    amount: 5000,
    description: "galon",
    totalBalance: 1967700,
    budgetInfo: undefined, // No budget for Tagihan (only Makanan has budget)
  };
  
  const response = formatSingleImmediateSuccess(result);
  
  console.log("\n=== ACTUAL RESPONSE ===");
  console.log(response);
  console.log("=== END RESPONSE ===\n");
  
  // Verify fix: should NOT contain "Makanan & Minuman"
  expect(response).not.toContain("Makanan & Minuman");
  expect(response).not.toContain("Sisa budget");
  
  // Should show correct category
  expect(response).toContain("Tagihan");
  
  // Should show overall balance
  expect(response).toContain("Sisa uang keseluruhan");
  expect(response).toContain("1.967.700");
});

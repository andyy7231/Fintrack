import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { MockAIProvider } from "@/services/ai";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

/**
 * BUGFIX TEST: Preservation Property Tests
 * 
 * This test validates that non-budget inputs continue to work correctly
 * after the budget keyword fix. This ensures no regressions are introduced.
 * 
 * Property 2: For any input without budget keywords, the fixed code
 * SHALL produce the same classification as the original code.
 * 
 * These tests should PASS on UNFIXED code (baseline behavior).
 * These tests must ALSO PASS on FIXED code (no regressions).
 */

async function runPreservationPropertyTests() {
  console.log("====================================================");
  console.log("  BUGFIX: Preservation Property Tests              ");
  console.log("====================================================");
  console.log("Testing that non-budget inputs remain unchanged\n");

  const mockProvider = new MockAIProvider();

  let testsPassed = 0;
  let testsFailed = 0;
  const failures: string[] = [];

  // Test Category 1: Pure Expense Messages
  console.log("[Category 1] Pure Expense Messages");
  
  const expenseTests = [
    { text: "beli kopi 25k", expectedIntent: "EXPENSE", description: "kopi" },
    { text: "bayar listrik 200k", expectedIntent: "EXPENSE", description: "listrik" },
    { text: "biaya parkir 10k", expectedIntent: "EXPENSE", description: "parkir" },
    { text: "beli bensin 50rb", expectedIntent: "EXPENSE", description: "bensin" },
  ];

  for (const test of expenseTests) {
    try {
      console.log(`  Testing: '${test.text}'...`);
      const result = await mockProvider.parseFinancialMessage({
        text: test.text,
        currentDate: "2026-09-29",
        timezone: "Asia/Jakarta",
      });
      
      const action = result.actions[0];
      assert(action !== undefined, "Should parse action");
      assert(action.intent === test.expectedIntent, 
        `Expected ${test.expectedIntent}, got ${action.intent}`);
      
      if (action.intent === "EXPENSE") {
        assert(action.description.toLowerCase().includes(test.description), 
          `Description should contain '${test.description}'`);
        assert(action.amount > 0, "Amount should be positive");
      }
      
      console.log(`  ✓ Correctly classified as ${test.expectedIntent}`);
      testsPassed++;
    } catch (e) {
      console.log(`  ✗ FAIL: ${(e as Error).message}`);
      failures.push(`Expense test '${test.text}': ${(e as Error).message}`);
      testsFailed++;
    }
  }

  // Test Category 2: Income Messages
  console.log("\n[Category 2] Income Messages");
  
  const incomeTests = [
    { text: "gaji 7.5 juta", expectedIntent: "INCOME", amount: 7500000 },
    { text: "dapat bonus 500k", expectedIntent: "INCOME", amount: 500000 },
    { text: "terima uang freelance 1.5jt", expectedIntent: "INCOME", amount: 1500000 },
  ];

  for (const test of incomeTests) {
    try {
      console.log(`  Testing: '${test.text}'...`);
      const result = await mockProvider.parseFinancialMessage({
        text: test.text,
        currentDate: "2026-09-29",
        timezone: "Asia/Jakarta",
      });
      
      const action = result.actions[0];
      assert(action !== undefined, "Should parse action");
      assert(action.intent === test.expectedIntent, 
        `Expected ${test.expectedIntent}, got ${action.intent}`);
      
      if (action.intent === "INCOME") {
        assert(action.amount === test.amount, 
          `Expected amount ${test.amount}, got ${action.amount}`);
      }
      
      console.log(`  ✓ Correctly classified as ${test.expectedIntent}`);
      testsPassed++;
    } catch (e) {
      console.log(`  ✗ FAIL: ${(e as Error).message}`);
      failures.push(`Income test '${test.text}': ${(e as Error).message}`);
      testsFailed++;
    }
  }

  // Test Category 3: Transfer Messages
  console.log("\n[Category 3] Transfer Messages");
  
  const transferTests = [
    { text: "transfer 100k dari BCA ke Mandiri", expectedIntent: "TRANSFER", amount: 100000 },
    { text: "pindah 500rb dari Cash ke BCA", expectedIntent: "TRANSFER", amount: 500000 },
  ];

  for (const test of transferTests) {
    try {
      console.log(`  Testing: '${test.text}'...`);
      const result = await mockProvider.parseFinancialMessage({
        text: test.text,
        currentDate: "2026-09-29",
        timezone: "Asia/Jakarta",
      });
      
      const action = result.actions[0];
      assert(action !== undefined, "Should parse action");
      assert(action.intent === test.expectedIntent, 
        `Expected ${test.expectedIntent}, got ${action.intent}`);
      
      if (action.intent === "TRANSFER") {
        assert(action.amount === test.amount, 
          `Expected amount ${test.amount}, got ${action.amount}`);
      }
      
      console.log(`  ✓ Correctly classified as ${test.expectedIntent}`);
      testsPassed++;
    } catch (e) {
      console.log(`  ✗ FAIL: ${(e as Error).message}`);
      failures.push(`Transfer test '${test.text}': ${(e as Error).message}`);
      testsFailed++;
    }
  }

  // Test Category 4: Balance Queries
  console.log("\n[Category 4] Balance Queries");
  
  const balanceTests = [
    { text: "saldo saya berapa", expectedIntent: "BALANCE_QUERY" },
    { text: "cek saldo BCA", expectedIntent: "BALANCE_QUERY" },
    { text: "uang saya tinggal berapa", expectedIntent: "BALANCE_QUERY" },
  ];

  for (const test of balanceTests) {
    try {
      console.log(`  Testing: '${test.text}'...`);
      const result = await mockProvider.parseFinancialMessage({
        text: test.text,
        currentDate: "2026-09-29",
        timezone: "Asia/Jakarta",
      });
      
      const action = result.actions[0];
      assert(action !== undefined, "Should parse action");
      assert(action.intent === test.expectedIntent, 
        `Expected ${test.expectedIntent}, got ${action.intent}`);
      
      console.log(`  ✓ Correctly classified as ${test.expectedIntent}`);
      testsPassed++;
    } catch (e) {
      console.log(`  ✗ FAIL: ${(e as Error).message}`);
      failures.push(`Balance test '${test.text}': ${(e as Error).message}`);
      testsFailed++;
    }
  }

  // Test Category 5: Unknown Intents
  console.log("\n[Category 5] Unknown/Ambiguous Intents");
  
  const unknownTests = [
    { text: "bayar 50k", expectedIntent: "UNKNOWN" },
    { text: "halo apa kabar", expectedIntent: "UNKNOWN" },
    { text: "tadi beli kopi", expectedIntent: "UNKNOWN" },
  ];

  for (const test of unknownTests) {
    try {
      console.log(`  Testing: '${test.text}'...`);
      const result = await mockProvider.parseFinancialMessage({
        text: test.text,
        currentDate: "2026-09-29",
        timezone: "Asia/Jakarta",
      });
      
      const action = result.actions[0];
      assert(action !== undefined, "Should parse action");
      assert(action.intent === test.expectedIntent, 
        `Expected ${test.expectedIntent}, got ${action.intent}`);
      
      console.log(`  ✓ Correctly classified as ${test.expectedIntent}`);
      testsPassed++;
    } catch (e) {
      console.log(`  ✗ FAIL: ${(e as Error).message}`);
      failures.push(`Unknown test '${test.text}': ${(e as Error).message}`);
      testsFailed++;
    }
  }

  // Test Category 6: Multi-Line Messages (without budgets)
  console.log("\n[Category 6] Multi-Line Messages");
  
  try {
    console.log("  Testing multi-line: 'beli kopi 25k\\nbayar parkir 10k'...");
    const result = await mockProvider.parseFinancialMessage({
      text: "beli kopi 25k\nbayar parkir 10k",
      currentDate: "2026-09-29",
      timezone: "Asia/Jakarta",
    });
    
    assert(result.actions.length === 2, `Expected 2 actions, got ${result.actions.length}`);
    assert(result.actions[0].intent === "EXPENSE", "First action should be EXPENSE");
    assert(result.actions[1].intent === "EXPENSE", "Second action should be EXPENSE");
    
    console.log("  ✓ Multi-line parsing works correctly");
    testsPassed++;
  } catch (e) {
    console.log(`  ✗ FAIL: ${(e as Error).message}`);
    failures.push(`Multi-line test: ${(e as Error).message}`);
    testsFailed++;
  }

  // Test Category 7: Edge Case - "budget" as part of item description
  console.log("\n[Category 7] Edge Case - 'budget' as part of description");
  
  try {
    console.log("  Testing: 'beli budget plan book 50k' (budget in item name)...");
    const result = await mockProvider.parseFinancialMessage({
      text: "beli budget plan book 50k",
      currentDate: "2026-09-29",
      timezone: "Asia/Jakarta",
    });
    
    const action = result.actions[0];
    assert(action !== undefined, "Should parse action");
    
    // This should be EXPENSE, not BUDGET_ALLOCATION
    // The word "budget" appears but it's part of the book title "budget plan book"
    // Our keywords have trailing space, so "budget " won't match "budget plan"
    assert(action.intent === "EXPENSE", 
      `Expected EXPENSE (budget is part of item name), got ${action.intent}`);
    
    console.log("  ✓ Edge case handled correctly - classified as EXPENSE");
    testsPassed++;
  } catch (e) {
    console.log(`  ✗ FAIL: ${(e as Error).message}`);
    failures.push(`Edge case test: ${(e as Error).message}`);
    testsFailed++;
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("Preservation Property Tests Summary:");
  console.log(`Tests Passed: ${testsPassed}`);
  console.log(`Tests Failed: ${testsFailed}`);
  console.log("=".repeat(50));

  if (testsFailed > 0) {
    console.log("\n❌ PRESERVATION VIOLATIONS DETECTED:");
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    console.log("\nThese behaviors should remain unchanged after the fix.");
    return { testsPassed, testsFailed, failures, success: false };
  } else {
    console.log("\n✅ All preservation tests passed!");
    console.log("Baseline behavior captured. After fix, re-run to ensure no regressions.");
    return { testsPassed, testsFailed, failures, success: true };
  }
}

// Run the tests
runPreservationPropertyTests()
  .then((result) => {
    if (result.success) {
      console.log("\n✅ Preservation baseline established");
      process.exit(0);
    } else {
      console.log("\n❌ Preservation tests failed");
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error("\n❌ Unexpected error:", err);
    process.exit(1);
  });

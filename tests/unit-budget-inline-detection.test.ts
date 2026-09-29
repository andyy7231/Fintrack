import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { MockAIProvider, isBudgetAllocationLine } from "@/services/ai";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

/**
 * COMPREHENSIVE UNIT TESTS: Budget Inline Keyword Detection
 * 
 * Tests the fixed isBudgetAllocationLine() function and _parseSingleIntent()
 * with comprehensive coverage of all edge cases and scenarios.
 */

async function runComprehensiveUnitTests() {
  console.log("====================================================");
  console.log("  Comprehensive Unit Tests - Budget Detection       ");
  console.log("====================================================\n");

  const mockProvider = new MockAIProvider();

  let testsPassed = 0;
  let testsFailed = 0;
  const failures: string[] = [];

  // ===================================================================
  // CATEGORY 1: isBudgetAllocationLine() Function Tests
  // ===================================================================
  console.log("[Category 1] isBudgetAllocationLine() Function Tests\n");

  const functionTests = [
    // Keywords at start
    { text: "budget makan 600k", expected: true, description: "keyword at start" },
    { text: "anggaran transport 200k", expected: true, description: "anggaran at start" },
    { text: "alokasi kos 750k", expected: true, description: "alokasi at start" },
    { text: "jatah listrik 300k", expected: true, description: "jatah at start" },
    
    // Keywords after colon
    { text: "gaji untuk: budget makan 600k", expected: true, description: "keyword after colon" },
    { text: "alokasi gaji: anggaran transport 200k", expected: true, description: "anggaran after colon" },
    
    // Keywords mid-text
    { text: "untuk budget transport 200k", expected: true, description: "keyword mid-text with 'untuk'" },
    { text: "sisa budget kos 750k", expected: true, description: "keyword mid-text with 'sisa'" },
    { text: "alokasi untuk jatah makan 500k", expected: true, description: "jatah mid-text" },
    
    // Multiple keywords
    { text: "budget makan 600k budget kos 750k", expected: true, description: "multiple keywords" },
    
    // Non-budget messages (should return false)
    { text: "beli kopi 25k", expected: false, description: "pure expense - no budget keyword" },
    { text: "bayar listrik 200k", expected: false, description: "expense with bayar" },
    { text: "gaji 7.5 juta", expected: false, description: "income - no budget keyword" },
    { text: "transfer 100k dari BCA", expected: false, description: "transfer - no budget keyword" },
    { text: "halo apa kabar", expected: false, description: "non-financial text" },
    
    // Edge case: "budget" as part of item name with expense verb
    { text: "beli budget plan book 50k", expected: false, description: "budget in item name with 'beli'" },
    { text: "bayar budget hotel 100k", expected: false, description: "budget in item name with 'bayar'" },
    { text: "biaya budget workshop 500k", expected: false, description: "budget in item name with 'biaya'" },
  ];

  for (const test of functionTests) {
    try {
      const result = isBudgetAllocationLine(test.text.toLowerCase());
      assert(result === test.expected, 
        `'${test.text}' (${test.description}): expected ${test.expected}, got ${result}`);
      console.log(`  ✓ ${test.description}: '${test.text}'`);
      testsPassed++;
    } catch (e) {
      console.log(`  ✗ FAIL: ${(e as Error).message}`);
      failures.push(`Function test (${test.description}): ${(e as Error).message}`);
      testsFailed++;
    }
  }

  // ===================================================================
  // CATEGORY 2: _parseSingleIntent() with Inline Budget Items
  // ===================================================================
  console.log("\n[Category 2] _parseSingleIntent() with Inline Budget Items\n");

  const parsingTests = [
    {
      text: "gaji untuk: budget makan 600k",
      expectedIntent: "INCOME",
      expectedBudgetAction: { intent: "BUDGET_ALLOCATION", amount: 600000, category: "makan" },
      description: "income with inline budget after colon"
    },
    {
      text: "untuk budget transport 200k",
      expectedIntent: "BUDGET_ALLOCATION",
      expectedAmount: 200000,
      expectedCategory: "transport",
      description: "inline budget mid-text"
    },
    {
      text: "sisa budget kos 750k",
      expectedIntent: "BUDGET_ALLOCATION",
      expectedAmount: 750000,
      expectedCategory: "kos",
      description: "inline budget with 'sisa' prefix"
    },
    {
      text: "budget makan 600k",
      expectedIntent: "BUDGET_ALLOCATION",
      expectedAmount: 600000,
      expectedCategory: "makan",
      description: "budget at line start (regression check)"
    },
  ];

  for (const test of parsingTests) {
    try {
      console.log(`  Testing: '${test.text}' (${test.description})...`);
      const result = await mockProvider.parseFinancialMessage({
        text: test.text,
        currentDate: "2026-09-29",
        timezone: "Asia/Jakarta",
      });

      if (test.expectedBudgetAction) {
        // Multi-action scenario - find budget action
        const budgetAction = result.actions.find(a => a.intent === "BUDGET_ALLOCATION");
        assert(budgetAction !== undefined, "Should find BUDGET_ALLOCATION action");
        if (budgetAction && budgetAction.intent === "BUDGET_ALLOCATION") {
          assert(budgetAction.amount === test.expectedBudgetAction.amount,
            `Expected amount ${test.expectedBudgetAction.amount}, got ${budgetAction.amount}`);
          assert(budgetAction.categoryName?.toLowerCase().includes(test.expectedBudgetAction.category),
            `Expected category containing '${test.expectedBudgetAction.category}', got ${budgetAction.categoryName}`);
        }
      } else {
        // Single-action scenario
        const action = result.actions[0];
        assert(action !== undefined, "Should parse action");
        assert(action.intent === test.expectedIntent,
          `Expected ${test.expectedIntent}, got ${action.intent}`);
        
        if (action.intent === "BUDGET_ALLOCATION" && test.expectedAmount) {
          assert(action.amount === test.expectedAmount,
            `Expected amount ${test.expectedAmount}, got ${action.amount}`);
          if (test.expectedCategory) {
            assert(action.categoryName?.toLowerCase().includes(test.expectedCategory),
              `Expected category containing '${test.expectedCategory}', got ${action.categoryName}`);
          }
        }
      }

      console.log(`  ✓ Parsed correctly`);
      testsPassed++;
    } catch (e) {
      console.log(`  ✗ FAIL: ${(e as Error).message}`);
      failures.push(`Parsing test (${test.description}): ${(e as Error).message}`);
      testsFailed++;
    }
  }

  // ===================================================================
  // CATEGORY 3: Multi-Action Parsing (Mixed Budget and Expense)
  // ===================================================================
  console.log("\n[Category 3] Multi-Action Parsing with Mixed Items\n");

  try {
    console.log("  Testing multi-line: 'gaji 2.25jt\\nbudget makan 600k\\nbayar seragam 100k'...");
    const result = await mockProvider.parseFinancialMessage({
      text: "gaji 2.25jt\nbudget makan 600k\nbayar seragam 100k",
      currentDate: "2026-09-29",
      timezone: "Asia/Jakarta",
    });

    assert(result.actions.length === 3, `Expected 3 actions, got ${result.actions.length}`);
    
    const incomeAction = result.actions.find(a => a.intent === "INCOME");
    const budgetAction = result.actions.find(a => a.intent === "BUDGET_ALLOCATION");
    const expenseAction = result.actions.find(a => a.intent === "EXPENSE");

    assert(incomeAction !== undefined, "Should have 1 INCOME action");
    assert(budgetAction !== undefined, "Should have 1 BUDGET_ALLOCATION action");
    assert(expenseAction !== undefined, "Should have 1 EXPENSE action");

    if (incomeAction && incomeAction.intent === "INCOME") {
      assert(incomeAction.amount === 2250000, "Income amount should be 2.25 juta");
    }
    if (budgetAction && budgetAction.intent === "BUDGET_ALLOCATION") {
      assert(budgetAction.amount === 600000, "Budget amount should be 600k");
      assert(budgetAction.categoryName?.toLowerCase().includes("makan"), "Budget category should contain 'makan'");
    }
    if (expenseAction && expenseAction.intent === "EXPENSE") {
      assert(expenseAction.amount === 100000, "Expense amount should be 100k");
    }

    console.log("  ✓ Multi-action parsing correct: 1 INCOME + 1 BUDGET + 1 EXPENSE");
    testsPassed++;
  } catch (e) {
    console.log(`  ✗ FAIL: ${(e as Error).message}`);
    failures.push(`Multi-action test: ${(e as Error).message}`);
    testsFailed++;
  }

  // ===================================================================
  // CATEGORY 4: Category Name Extraction from Inline Text
  // ===================================================================
  console.log("\n[Category 4] Category Name Extraction from Inline Text\n");

  const categoryTests = [
    { text: "untuk budget makan 600k", expectedCategory: "makan" },
    { text: "sisa budget transport 200k", expectedCategory: "transport" },
    { text: "budget kos 750k", expectedCategory: "kos" },
    { text: "alokasi gaji: anggaran listrik 300k", expectedCategory: "listrik" },
  ];

  for (const test of categoryTests) {
    try {
      console.log(`  Testing category extraction: '${test.text}'...`);
      const result = await mockProvider.parseFinancialMessage({
        text: test.text,
        currentDate: "2026-09-29",
        timezone: "Asia/Jakarta",
      });

      const action = result.actions[0];
      assert(action !== undefined, "Should parse action");
      assert(action.intent === "BUDGET_ALLOCATION", "Should be BUDGET_ALLOCATION");
      
      if (action.intent === "BUDGET_ALLOCATION") {
        assert(action.categoryName?.toLowerCase().includes(test.expectedCategory),
          `Expected category containing '${test.expectedCategory}', got ${action.categoryName}`);
      }

      console.log(`  ✓ Category '${test.expectedCategory}' extracted correctly`);
      testsPassed++;
    } catch (e) {
      console.log(`  ✗ FAIL: ${(e as Error).message}`);
      failures.push(`Category extraction test: ${(e as Error).message}`);
      testsFailed++;
    }
  }

  // ===================================================================
  // CATEGORY 5: Edge Cases and Special Scenarios
  // ===================================================================
  console.log("\n[Category 5] Edge Cases and Special Scenarios\n");

  const edgeCases = [
    {
      text: "beli budget plan book 50k",
      expectedIntent: "EXPENSE",
      description: "budget as part of item description with 'beli'"
    },
    {
      text: "bayar budget hotel 100k",
      expectedIntent: "EXPENSE",
      description: "budget as part of item description with 'bayar'"
    },
    {
      text: "budget makan 600k budget kos 750k",
      expectedIntent: "BUDGET_ALLOCATION",
      description: "multiple budget keywords in single line"
    },
  ];

  for (const test of edgeCases) {
    try {
      console.log(`  Testing: '${test.text}' (${test.description})...`);
      const result = await mockProvider.parseFinancialMessage({
        text: test.text,
        currentDate: "2026-09-29",
        timezone: "Asia/Jakarta",
      });

      const action = result.actions[0];
      assert(action !== undefined, "Should parse action");
      assert(action.intent === test.expectedIntent,
        `Expected ${test.expectedIntent}, got ${action.intent}`);

      console.log(`  ✓ Edge case handled correctly: ${test.expectedIntent}`);
      testsPassed++;
    } catch (e) {
      console.log(`  ✗ FAIL: ${(e as Error).message}`);
      failures.push(`Edge case (${test.description}): ${(e as Error).message}`);
      testsFailed++;
    }
  }

  // ===================================================================
  // CATEGORY 6: All Keyword Variants
  // ===================================================================
  console.log("\n[Category 6] All Budget Keyword Variants\n");

  const keywordVariants = [
    { keyword: "budget", text: "untuk budget makan 500k" },
    { keyword: "anggaran", text: "sisa anggaran transport 200k" },
    { keyword: "alokasi", text: "untuk alokasi listrik 300k" },
    { keyword: "jatah", text: "sisa jatah kos 800k" },
  ];

  for (const variant of keywordVariants) {
    try {
      console.log(`  Testing keyword '${variant.keyword}': '${variant.text}'...`);
      const result = await mockProvider.parseFinancialMessage({
        text: variant.text,
        currentDate: "2026-09-29",
        timezone: "Asia/Jakarta",
      });

      const action = result.actions[0];
      assert(action !== undefined, "Should parse action");
      assert(action.intent === "BUDGET_ALLOCATION",
        `Expected BUDGET_ALLOCATION for '${variant.keyword}', got ${action.intent}`);
      
      if (action.intent === "BUDGET_ALLOCATION") {
        assert(action.amount > 0, "Amount should be positive");
        assert(action.categoryName !== undefined && action.categoryName.length > 0,
          "Category name should be extracted");
      }

      console.log(`  ✓ Keyword '${variant.keyword}' detected correctly`);
      testsPassed++;
    } catch (e) {
      console.log(`  ✗ FAIL: ${(e as Error).message}`);
      failures.push(`Keyword variant '${variant.keyword}': ${(e as Error).message}`);
      testsFailed++;
    }
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("Comprehensive Unit Tests Summary:");
  console.log(`Tests Passed: ${testsPassed}`);
  console.log(`Tests Failed: ${testsFailed}`);
  console.log("=".repeat(50));

  if (testsFailed > 0) {
    console.log("\n❌ Some tests failed:");
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    return { testsPassed, testsFailed, failures, success: false };
  } else {
    console.log("\n✅ All comprehensive unit tests passed!");
    return { testsPassed, testsFailed, failures, success: true };
  }
}

// Run the tests
runComprehensiveUnitTests()
  .then((result) => {
    if (result.success) {
      console.log("\n✅ Unit test suite complete");
      process.exit(0);
    } else {
      console.log("\n❌ Unit test suite failed");
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error("\n❌ Unexpected error:", err);
    process.exit(1);
  });

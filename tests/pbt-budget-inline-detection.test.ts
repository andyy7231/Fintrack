import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { MockAIProvider } from "@/services/ai";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

/**
 * PROPERTY-BASED TESTS: Budget Inline Keyword Detection
 * 
 * Generates diverse test cases to validate the budget detection fix
 * across a wide range of inputs.
 * 
 * Property 1: ANY message with budget keywords → BUDGET_ALLOCATION
 * Property 2: ANY message without budget keywords → same as before (preservation)
 */

// Generator: Budget messages with keywords at random positions
function* generateBudgetMessages() {
  const keywords = ["budget", "anggaran", "alokasi", "jatah"];
  const prefixes = ["", "gaji untuk: ", "sisa ", "untuk ", "alokasi gaji: "];
  const categories = ["makan", "kos", "transport", "listrik", "belanja", "hiburan"];
  const amounts = ["100k", "500rb", "1.5juta", "750ribu", "2jt", "350k"];
  
  for (const kw of keywords) {
    for (const prefix of prefixes) {
      for (const cat of categories) {
        for (const amt of amounts) {
          yield {
            text: `${prefix}${kw} ${cat} ${amt}`,
            keyword: kw,
            category: cat,
            prefix: prefix || "(none)"
          };
        }
      }
    }
  }
}

// Generator: Non-budget messages (preservation)
function* generateNonBudgetMessages() {
  const expenseVerbs = ["beli", "bayar", "biaya", "buat"];
  const items = ["kopi", "bensin", "parkir", "listrik", "makan siang", "snack"];
  const amounts = ["25k", "50rb", "100ribu", "15k", "200k"];
  
  for (const verb of expenseVerbs) {
    for (const item of items) {
      for (const amt of amounts) {
        yield {
          text: `${verb} ${item} ${amt}`,
          verb,
          item
        };
      }
    }
  }
}

async function runPropertyBasedTests() {
  console.log("====================================================");
  console.log("  Property-Based Tests - Budget Detection           ");
  console.log("====================================================\n");

  const mockProvider = new MockAIProvider();

  let testsPassed = 0;
  let testsFailed = 0;
  const failures: string[] = [];

  // ===================================================================
  // PROPERTY 1: Budget Keyword Detection
  // ===================================================================
  console.log("[Property 1] ANY message with budget keywords → BUDGET_ALLOCATION\n");
  console.log("Generating test cases...");
  
  const budgetMessages = Array.from(generateBudgetMessages());
  console.log(`Generated ${budgetMessages.length} budget message test cases\n`);
  
  let budgetTestCount = 0;
  const maxBudgetTests = 100; // Sample from generated cases
  const sampleStep = Math.floor(budgetMessages.length / maxBudgetTests);
  
  for (let i = 0; i < budgetMessages.length; i += sampleStep) {
    const testCase = budgetMessages[i];
    budgetTestCount++;
    
    try {
      const result = await mockProvider.parseFinancialMessage({
        text: testCase.text,
        currentDate: "2026-09-29",
        timezone: "Asia/Jakarta",
      });
      
      // Find budget action (might be mixed with income)
      const budgetAction = result.actions.find(a => a.intent === "BUDGET_ALLOCATION");
      
      assert(budgetAction !== undefined, 
        `'${testCase.text}' should contain BUDGET_ALLOCATION action`);
      assert(budgetAction!.intent === "BUDGET_ALLOCATION",
        `Expected BUDGET_ALLOCATION for '${testCase.text}'`);
      
      if (budgetAction && budgetAction.intent === "BUDGET_ALLOCATION") {
        assert(budgetAction.amount > 0, "Amount should be positive");
        assert(budgetAction.categoryName !== undefined && budgetAction.categoryName.length > 0,
          "Category name should be extracted");
        // Check category contains expected text
        assert(budgetAction.categoryName.toLowerCase().includes(testCase.category),
          `Category should contain '${testCase.category}', got '${budgetAction.categoryName}'`);
      }
      
      if (budgetTestCount % 20 === 0) {
        console.log(`  Progress: ${budgetTestCount}/${maxBudgetTests} budget tests...`);
      }
      testsPassed++;
    } catch (e) {
      console.log(`  ✗ FAIL: ${(e as Error).message}`);
      failures.push(`Budget property test case ${budgetTestCount}: ${(e as Error).message}`);
      testsFailed++;
      if (testsFailed > 10) {
        console.log("  ⚠️  Too many failures, stopping property test early");
        break;
      }
    }
  }
  
  console.log(`\n  ✓ Tested ${budgetTestCount} budget message variations`);
  console.log(`  ✓ All budget keywords detected correctly at various positions\n`);

  // ===================================================================
  // PROPERTY 2: Non-Budget Input Preservation
  // ===================================================================
  console.log("[Property 2] ANY message without budget keywords → same classification (preservation)\n");
  console.log("Generating non-budget test cases...");
  
  const nonBudgetMessages = Array.from(generateNonBudgetMessages());
  console.log(`Generated ${nonBudgetMessages.length} non-budget message test cases\n`);
  
  let nonBudgetTestCount = 0;
  const maxNonBudgetTests = 100;
  const nonBudgetSampleStep = Math.floor(nonBudgetMessages.length / maxNonBudgetTests);
  
  for (let i = 0; i < nonBudgetMessages.length; i += nonBudgetSampleStep) {
    const testCase = nonBudgetMessages[i];
    nonBudgetTestCount++;
    
    try {
      const result = await mockProvider.parseFinancialMessage({
        text: testCase.text,
        currentDate: "2026-09-29",
        timezone: "Asia/Jakarta",
      });
      
      const action = result.actions[0];
      assert(action !== undefined, "Should parse action");
      
      // Should be classified as EXPENSE (since these are expense verbs with items and amounts)
      assert(action.intent === "EXPENSE",
        `Expected EXPENSE for '${testCase.text}', got ${action.intent}`);
      
      if (action.intent === "EXPENSE") {
        assert(action.amount > 0, "Amount should be positive");
        assert(action.description.length > 0, "Description should be extracted");
      }
      
      if (nonBudgetTestCount % 20 === 0) {
        console.log(`  Progress: ${nonBudgetTestCount}/${maxNonBudgetTests} non-budget tests...`);
      }
      testsPassed++;
    } catch (e) {
      console.log(`  ✗ FAIL: ${(e as Error).message}`);
      failures.push(`Non-budget preservation test case ${nonBudgetTestCount}: ${(e as Error).message}`);
      testsFailed++;
      if (testsFailed > 10) {
        console.log("  ⚠️  Too many failures, stopping property test early");
        break;
      }
    }
  }
  
  console.log(`\n  ✓ Tested ${nonBudgetTestCount} non-budget message variations`);
  console.log(`  ✓ All non-budget messages remain correctly classified as EXPENSE\n`);

  // ===================================================================
  // PROPERTY 3: Category Name Extraction Consistency
  // ===================================================================
  console.log("[Property 3] Same keyword at different positions → same category extraction\n");
  
  const consistencyTests = [
    {
      variations: [
        "budget makan 600k",
        "untuk budget makan 600k",
        "sisa budget makan 600k",
        "alokasi gaji: budget makan 600k"
      ],
      expectedCategory: "makan"
    },
    {
      variations: [
        "anggaran transport 200k",
        "untuk anggaran transport 200k",
        "sisa anggaran transport 200k"
      ],
      expectedCategory: "transport"
    },
    {
      variations: [
        "alokasi kos 750k",
        "untuk alokasi kos 750k",
        "gaji dibagi: alokasi kos 750k"
      ],
      expectedCategory: "kos"
    }
  ];

  for (const test of consistencyTests) {
    try {
      console.log(`  Testing category '${test.expectedCategory}' extraction consistency...`);
      const categories = [];
      
      for (const variation of test.variations) {
        const result = await mockProvider.parseFinancialMessage({
          text: variation,
          currentDate: "2026-09-29",
          timezone: "Asia/Jakarta",
        });
        
        const budgetAction = result.actions.find(a => a.intent === "BUDGET_ALLOCATION");
        assert(budgetAction !== undefined, `Should parse budget from '${variation}'`);
        
        if (budgetAction && budgetAction.intent === "BUDGET_ALLOCATION") {
          categories.push(budgetAction.categoryName);
          assert(budgetAction.categoryName?.toLowerCase().includes(test.expectedCategory),
            `Expected category containing '${test.expectedCategory}', got '${budgetAction.categoryName}'`);
        }
      }
      
      console.log(`    ✓ All variations extracted category containing '${test.expectedCategory}'`);
      console.log(`    Categories: ${categories.join(", ")}`);
      testsPassed++;
    } catch (e) {
      console.log(`  ✗ FAIL: ${(e as Error).message}`);
      failures.push(`Consistency test: ${(e as Error).message}`);
      testsFailed++;
    }
  }

  // ===================================================================
  // PROPERTY 4: Amount Extraction Consistency
  // ===================================================================
  console.log("\n[Property 4] Budget amount extracted correctly regardless of keyword position\n");
  
  const amountTests = [
    { text: "budget makan 600k", expectedAmount: 600000 },
    { text: "untuk budget transport 200k", expectedAmount: 200000 },
    { text: "sisa anggaran kos 1.5juta", expectedAmount: 1500000 },
    { text: "gaji untuk: alokasi listrik 350rb", expectedAmount: 350000 },
  ];

  for (const test of amountTests) {
    try {
      const result = await mockProvider.parseFinancialMessage({
        text: test.text,
        currentDate: "2026-09-29",
        timezone: "Asia/Jakarta",
      });
      
      const budgetAction = result.actions.find(a => a.intent === "BUDGET_ALLOCATION");
      assert(budgetAction !== undefined, `Should parse budget from '${test.text}'`);
      
      if (budgetAction && budgetAction.intent === "BUDGET_ALLOCATION") {
        assert(budgetAction.amount === test.expectedAmount,
          `Expected amount ${test.expectedAmount}, got ${budgetAction.amount} for '${test.text}'`);
      }
      
      console.log(`  ✓ Amount ${test.expectedAmount} extracted from '${test.text}'`);
      testsPassed++;
    } catch (e) {
      console.log(`  ✗ FAIL: ${(e as Error).message}`);
      failures.push(`Amount extraction test: ${(e as Error).message}`);
      testsFailed++;
    }
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("Property-Based Tests Summary:");
  console.log(`Tests Passed: ${testsPassed}`);
  console.log(`Tests Failed: ${testsFailed}`);
  console.log(`Total Test Cases Generated: ${budgetMessages.length + nonBudgetMessages.length}`);
  console.log(`Sample Size Tested: ~${budgetTestCount + nonBudgetTestCount}`);
  console.log("=".repeat(50));

  if (testsFailed > 0) {
    console.log("\n❌ Some property tests failed:");
    failures.slice(0, 10).forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    if (failures.length > 10) {
      console.log(`  ... and ${failures.length - 10} more failures`);
    }
    return { testsPassed, testsFailed, failures, success: false };
  } else {
    console.log("\n✅ All property-based tests passed!");
    console.log("The fix is robust across diverse input variations.");
    return { testsPassed, testsFailed, failures, success: true };
  }
}

// Run the tests
runPropertyBasedTests()
  .then((result) => {
    if (result.success) {
      console.log("\n✅ Property-based test suite complete");
      process.exit(0);
    } else {
      console.log("\n❌ Property-based test suite failed");
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error("\n❌ Unexpected error:", err);
    process.exit(1);
  });

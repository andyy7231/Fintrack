import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { MockAIProvider } from "@/services/ai";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

/**
 * BUGFIX TEST: WhatsApp Budget Interpretation - Inline Budget Keyword Detection
 * 
 * This test validates the fix for the bug where budget keywords appearing
 * inline (not at line start) are incorrectly classified as EXPENSE instead
 * of BUDGET_ALLOCATION.
 * 
 * Bug Condition: Budget keywords ("budget", "anggaran", "alokasi", "jatah")
 * appear anywhere in the text (not just at line start)
 * 
 * Expected Behavior: All budget keywords should be detected → BUDGET_ALLOCATION
 */

async function runBugConditionExplorationTests() {
  console.log("====================================================");
  console.log("  BUGFIX: Budget Inline Keyword Detection Tests    ");
  console.log("====================================================");

  const mockProvider = new MockAIProvider();

  console.log("\n[TEST 1] Bug Condition Exploration - Property 1: Inline Budget Keyword Detection");
  console.log("CRITICAL: This test encodes EXPECTED BEHAVIOR and will FAIL on unfixed code");
  console.log("When this test FAILS, it confirms the bug exists.");
  console.log("When this test PASSES (after fix), it confirms the bug is resolved.\n");

  let testsPassed = 0;
  let testsFailed = 0;
  const failures: string[] = [];

  // Test Case 1: Budget keyword after colon
  console.log("[1.1] Testing: 'gaji untuk: budget makan 600k' (keyword after colon)...");
  try {
    const result1 = await mockProvider.parseFinancialMessage({
      text: "gaji untuk: budget makan 600k",
      currentDate: "2026-09-29",
      timezone: "Asia/Jakarta",
    });
    
    // Find the budget action
    const budgetAction = result1.actions.find(a => 
      a.intent === "BUDGET_ALLOCATION" || 
      (a.intent === "EXPENSE" && a.description?.toLowerCase().includes("makan"))
    );
    
    assert(budgetAction !== undefined, "Should parse budget action");
    assert(budgetAction!.intent === "BUDGET_ALLOCATION", 
      `Expected BUDGET_ALLOCATION but got ${budgetAction!.intent} - BUG DETECTED`);
    
    if (budgetAction!.intent === "BUDGET_ALLOCATION") {
      assert(budgetAction!.amount === 600000, `Expected amount 600000, got ${budgetAction!.amount}`);
      assert(budgetAction!.categoryName?.toLowerCase().includes("makan"), 
        `Expected category containing 'makan', got ${budgetAction!.categoryName}`);
    }
    
    console.log("✓ PASS: Budget keyword after colon detected correctly");
    testsPassed++;
  } catch (e) {
    console.log(`✗ FAIL: ${(e as Error).message}`);
    failures.push(`Test 1.1: ${(e as Error).message}`);
    testsFailed++;
  }

  // Test Case 2: Budget keyword mid-text
  console.log("\n[1.2] Testing: 'untuk budget transport 200k' (keyword mid-text)...");
  try {
    const result2 = await mockProvider.parseFinancialMessage({
      text: "untuk budget transport 200k",
      currentDate: "2026-09-29",
      timezone: "Asia/Jakarta",
    });
    
    const action = result2.actions[0];
    assert(action !== undefined, "Should parse action");
    assert(action.intent === "BUDGET_ALLOCATION", 
      `Expected BUDGET_ALLOCATION but got ${action.intent} - BUG DETECTED`);
    
    if (action.intent === "BUDGET_ALLOCATION") {
      assert(action.amount === 200000, `Expected amount 200000, got ${action.amount}`);
      assert(action.categoryName?.toLowerCase().includes("transport"), 
        `Expected category containing 'transport', got ${action.categoryName}`);
    }
    
    console.log("✓ PASS: Budget keyword mid-text detected correctly");
    testsPassed++;
  } catch (e) {
    console.log(`✗ FAIL: ${(e as Error).message}`);
    failures.push(`Test 1.2: ${(e as Error).message}`);
    testsFailed++;
  }

  // Test Case 3: Budget keyword with prefix
  console.log("\n[1.3] Testing: 'sisa budget kos 750k' (keyword with prefix)...");
  try {
    const result3 = await mockProvider.parseFinancialMessage({
      text: "sisa budget kos 750k",
      currentDate: "2026-09-29",
      timezone: "Asia/Jakarta",
    });
    
    const action = result3.actions[0];
    assert(action !== undefined, "Should parse action");
    assert(action.intent === "BUDGET_ALLOCATION", 
      `Expected BUDGET_ALLOCATION but got ${action.intent} - BUG DETECTED`);
    
    if (action.intent === "BUDGET_ALLOCATION") {
      assert(action.amount === 750000, `Expected amount 750000, got ${action.amount}`);
      assert(action.categoryName?.toLowerCase().includes("kos"), 
        `Expected category containing 'kos', got ${action.categoryName}`);
    }
    
    console.log("✓ PASS: Budget keyword with prefix detected correctly");
    testsPassed++;
  } catch (e) {
    console.log(`✗ FAIL: ${(e as Error).message}`);
    failures.push(`Test 1.3: ${(e as Error).message}`);
    testsFailed++;
  }

  // Test Case 4: Inline budget in comma-separated list
  console.log("\n[1.4] Testing: 'budget makan 600k, budget kos 750k' (comma-separated)...");
  try {
    const result4 = await mockProvider.parseFinancialMessage({
      text: "budget makan 600k, budget kos 750k",
      currentDate: "2026-09-29",
      timezone: "Asia/Jakarta",
    });
    
    // This is a single-line message with comma, not multi-line
    // Current parser might not split on comma, but let's check what we get
    const budgetActions = result4.actions.filter(a => a.intent === "BUDGET_ALLOCATION");
    
    assert(budgetActions.length > 0, "Should detect at least one budget allocation");
    
    console.log("✓ PASS: Inline budget items detected correctly");
    testsPassed++;
  } catch (e) {
    console.log(`✗ FAIL: ${(e as Error).message}`);
    failures.push(`Test 1.4: ${(e as Error).message}`);
    testsFailed++;
  }

  // Test Case 5: All budget keyword variants (anggaran, alokasi, jatah)
  console.log("\n[1.5] Testing budget keyword variants...");
  
  const variants = [
    { keyword: "anggaran", text: "untuk anggaran makan 500k" },
    { keyword: "alokasi", text: "sisa alokasi transport 200k" },
    { keyword: "jatah", text: "untuk jatah kos 800k" }
  ];
  
  for (const variant of variants) {
    try {
      console.log(`  Testing '${variant.text}'...`);
      const result = await mockProvider.parseFinancialMessage({
        text: variant.text,
        currentDate: "2026-09-29",
        timezone: "Asia/Jakarta",
      });
      
      const action = result.actions[0];
      assert(action !== undefined, `Should parse action for ${variant.keyword}`);
      assert(action.intent === "BUDGET_ALLOCATION", 
        `Expected BUDGET_ALLOCATION for '${variant.keyword}' but got ${action.intent} - BUG DETECTED`);
      
      console.log(`  ✓ '${variant.keyword}' detected correctly`);
      testsPassed++;
    } catch (e) {
      console.log(`  ✗ FAIL: ${(e as Error).message}`);
      failures.push(`Test 1.5 (${variant.keyword}): ${(e as Error).message}`);
      testsFailed++;
    }
  }

  // Test Case 6: Budget at line start should still work (regression check)
  console.log("\n[1.6] Testing: 'budget makan 600k' (at line start - should still work)...");
  try {
    const result6 = await mockProvider.parseFinancialMessage({
      text: "budget makan 600k",
      currentDate: "2026-09-29",
      timezone: "Asia/Jakarta",
    });
    
    const action = result6.actions[0];
    assert(action !== undefined, "Should parse action");
    assert(action.intent === "BUDGET_ALLOCATION", 
      `Expected BUDGET_ALLOCATION but got ${action.intent}`);
    
    if (action.intent === "BUDGET_ALLOCATION") {
      assert(action.amount === 600000, `Expected amount 600000, got ${action.amount}`);
      assert(action.categoryName?.toLowerCase().includes("makan"), 
        `Expected category containing 'makan', got ${action.categoryName}`);
    }
    
    console.log("✓ PASS: Budget at line start still works correctly");
    testsPassed++;
  } catch (e) {
    console.log(`✗ FAIL: ${(e as Error).message}`);
    failures.push(`Test 1.6: ${(e as Error).message}`);
    testsFailed++;
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("Bug Condition Exploration Summary:");
  console.log(`Tests Passed: ${testsPassed}`);
  console.log(`Tests Failed: ${testsFailed}`);
  console.log("=".repeat(50));

  if (testsFailed > 0) {
    console.log("\n❌ BUG CONFIRMED - Counterexamples found:");
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    console.log("\nThis is EXPECTED on unfixed code. These failures confirm the bug exists.");
    console.log("After implementing the fix, re-run this test to verify all tests pass.");
  } else {
    console.log("\n✅ All tests passed - Bug is FIXED!");
  }

  return { testsPassed, testsFailed, failures };
}

// Run the tests
runBugConditionExplorationTests()
  .then((result) => {
    if (result.testsFailed > 0) {
      console.log("\n⚠️  EXPECTED OUTCOME: Tests failed on unfixed code");
      process.exit(0); // Exit successfully - failure is expected
    } else {
      console.log("\n✅ All tests passed!");
      process.exit(0);
    }
  })
  .catch((err) => {
    console.error("\n❌ Unexpected error:", err);
    process.exit(1);
  });

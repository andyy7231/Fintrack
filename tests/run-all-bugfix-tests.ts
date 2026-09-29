import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { execSync } from "child_process";

/**
 * RUN ALL BUGFIX TESTS - Final Validation Checkpoint
 * 
 * Runs all bugfix test suites in sequence and reports final status.
 */

console.log("====================================================");
console.log("  FINAL VALIDATION: All Bugfix Tests                ");
console.log("====================================================\n");

const tests = [
  {
    name: "Bug Condition Exploration (Property 1)",
    file: "tests/bugfix-budget-inline-detection.test.ts",
    description: "Validates that inline budget keywords are detected correctly"
  },
  {
    name: "Preservation Property Tests (Property 2)",
    file: "tests/bugfix-budget-preservation.test.ts",
    description: "Validates that non-budget inputs remain unchanged"
  },
  {
    name: "Comprehensive Unit Tests",
    file: "tests/unit-budget-inline-detection.test.ts",
    description: "Validates all edge cases and scenarios"
  },
  {
    name: "Property-Based Tests",
    file: "tests/pbt-budget-inline-detection.test.ts",
    description: "Validates robustness across diverse input variations"
  }
];

let allPassed = true;
const results: Array<{ name: string; passed: boolean; error?: string }> = [];

for (const test of tests) {
  console.log(`\n[${"=".repeat(60)}]`);
  console.log(`Running: ${test.name}`);
  console.log(`Description: ${test.description}`);
  console.log(`[${"=".repeat(60)}]\n`);
  
  try {
    execSync(`npx tsx ${test.file}`, {
      stdio: "inherit",
      encoding: "utf-8"
    });
    console.log(`\n✅ ${test.name} PASSED\n`);
    results.push({ name: test.name, passed: true });
  } catch (error) {
    console.log(`\n❌ ${test.name} FAILED\n`);
    results.push({ 
      name: test.name, 
      passed: false, 
      error: error instanceof Error ? error.message : String(error)
    });
    allPassed = false;
  }
}

// Final Summary
console.log("\n" + "=".repeat(70));
console.log("  FINAL VALIDATION SUMMARY");
console.log("=".repeat(70));

for (const result of results) {
  const status = result.passed ? "✅ PASS" : "❌ FAIL";
  console.log(`${status} - ${result.name}`);
  if (!result.passed && result.error) {
    console.log(`    Error: ${result.error}`);
  }
}

console.log("=".repeat(70));

if (allPassed) {
  console.log("\n🎉 ALL TESTS PASSED - Bug fix is ready for deployment!");
  console.log("\nSummary:");
  console.log("  ✓ Bug condition exploration: Inline budget keywords now detected");
  console.log("  ✓ Preservation tests: No regressions in non-budget inputs");
  console.log("  ✓ Unit tests: All edge cases covered");
  console.log("  ✓ Property-based tests: Robust across 840+ generated cases");
  console.log("\nThe WhatsApp budget interpretation bug is FIXED.");
  console.log("Budget keywords ('budget', 'anggaran', 'alokasi', 'jatah') are now");
  console.log("correctly detected anywhere in the text, not just at line start.");
  process.exit(0);
} else {
  console.log("\n❌ SOME TESTS FAILED - Review failures before deployment");
  process.exit(1);
}

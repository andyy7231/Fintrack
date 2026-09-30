import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import * as fc from "fast-check";
import {
  hasMultiActionIndicators,
  hasComplexDateExpression,
  extractAccountHint,
  extractCategoryHint,
  findStartingVerb,
  findAmountText,
  hasMultipleAmounts,
  normalizeText,
  EXPENSE_VERBS,
  INCOME_VERBS,
  BUDGET_PREFIXES,
  MULTI_ACTION_INDICATORS,
} from "@/services/ai/regex.utils";
import { parseIndonesianAmount } from "@/services/ai/amount.utils";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function runPropertyBasedTests() {
  console.log("====================================================");
  console.log("    REGEX UTILS PROPERTY-BASED TESTS                ");
  console.log("====================================================");

  // =========================================================================
  // Property 1: Multi-action indicators are always detected in text
  // **Validates: Requirements 5.1**
  // =========================================================================
  console.log("\n[Property 1] Multi-action indicators detection");

  fc.assert(
    fc.property(
      fc.constantFrom(...MULTI_ACTION_INDICATORS),
      fc.string({ minLength: 5, maxLength: 20 }),
      fc.string({ minLength: 5, maxLength: 20 }),
      (indicator, prefix, suffix) => {
        const text = `${prefix}${indicator}${suffix}`;
        const result = hasMultiActionIndicators(text);
        
        if (!result) {
          console.log(`Failed to detect indicator "${indicator}" in: "${text}"`);
        }
        
        return result;
      }
    ),
    { numRuns: 100 }
  );

  console.log("✓ Property 1: Multi-action indicators always detected");

  // =========================================================================
  // Property 2: Amount text extraction produces valid input for amount parser
  // **Validates: Requirements 1.3, 7.1, 7.2, 7.3, 7.4**
  // =========================================================================
  console.log("\n[Property 2] Amount extraction produces parseable values");

  fc.assert(
    fc.property(
      fc.oneof(
        // Generate valid Indonesian amount formats
        fc.integer({ min: 1, max: 999 }).map(n => `${n}rb`),
        fc.integer({ min: 1, max: 999 }).map(n => `${n}ribu`),
        fc.integer({ min: 1, max: 999 }).map(n => `${n}k`),
        fc.integer({ min: 1, max: 9999 }).map(n => `${(n / 10).toFixed(1)}jt`),
        fc.integer({ min: 1, max: 9999 }).map(n => `${(n / 10).toFixed(1)}juta`),
        fc.integer({ min: 1000, max: 999999 }).map(n => `${n}`),
      ),
      fc.constantFrom(...EXPENSE_VERBS),
      fc.constantFrom('kopi', 'parkir', 'makan', 'bensin', 'tiket', 'pulsa'),
      (amountStr, verb, description) => {
        const text = `${verb} ${description} ${amountStr}`;
        const extractedAmount = findAmountText(text);
        
        if (!extractedAmount) {
          console.log(`Failed to extract amount from: "${text}"`);
          return false;
        }
        
        const parsed = parseIndonesianAmount(extractedAmount);
        
        if (!parsed || parsed <= 0) {
          console.log(`Extracted "${extractedAmount}" but failed to parse to positive number`);
          return false;
        }
        
        return true;
      }
    ),
    { numRuns: 100 }
  );

  console.log("✓ Property 2: Extracted amounts are always parseable");

  // =========================================================================
  // Property 3: Verb detection is case-insensitive
  // **Validates: Requirements 1.1, 1.2, 2.1, 2.2, 3.1, 3.2**
  // =========================================================================
  console.log("\n[Property 3] Verb detection is case-insensitive");

  fc.assert(
    fc.property(
      fc.constantFrom(...EXPENSE_VERBS, ...INCOME_VERBS, ...BUDGET_PREFIXES),
      fc.constantFrom('lower', 'upper', 'mixed'),
      (verb, caseType) => {
        let transformedVerb = verb;
        if (caseType === 'upper') {
          transformedVerb = verb.toUpperCase();
        } else if (caseType === 'mixed') {
          transformedVerb = verb.charAt(0).toUpperCase() + verb.slice(1);
        }
        
        const text = `${transformedVerb} kopi 25rb`;
        
        const foundExpense = findStartingVerb(text, EXPENSE_VERBS);
        const foundIncome = findStartingVerb(text, INCOME_VERBS);
        const foundBudget = findStartingVerb(text, BUDGET_PREFIXES);
        
        // At least one should match the original verb
        const matched = foundExpense === verb || foundIncome === verb || foundBudget === verb;
        
        if (!matched) {
          console.log(`Failed to detect "${transformedVerb}" (original: "${verb}")`);
        }
        
        return matched;
      }
    ),
    { numRuns: 100 }
  );

  console.log("✓ Property 3: Verb detection handles all case variations");

  // =========================================================================
  // Property 4: Text normalization is idempotent
  // =========================================================================
  console.log("\n[Property 4] Text normalization is idempotent");

  fc.assert(
    fc.property(
      fc.string({ minLength: 1, maxLength: 100 }),
      (text) => {
        const normalized1 = normalizeText(text);
        const normalized2 = normalizeText(normalized1);
        
        if (normalized1 !== normalized2) {
          console.log(`Normalization not idempotent: "${normalized1}" vs "${normalized2}"`);
          return false;
        }
        
        return true;
      }
    ),
    { numRuns: 100 }
  );

  console.log("✓ Property 4: Normalization is idempotent");

  // =========================================================================
  // Property 5: Account hint extraction consistency
  // **Validates: Requirements 1.5, 2.5**
  // =========================================================================
  console.log("\n[Property 5] Account hint extraction consistency");

  const accountIndicators = ['dari', 'pakai', 'dengan', 'ke', 'masuk'];

  fc.assert(
    fc.property(
      fc.constantFrom(...accountIndicators),
      fc.constantFrom('BCA', 'Mandiri', 'GoPay', 'Cash', 'Dana'),
      fc.constantFrom(...EXPENSE_VERBS),
      fc.integer({ min: 1, max: 999 }).map(n => `${n}rb`),
      (indicator, accountName, verb, amount) => {
        const text = `${verb} kopi ${amount} ${indicator} ${accountName}`;
        const extracted = extractAccountHint(text);
        
        if (!extracted) {
          console.log(`Failed to extract account from: "${text}"`);
          return false;
        }
        
        // Should contain the account name (may have extra text depending on context)
        const containsAccount = extracted.toLowerCase().includes(accountName.toLowerCase());
        
        if (!containsAccount) {
          console.log(`Expected "${accountName}" in extracted "${extracted}"`);
        }
        
        return containsAccount;
      }
    ),
    { numRuns: 100 }
  );

  console.log("✓ Property 5: Account hints extracted consistently");

  // =========================================================================
  // Property 6: Category hint extraction consistency
  // **Validates: Requirements 1.6**
  // =========================================================================
  console.log("\n[Property 6] Category hint extraction consistency");

  fc.assert(
    fc.property(
      fc.constantFrom('makanan', 'transport', 'hiburan', 'belanja', 'kesehatan'),
      fc.constantFrom(...EXPENSE_VERBS),
      fc.integer({ min: 1, max: 999 }).map(n => `${n}rb`),
      (categoryName, verb, amount) => {
        const text = `${verb} kopi ${amount} kategori ${categoryName}`;
        const extracted = extractCategoryHint(text);
        
        if (!extracted) {
          console.log(`Failed to extract category from: "${text}"`);
          return false;
        }
        
        if (extracted.toLowerCase() !== categoryName.toLowerCase()) {
          console.log(`Expected "${categoryName}", got "${extracted}"`);
          return false;
        }
        
        return true;
      }
    ),
    { numRuns: 100 }
  );

  console.log("✓ Property 6: Category hints extracted consistently");

  // =========================================================================
  // Property 7: Multiple amounts detection accuracy
  // **Validates: Requirements 5.1**
  // =========================================================================
  console.log("\n[Property 7] Multiple amounts detection accuracy");

  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 999 }).map(n => `${n}rb`),
      fc.integer({ min: 1, max: 999 }).map(n => `${n}rb`),
      (amount1, amount2) => {
        // Single amount case
        const singleText = `Beli kopi ${amount1}`;
        const singleResult = hasMultipleAmounts(singleText);
        
        if (singleResult) {
          console.log(`False positive: detected multiple amounts in "${singleText}"`);
          return false;
        }
        
        // Multiple amounts case
        const multiText = `Beli kopi ${amount1} dan makan ${amount2}`;
        const multiResult = hasMultipleAmounts(multiText);
        
        if (!multiResult) {
          console.log(`False negative: failed to detect multiple amounts in "${multiText}"`);
          return false;
        }
        
        return true;
      }
    ),
    { numRuns: 100 }
  );

  console.log("✓ Property 7: Multiple amounts detected accurately");

  // =========================================================================
  // Property 8: Complex date patterns are always detected
  // **Validates: Requirements 5.2, 6.4**
  // =========================================================================
  console.log("\n[Property 8] Complex date patterns always detected");

  const complexDateExamples = [
    'jam 3 sore',
    'pukul 15:00',
    'besok',
    'minggu depan',
    '3 hari yang lalu',
    '2 minggu yang lalu',
  ];

  fc.assert(
    fc.property(
      fc.constantFrom(...complexDateExamples),
      fc.constantFrom(...EXPENSE_VERBS),
      fc.integer({ min: 1, max: 999 }).map(n => `${n}rb`),
      (dateExpr, verb, amount) => {
        const text = `${verb} kopi ${amount} ${dateExpr}`;
        const result = hasComplexDateExpression(text);
        
        if (!result) {
          console.log(`Failed to detect complex date in: "${text}"`);
        }
        
        return result;
      }
    ),
    { numRuns: 100 }
  );

  console.log("✓ Property 8: Complex date patterns always detected");

  // =========================================================================
  // Property 9: Normalized text preserves semantic content
  // =========================================================================
  console.log("\n[Property 9] Normalization preserves semantic content");

  fc.assert(
    fc.property(
      fc.constantFrom(...EXPENSE_VERBS),
      fc.string({ minLength: 3, maxLength: 15 }),
      fc.integer({ min: 1, max: 999 }).map(n => `${n}rb`),
      (verb, description, amount) => {
        // Create text with extra whitespace
        const messyText = `  ${verb}    ${description}   ${amount}  `;
        const normalized = normalizeText(messyText);
        
        // Verify all parts are still present
        const hasVerb = normalized.toLowerCase().includes(verb.toLowerCase());
        const hasDescription = normalized.toLowerCase().includes(description.toLowerCase());
        const hasAmount = normalized.includes(amount);
        
        if (!hasVerb || !hasDescription || !hasAmount) {
          console.log(`Normalization lost content: "${messyText}" -> "${normalized}"`);
          return false;
        }
        
        return true;
      }
    ),
    { numRuns: 100 }
  );

  console.log("✓ Property 9: Normalization preserves semantic content");

  // =========================================================================
  // Property 10: Amount extraction handles all valid Indonesian formats
  // **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
  // =========================================================================
  console.log("\n[Property 10] Amount extraction covers all Indonesian formats");

  fc.assert(
    fc.property(
      fc.oneof(
        fc.tuple(
          fc.integer({ min: 1, max: 999 }),
          fc.constantFrom('rb', 'ribu', 'k')
        ).map(([n, suffix]) => `${n}${suffix}`),
        fc.tuple(
          fc.integer({ min: 1, max: 9999 }),
          fc.constantFrom('jt', 'juta')
        ).map(([n, suffix]) => `${(n / 10).toFixed(1)}${suffix}`),
        fc.integer({ min: 1000, max: 999999 }).map(n => `${n}`),
        fc.integer({ min: 1, max: 999 }).map(n => `Rp${n}.000`),
      ),
      (amountStr) => {
        const text = `Beli kopi ${amountStr}`;
        const extracted = findAmountText(text);
        
        if (!extracted) {
          console.log(`Failed to extract from valid format: "${amountStr}"`);
          return false;
        }
        
        const parsed = parseIndonesianAmount(extracted);
        
        if (!parsed || parsed <= 0 || !Number.isFinite(parsed)) {
          console.log(`Extracted "${extracted}" but parsing failed`);
          return false;
        }
        
        return true;
      }
    ),
    { numRuns: 100 }
  );

  console.log("✓ Property 10: All Indonesian amount formats handled");

  console.log("\n====================================================");
  console.log("    ALL PROPERTY-BASED TESTS PASSED ✓              ");
  console.log("====================================================");
}

// Run tests
runPropertyBasedTests()
  .then(() => {
    console.log("\n✅ Property-based test suite completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Property-based test suite failed:", error);
    process.exit(1);
  });

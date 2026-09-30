/**
 * Property-Based Tests for amount normalization utilities
 * 
 * Tests Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 11.1, 11.5
 * Feature: hybrid-parser-optimization
 * 
 * Property 1: Amount normalization preserves value semantics
 * - All valid Indonesian formats normalize to positive numbers
 * - Equivalent formats produce same value
 * - Decimal multipliers work correctly
 */

import * as fc from "fast-check";
import { parseIndonesianAmount } from "@/services/ai/amount.utils";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function testProperty1_AllValidFormatsProducePositiveNumbers() {
  console.log("Property 1a: All valid Indonesian formats normalize to positive numbers (100 iterations)...");
  
  const result = fc.check(
    fc.property(
      fc.oneof(
        // Generate "Xrb" format (1-999 rb)
        fc.integer({ min: 1, max: 999 }).map(n => `${n}rb`),
        // Generate "Xribu" format
        fc.integer({ min: 1, max: 999 }).map(n => `${n}ribu`),
        // Generate "Xk" format
        fc.integer({ min: 1, max: 999 }).map(n => `${n}k`),
        // Generate "X.Xjt" format (decimal juta)
        fc.float({ min: Math.fround(0.1), max: Math.fround(999), noNaN: true, noDefaultInfinity: true })
          .map(n => `${n.toFixed(1)}jt`),
        // Generate "Xjuta" format
        fc.integer({ min: 1, max: 999 }).map(n => `${n}juta`),
        // Generate pure numeric format
        fc.integer({ min: 1000, max: 999999 }).map(n => `${n}`),
      ),
      (amountStr) => {
        const result = parseIndonesianAmount(amountStr);
        
        // Should not be null
        if (result === null) {
          console.error(`Failed to parse: ${amountStr}`);
          return false;
        }
        
        // Should be positive
        if (result <= 0) {
          console.error(`Non-positive result for ${amountStr}: ${result}`);
          return false;
        }
        
        // Should be finite
        if (!Number.isFinite(result)) {
          console.error(`Non-finite result for ${amountStr}: ${result}`);
          return false;
        }
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
  
  assert(result.failed === false, `Property test failed: ${result.counterexample}`);
  console.log("✓ Property 1a passed (100 runs)");
}

async function testProperty1b_EquivalentFormatsSameValue() {
  console.log("Property 1b: Equivalent formats produce same value...");
  
  const equivalentGroups = [
    ["25rb", "25ribu", "25 ribu", "25k", "25000"],
    ["1.5jt", "1,5juta", "1.5 juta", "1500000", "1500rb"],
    ["2jt", "2juta", "2 juta", "2000000", "2000rb"],
    ["100rb", "100ribu", "100k", "100000"],
    ["0.5jt", "0,5juta", "500rb", "500000"],
  ];
  
  for (const group of equivalentGroups) {
    const values = group.map(fmt => parseIndonesianAmount(fmt));
    const first = values[0];
    
    assert(first !== null, `First value in group should not be null: ${group[0]}`);
    
    for (let i = 1; i < values.length; i++) {
      assert(
        values[i] === first,
        `All formats in group should produce same value. ${group[i]} = ${values[i]}, expected ${first}`
      );
    }
  }
  
  console.log("✓ Property 1b passed");
}

async function testProperty1c_DecimalMultipliersCorrect() {
  console.log("Property 1c: Decimal multipliers work correctly (100 iterations)...");
  
  const result = fc.check(
    fc.property(
      // Generate decimal values between 0.1 and 99.9
      fc.float({ min: Math.fround(0.1), max: Math.fround(99.9), noNaN: true, noDefaultInfinity: true }),
      fc.constantFrom("jt", "juta", "rb", "ribu"),
      (floatValue, unit) => {
        // Round to 1 decimal place (as toFixed does)
        const decimalValue = Math.round(floatValue * 10) / 10;
        
        // Test both dot and comma as decimal separator
        const amountWithDot = `${decimalValue}${unit}`;
        const amountWithComma = `${decimalValue.toString().replace(".", ",")}${unit}`;
        
        const resultDot = parseIndonesianAmount(amountWithDot);
        const resultComma = parseIndonesianAmount(amountWithComma);
        
        // Both should succeed
        if (resultDot === null || resultComma === null) {
          console.error(`Failed to parse: ${amountWithDot} or ${amountWithComma}`);
          return false;
        }
        
        // Both should produce same result
        if (resultDot !== resultComma) {
          console.error(`Inconsistent results: ${amountWithDot} = ${resultDot}, ${amountWithComma} = ${resultComma}`);
          return false;
        }
        
        // Calculate expected value using the rounded decimal
        const multiplier = (unit === "jt" || unit === "juta") ? 1000000 : 1000;
        const expected = Math.round(decimalValue * multiplier * 100) / 100;
        
        // Result should match expected (within tolerance for floating point rounding)
        // The parser rounds to 2 decimal places, so tolerance should account for that
        const tolerance = 1; // 1 rupiah tolerance is reasonable
        if (Math.abs(resultDot - expected) > tolerance) {
          console.error(`Incorrect calculation: ${amountWithDot} = ${resultDot}, expected ${expected}`);
          return false;
        }
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
  
  assert(result.failed === false, `Property test failed: ${result.counterexample}`);
  console.log("✓ Property 1c passed (100 runs)");
}

async function testProperty2_ConsistentParsing() {
  console.log("Property 2: Amount parsing is deterministic (100 iterations)...");
  
  const result = fc.check(
    fc.property(
      fc.oneof(
        fc.integer({ min: 1, max: 999 }).map(n => `${n}rb`),
        fc.integer({ min: 1, max: 99 }).map(n => `${n}jt`),
        fc.integer({ min: 1000, max: 999999 }),
      ),
      (amount) => {
        const amountStr = typeof amount === 'number' ? `${amount}` : amount;
        
        // Parse multiple times
        const result1 = parseIndonesianAmount(amountStr);
        const result2 = parseIndonesianAmount(amountStr);
        const result3 = parseIndonesianAmount(amountStr);
        
        // All should be identical
        if (result1 !== result2 || result2 !== result3) {
          console.error(`Non-deterministic parsing for ${amountStr}: ${result1}, ${result2}, ${result3}`);
          return false;
        }
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
  
  assert(result.failed === false, `Property test failed: ${result.counterexample}`);
  console.log("✓ Property 2 passed (100 runs)");
}

async function testProperty3_NegativeInputsSafelyRejected() {
  console.log("Property 3: Invalid/negative inputs safely return null...");
  
  const result = fc.check(
    fc.property(
      fc.oneof(
        // Invalid strings
        fc.string().filter(s => !s.match(/\d/)), // Strings without digits
        // Empty/whitespace
        fc.constant(""),
        fc.constant("   "),
        // Negative numbers
        fc.integer({ max: 0 }),
      ),
      (invalidInput) => {
        const result = parseIndonesianAmount(invalidInput as any);
        
        // Should return null for invalid inputs
        if (result !== null) {
          console.error(`Expected null for invalid input: ${JSON.stringify(invalidInput)}, got ${result}`);
          return false;
        }
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
  
  assert(result.failed === false, `Property test failed: ${result.counterexample}`);
  console.log("✓ Property 3 passed (100 runs)");
}

async function testProperty4_LargeValuesHandled() {
  console.log("Property 4: Large values (miliar/billions) handled correctly...");
  
  const result = fc.check(
    fc.property(
      fc.float({ min: Math.fround(0.1), max: Math.fround(999), noNaN: true, noDefaultInfinity: true }),
      (floatValue) => {
        // Round to 1 decimal place (as toFixed does)
        const value = Math.round(floatValue * 10) / 10;
        
        // Test miliar/m (billions)
        const amountStr = `${value}m`;
        const result = parseIndonesianAmount(amountStr);
        
        if (result === null) {
          console.error(`Failed to parse: ${amountStr}`);
          return false;
        }
        
        // Should be in billions range
        const expected = Math.round(value * 1000000000 * 100) / 100;
        const tolerance = 100; // 100 rupiah tolerance for very large values
        
        if (Math.abs(result - expected) > tolerance) {
          console.error(`Incorrect parsing: ${amountStr} = ${result}, expected ${expected}`);
          return false;
        }
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
  
  assert(result.failed === false, `Property test failed: ${result.counterexample}`);
  console.log("✓ Property 4 passed (100 runs)");
}

async function runAllPropertyTests() {
  console.log("\n========================================");
  console.log("Amount Normalization Property-Based Tests");
  console.log("Feature: hybrid-parser-optimization");
  console.log("Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 11.1, 11.5");
  console.log("Minimum 100 iterations per property");
  console.log("========================================\n");
  
  try {
    await testProperty1_AllValidFormatsProducePositiveNumbers();
    await testProperty1b_EquivalentFormatsSameValue();
    await testProperty1c_DecimalMultipliersCorrect();
    await testProperty2_ConsistentParsing();
    await testProperty3_NegativeInputsSafelyRejected();
    await testProperty4_LargeValuesHandled();
    
    console.log("\n========================================");
    console.log("✓ ALL PROPERTY TESTS PASSED");
    console.log("Total property checks: 500+ iterations");
    console.log("========================================\n");
  } catch (error) {
    console.error("\n========================================");
    console.error("✗ PROPERTY TEST FAILED");
    console.error("========================================");
    console.error(error);
    process.exit(1);
  }
}

runAllPropertyTests();

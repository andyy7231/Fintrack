/**
 * Unit tests for amount normalization utilities
 * 
 * Tests Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 * Feature: hybrid-parser-optimization
 */

import { parseIndonesianAmount, formatRupiah } from "@/services/ai/amount.utils";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function testThousandSeparators() {
  console.log("Testing thousand separators (rb, ribu, k)...");
  
  // Requirement 7.1: Recognize Indonesian thousand separators
  assert(parseIndonesianAmount("25rb") === 25000, "'25rb' should parse to 25000");
  assert(parseIndonesianAmount("25ribu") === 25000, "'25ribu' should parse to 25000");
  assert(parseIndonesianAmount("25 ribu") === 25000, "'25 ribu' should parse to 25000");
  assert(parseIndonesianAmount("25k") === 25000, "'25k' should parse to 25000");
  assert(parseIndonesianAmount("25 k") === 25000, "'25 k' should parse to 25000");
  
  // Test larger values
  assert(parseIndonesianAmount("500rb") === 500000, "'500rb' should parse to 500000");
  assert(parseIndonesianAmount("999ribu") === 999000, "'999ribu' should parse to 999000");
  
  console.log("✓ Thousand separators test passed");
}

async function testMillionSeparators() {
  console.log("Testing million separators (jt, juta)...");
  
  // Requirement 7.2: Recognize Indonesian million separators
  assert(parseIndonesianAmount("1jt") === 1000000, "'1jt' should parse to 1000000");
  assert(parseIndonesianAmount("1juta") === 1000000, "'1juta' should parse to 1000000");
  assert(parseIndonesianAmount("1 juta") === 1000000, "'1 juta' should parse to 1000000");
  assert(parseIndonesianAmount("2jt") === 2000000, "'2jt' should parse to 2000000");
  assert(parseIndonesianAmount("10 juta") === 10000000, "'10 juta' should parse to 10000000");
  
  console.log("✓ Million separators test passed");
}

async function testDecimalMultipliers() {
  console.log("Testing decimal multipliers...");
  
  // Requirement 7.3: Treat decimal point/comma as multiplier
  assert(parseIndonesianAmount("1.5jt") === 1500000, "'1.5jt' should parse to 1500000");
  assert(parseIndonesianAmount("1,5jt") === 1500000, "'1,5jt' should parse to 1500000");
  assert(parseIndonesianAmount("1.5juta") === 1500000, "'1.5juta' should parse to 1500000");
  assert(parseIndonesianAmount("1,5juta") === 1500000, "'1,5juta' should parse to 1500000");
  assert(parseIndonesianAmount("1.5 juta") === 1500000, "'1.5 juta' should parse to 1500000");
  assert(parseIndonesianAmount("1,5 juta") === 1500000, "'1,5 juta' should parse to 1500000");
  
  // Test more decimal values
  assert(parseIndonesianAmount("2.5jt") === 2500000, "'2.5jt' should parse to 2500000");
  assert(parseIndonesianAmount("7,5juta") === 7500000, "'7,5juta' should parse to 7500000");
  assert(parseIndonesianAmount("0.5jt") === 500000, "'0.5jt' should parse to 500000");
  
  // Test decimal thousands
  assert(parseIndonesianAmount("1.5rb") === 1500, "'1.5rb' should parse to 1500");
  assert(parseIndonesianAmount("2,5ribu") === 2500, "'2,5ribu' should parse to 2500");
  
  console.log("✓ Decimal multipliers test passed");
}

async function testPureNumeric() {
  console.log("Testing pure numeric amounts...");
  
  // Requirement 7.4: Accept exact amounts without abbreviation
  assert(parseIndonesianAmount("25000") === 25000, "'25000' should parse to 25000");
  assert(parseIndonesianAmount("5000") === 5000, "'5000' should parse to 5000");
  assert(parseIndonesianAmount("1500000") === 1500000, "'1500000' should parse to 1500000");
  assert(parseIndonesianAmount("50") === 50, "'50' should parse to 50");
  
  // Test numeric input
  assert(parseIndonesianAmount(25000) === 25000, "25000 (number) should parse to 25000");
  assert(parseIndonesianAmount(1500000) === 1500000, "1500000 (number) should parse to 1500000");
  
  console.log("✓ Pure numeric test passed");
}

async function testIndonesianThousandFormat() {
  console.log("Testing Indonesian thousand format (dot separator)...");
  
  // Indonesian standard: dot as thousand separator
  assert(parseIndonesianAmount("25.000") === 25000, "'25.000' should parse to 25000");
  assert(parseIndonesianAmount("1.500.000") === 1500000, "'1.500.000' should parse to 1500000");
  assert(parseIndonesianAmount("100.000") === 100000, "'100.000' should parse to 100000");
  
  console.log("✓ Indonesian thousand format test passed");
}

async function testCurrencyPrefixes() {
  console.log("Testing currency prefixes...");
  
  // Test Rp prefix removal
  assert(parseIndonesianAmount("Rp25.000") === 25000, "'Rp25.000' should parse to 25000");
  assert(parseIndonesianAmount("Rp 25.000") === 25000, "'Rp 25.000' should parse to 25000");
  assert(parseIndonesianAmount("rp25rb") === 25000, "'rp25rb' should parse to 25000");
  assert(parseIndonesianAmount("Rp.25.000") === 25000, "'Rp.25.000' should parse to 25000");
  assert(parseIndonesianAmount("Rp1.5jt") === 1500000, "'Rp1.5jt' should parse to 1500000");
  
  console.log("✓ Currency prefixes test passed");
}

async function testEquivalentFormats() {
  console.log("Testing equivalent formats produce same value...");
  
  // Requirement 7.5: Same utilities used for consistency
  // Test that equivalent formats all produce 25000
  const formats25k = ["25rb", "25ribu", "25 ribu", "25k", "25000", "Rp25.000"];
  const expected = 25000;
  
  for (const format of formats25k) {
    const result = parseIndonesianAmount(format);
    assert(result === expected, `'${format}' should parse to ${expected}, got ${result}`);
  }
  
  // Test that equivalent formats all produce 1500000
  const formats1_5M = ["1.5jt", "1,5jt", "1.5juta", "1,5juta", "1500000", "1.500.000", "1500rb"];
  const expected2 = 1500000;
  
  for (const format of formats1_5M) {
    const result = parseIndonesianAmount(format);
    assert(result === expected2, `'${format}' should parse to ${expected2}, got ${result}`);
  }
  
  console.log("✓ Equivalent formats test passed");
}

async function testEdgeCases() {
  console.log("Testing edge cases...");
  
  // Requirement 7.6: Handle ambiguous formats
  // Null/undefined inputs
  assert(parseIndonesianAmount(null as any) === null, "null should return null");
  assert(parseIndonesianAmount(undefined as any) === null, "undefined should return null");
  assert(parseIndonesianAmount("") === null, "empty string should return null");
  assert(parseIndonesianAmount("   ") === null, "whitespace should return null");
  
  // Invalid inputs
  assert(parseIndonesianAmount("abc") === null, "'abc' should return null");
  assert(parseIndonesianAmount("xyz123") === null, "'xyz123' should return null");
  
  // Zero and negative (should return null for non-positive)
  assert(parseIndonesianAmount("0") === null, "'0' should return null");
  assert(parseIndonesianAmount("-100") === null, "'-100' should return null");
  assert(parseIndonesianAmount(-100) === null, "-100 (number) should return null");
  
  // Special numeric values
  assert(parseIndonesianAmount(Infinity) === null, "Infinity should return null");
  assert(parseIndonesianAmount(NaN) === null, "NaN should return null");
  
  console.log("✓ Edge cases test passed");
}

async function testAmbiguousFormats() {
  console.log("Testing potentially ambiguous formats...");
  
  // English-style thousand separator (commas)
  assert(parseIndonesianAmount("25,000") === 25000, "'25,000' should parse to 25000");
  assert(parseIndonesianAmount("1,500,000") === 1500000, "'1,500,000' should parse to 1500000");
  
  // Test miliar/m for billions (mentioned in code)
  assert(parseIndonesianAmount("1miliar") === 1000000000, "'1miliar' should parse to 1000000000");
  assert(parseIndonesianAmount("1m") === 1000000000, "'1m' should parse to 1000000000");
  assert(parseIndonesianAmount("2.5m") === 2500000000, "'2.5m' should parse to 2500000000");
  
  console.log("✓ Ambiguous formats test passed");
}

async function testFormatRupiah() {
  console.log("Testing formatRupiah function...");
  
  // Test basic formatting
  assert(formatRupiah(25000) === "Rp25.000", "25000 should format to 'Rp25.000'");
  assert(formatRupiah(1500000) === "Rp1.500.000", "1500000 should format to 'Rp1.500.000'");
  assert(formatRupiah(5000) === "Rp5.000", "5000 should format to 'Rp5.000'");
  
  // Test rounding
  assert(formatRupiah(25000.75) === "Rp25.001", "25000.75 should round to 'Rp25.001'");
  assert(formatRupiah(25000.25) === "Rp25.000", "25000.25 should round to 'Rp25.000'");
  
  console.log("✓ formatRupiah test passed");
}

async function testRoundTripConsistency() {
  console.log("Testing round-trip consistency...");
  
  // Parse then format should produce consistent representation
  const testValues = [
    { input: "25rb", amount: 25000 },
    { input: "1.5jt", amount: 1500000 },
    { input: "500ribu", amount: 500000 },
    { input: "10juta", amount: 10000000 }
  ];
  
  for (const { input, amount } of testValues) {
    const parsed = parseIndonesianAmount(input);
    assert(parsed === amount, `'${input}' should parse to ${amount}, got ${parsed}`);
    
    const formatted = formatRupiah(parsed!);
    assert(formatted !== null && formatted.includes("Rp"), `Formatting ${amount} should produce Rupiah string, got '${formatted}'`);
  }
  
  console.log("✓ Round-trip consistency test passed");
}

async function runAllTests() {
  console.log("\n========================================");
  console.log("Amount Normalization Test Suite");
  console.log("Feature: hybrid-parser-optimization");
  console.log("Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6");
  console.log("========================================\n");
  
  try {
    await testThousandSeparators();
    await testMillionSeparators();
    await testDecimalMultipliers();
    await testPureNumeric();
    await testIndonesianThousandFormat();
    await testCurrencyPrefixes();
    await testEquivalentFormats();
    await testEdgeCases();
    await testAmbiguousFormats();
    await testFormatRupiah();
    await testRoundTripConsistency();
    
    console.log("\n========================================");
    console.log("✓ ALL TESTS PASSED");
    console.log("========================================\n");
  } catch (error) {
    console.error("\n========================================");
    console.error("✗ TEST FAILED");
    console.error("========================================");
    console.error(error);
    process.exit(1);
  }
}

runAllTests();

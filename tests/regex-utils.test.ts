import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import {
  hasMultiActionIndicators,
  hasComplexDateExpression,
  hasAmbiguousModifiers,
  extractAccountHint,
  extractCategoryHint,
  findStartingVerb,
  extractBetweenVerbAndAmount,
  findAmountText,
  hasMultipleAmounts,
  isSafeInput,
  normalizeText,
  looksLikeBudgetCommand,
  looksLikeExpenseCommand,
  looksLikeIncomeCommand,
  EXPENSE_VERBS,
  INCOME_VERBS,
  BUDGET_PREFIXES,
} from "@/services/ai/regex.utils";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function runRegexUtilsTests() {
  console.log("====================================================");
  console.log("    REGEX UTILITIES MODULE TESTS                    ");
  console.log("====================================================");

  // =========================================================================
  // Test Suite 1: Multi-Action Detection
  // =========================================================================
  console.log("\n[1] Multi-Action Detection Tests");

  assert(
    hasMultiActionIndicators("Beli kopi 25rb dan makan siang 50rb"),
    "Should detect 'dan' as multi-action indicator"
  );

  assert(
    hasMultiActionIndicators("Bayar parkir 5rb serta tiket 10rb"),
    "Should detect 'serta' as multi-action indicator"
  );

  assert(
    hasMultiActionIndicators("Beli kopi 25rb, makan siang 50rb"),
    "Should detect comma as multi-action indicator"
  );

  assert(
    !hasMultiActionIndicators("Beli kopi 25rb"),
    "Should NOT detect single action as multi-action"
  );

  // Note: This is an edge case where 'dan' appears in description
  // The function conservatively detects it as potential multi-action
  // Pattern parser will fail gracefully and AI will handle it correctly
  assert(
    hasMultiActionIndicators("Belanja di toko dan supermarket 100rb"),
    "Should conservatively detect 'dan' even in description (AI will handle correctly)"
  );

  console.log("✓ Multi-action detection working correctly");

  // =========================================================================
  // Test Suite 2: Complex Date Expression Detection
  // =========================================================================
  console.log("\n[2] Complex Date Expression Detection Tests");

  assert(
    hasComplexDateExpression("Beli kopi 25rb 3 hari yang lalu"),
    "Should detect '3 hari yang lalu' as complex date"
  );

  assert(
    hasComplexDateExpression("Bayar parkir 5rb jam 3 sore"),
    "Should detect 'jam 3 sore' as complex date"
  );

  assert(
    hasComplexDateExpression("Besok bayar tagihan 100rb"),
    "Should detect 'besok' (future date) as complex"
  );

  assert(
    hasComplexDateExpression("Minggu depan beli laptop 5jt"),
    "Should detect 'minggu depan' as complex date"
  );

  assert(
    !hasComplexDateExpression("Kemarin beli kopi 25rb"),
    "Should NOT detect 'kemarin' as complex date"
  );

  assert(
    !hasComplexDateExpression("Hari ini bayar parkir 5rb"),
    "Should NOT detect 'hari ini' as complex date"
  );

  console.log("✓ Complex date detection working correctly");

  // =========================================================================
  // Test Suite 3: Ambiguous Modifier Detection
  // =========================================================================
  console.log("\n[3] Ambiguous Modifier Detection Tests");

  assert(
    hasAmbiguousModifiers("Kemarin kayaknya habis sekitar 50rb"),
    "Should detect 'kayaknya' and 'sekitar' as ambiguous"
  );

  assert(
    hasAmbiguousModifiers("Mungkin kemarin beli kopi 25rb"),
    "Should detect 'mungkin' as ambiguous"
  );

  assert(
    hasAmbiguousModifiers("Kira-kira 100rb untuk belanja"),
    "Should detect 'kira-kira' as ambiguous"
  );

  assert(
    hasAmbiguousModifiers("Sepertinya habis 50rb kemarin"),
    "Should detect 'sepertinya' as ambiguous"
  );

  assert(
    !hasAmbiguousModifiers("Kemarin beli kopi 25rb"),
    "Should NOT detect clear statement as ambiguous"
  );

  console.log("✓ Ambiguous modifier detection working correctly");

  // =========================================================================
  // Test Suite 4: Account Hint Extraction
  // =========================================================================
  console.log("\n[4] Account Hint Extraction Tests");

  assert(
    extractAccountHint("Beli kopi 25rb dari BCA") === "BCA",
    "Should extract account hint 'BCA' with 'dari' indicator"
  );

  assert(
    extractAccountHint("Bayar parkir 5rb pakai GoPay") === "GoPay",
    "Should extract account hint 'GoPay' with 'pakai' indicator"
  );

  assert(
    extractAccountHint("Gaji 10jt ke Mandiri") === "Mandiri",
    "Should extract account hint 'Mandiri' with 'ke' indicator"
  );

  assert(
    extractAccountHint("Transfer 500rb masuk BCA") === "BCA",
    "Should extract account hint 'BCA' with 'masuk' indicator"
  );

  assert(
    extractAccountHint("Beli kopi 25rb di Starbucks lewat BCA") === "Starbucks lewat BCA",
    "Should extract account hint with 'di' indicator"
  );

  assert(
    extractAccountHint("Beli kopi 25rb") === null,
    "Should return null when no account hint present"
  );

  console.log("✓ Account hint extraction working correctly");

  // =========================================================================
  // Test Suite 5: Category Hint Extraction
  // =========================================================================
  console.log("\n[5] Category Hint Extraction Tests");

  assert(
    extractCategoryHint("Beli kopi 25rb kategori makanan") === "makanan",
    "Should extract category hint 'makanan'"
  );

  assert(
    extractCategoryHint("Bayar parkir 5rb kategori transport") === "transport",
    "Should extract category hint 'transport'"
  );

  assert(
    extractCategoryHint("Beli kopi 25rb") === null,
    "Should return null when no category hint present"
  );

  console.log("✓ Category hint extraction working correctly");

  // =========================================================================
  // Test Suite 6: Starting Verb Detection
  // =========================================================================
  console.log("\n[6] Starting Verb Detection Tests");

  assert(
    findStartingVerb("Beli kopi 25rb", EXPENSE_VERBS) === "beli",
    "Should find 'beli' as starting verb"
  );

  assert(
    findStartingVerb("Bayar parkir 5rb", EXPENSE_VERBS) === "bayar",
    "Should find 'bayar' as starting verb"
  );

  assert(
    findStartingVerb("Gaji 10jt", INCOME_VERBS) === "gaji",
    "Should find 'gaji' as starting verb"
  );

  assert(
    findStartingVerb("Terima transfer 500rb", INCOME_VERBS) === "terima",
    "Should find 'terima' as starting verb"
  );

  assert(
    findStartingVerb("Budget makan 1jt", BUDGET_PREFIXES) === "budget",
    "Should find 'budget' as starting verb"
  );

  assert(
    findStartingVerb("Halo selamat pagi", EXPENSE_VERBS) === null,
    "Should return null when no matching verb found"
  );

  console.log("✓ Starting verb detection working correctly");

  // =========================================================================
  // Test Suite 7: Extract Between Verb and Amount
  // =========================================================================
  console.log("\n[7] Extract Between Verb and Amount Tests");

  assert(
    extractBetweenVerbAndAmount("Beli kopi 25rb", "beli", "25rb") === "kopi",
    "Should extract 'kopi' between 'beli' and '25rb'"
  );

  assert(
    extractBetweenVerbAndAmount("Bayar parkir mobil 5rb", "bayar", "5rb") === "parkir mobil",
    "Should extract multi-word description"
  );

  assert(
    extractBetweenVerbAndAmount("Gaji 10jt", "gaji", "10jt") === "",
    "Should return empty string when no text between verb and amount"
  );

  console.log("✓ Extract between verb and amount working correctly");

  // =========================================================================
  // Test Suite 8: Find Amount Text
  // =========================================================================
  console.log("\n[8] Find Amount Text Tests");

  assert(
    findAmountText("Beli kopi 25rb") === "25rb",
    "Should find '25rb' as amount text"
  );

  assert(
    findAmountText("Gaji 1.5jt") === "1.5jt",
    "Should find '1.5jt' as amount text"
  );

  assert(
    findAmountText("Bayar parkir 5000") === "5000",
    "Should find '5000' as amount text"
  );

  assert(
    findAmountText("Budget transport 500k") === "500k",
    "Should find '500k' as amount text"
  );

  assert(
    findAmountText("Halo selamat pagi") === null,
    "Should return null when no amount found"
  );

  console.log("✓ Find amount text working correctly");

  // =========================================================================
  // Test Suite 9: Multiple Amounts Detection
  // =========================================================================
  console.log("\n[9] Multiple Amounts Detection Tests");

  assert(
    hasMultipleAmounts("Beli kopi 25rb dan makan 50rb"),
    "Should detect multiple amounts in text"
  );

  assert(
    hasMultipleAmounts("Transfer 100rb dan 200rb"),
    "Should detect multiple numeric amounts"
  );

  assert(
    !hasMultipleAmounts("Beli kopi 25rb"),
    "Should NOT detect multiple amounts in single transaction"
  );

  console.log("✓ Multiple amounts detection working correctly");

  // =========================================================================
  // Test Suite 10: Safe Input Validation
  // =========================================================================
  console.log("\n[10] Safe Input Validation Tests");

  assert(
    isSafeInput("Beli kopi 25rb"),
    "Should accept normal transaction as safe"
  );

  assert(
    !isSafeInput("<script>alert('xss')</script>"),
    "Should reject XSS attempt"
  );

  assert(
    !isSafeInput("Beli kopi 25rb' UNION SELECT * FROM users--"),
    "Should reject SQL injection attempt"
  );

  assert(
    !isSafeInput("exec('rm -rf /')"),
    "Should reject code injection attempt"
  );

  console.log("✓ Safe input validation working correctly");

  // =========================================================================
  // Test Suite 11: Text Normalization
  // =========================================================================
  console.log("\n[11] Text Normalization Tests");

  assert(
    normalizeText("Beli  kopi   25rb") === "Beli kopi 25rb",
    "Should normalize multiple spaces"
  );

  assert(
    normalizeText("  Gaji 10jt  ") === "Gaji 10jt",
    "Should trim leading and trailing spaces"
  );

  assert(
    normalizeText("Bayar\t\tparkir\t5rb") === "Bayar parkir 5rb",
    "Should normalize tabs to single space"
  );

  console.log("✓ Text normalization working correctly");

  // =========================================================================
  // Test Suite 12: Command Type Detection (Pre-checks)
  // =========================================================================
  console.log("\n[12] Command Type Detection Tests");

  assert(
    looksLikeBudgetCommand("Budget makan 1jt"),
    "Should detect budget command"
  );

  assert(
    looksLikeBudgetCommand("Anggaran transport 500rb"),
    "Should detect 'anggaran' as budget command"
  );

  assert(
    looksLikeBudgetCommand("Alokasi hiburan 800k"),
    "Should detect 'alokasi' as budget command"
  );

  assert(
    !looksLikeBudgetCommand("Beli kopi 25rb"),
    "Should NOT detect expense as budget command"
  );

  assert(
    looksLikeExpenseCommand("Beli kopi 25rb"),
    "Should detect expense command"
  );

  assert(
    looksLikeExpenseCommand("Bayar parkir 5rb"),
    "Should detect 'bayar' as expense command"
  );

  assert(
    !looksLikeExpenseCommand("Gaji 10jt"),
    "Should NOT detect income as expense command"
  );

  assert(
    looksLikeIncomeCommand("Gaji 10jt"),
    "Should detect income command"
  );

  assert(
    looksLikeIncomeCommand("Terima transfer 500rb"),
    "Should detect 'terima' as income command"
  );

  assert(
    !looksLikeIncomeCommand("Beli kopi 25rb"),
    "Should NOT detect expense as income command"
  );

  console.log("✓ Command type detection working correctly");

  // =========================================================================
  // Test Suite 13: Edge Cases
  // =========================================================================
  console.log("\n[13] Edge Cases Tests");

  // Empty input handling
  assert(
    findAmountText("") === null,
    "Should handle empty string gracefully"
  );

  assert(
    extractAccountHint("") === null,
    "Should handle empty string for account hint"
  );

  assert(
    !hasMultiActionIndicators(""),
    "Should handle empty string for multi-action check"
  );

  // Case insensitivity
  assert(
    findStartingVerb("BELI kopi 25rb", EXPENSE_VERBS) === "beli",
    "Should handle uppercase verbs (case insensitive)"
  );

  assert(
    extractAccountHint("Beli kopi 25rb DARI BCA") === "BCA",
    "Should handle uppercase indicators (case insensitive)"
  );

  // Amount formats
  assert(
    findAmountText("Rp25.000") !== null,
    "Should find amount with currency prefix and thousand separator"
  );

  assert(
    findAmountText("1,5jt") !== null,
    "Should find amount with comma decimal separator"
  );

  console.log("✓ Edge cases handled correctly");

  console.log("\n====================================================");
  console.log("    ALL REGEX UTILITIES TESTS PASSED ✓             ");
  console.log("====================================================");
}

// Run tests
runRegexUtilsTests()
  .then(() => {
    console.log("\n✅ Test suite completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Test suite failed:", error);
    process.exit(1);
  });

# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Category Inference Missing for Description Keywords
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing cases with known category keywords
  - Test that parseExpense() returns categoryHint=null for commands with category keywords but no explicit "kategori" keyword
  - Test cases: "makan 5k", "bensin 50rb", "pulsa 25k", "beli kopi 15k"
  - The test assertions should match the Expected Behavior Properties from design (automatic category inference)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found: categoryHint should be null, transactions default to "Lainnya"
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Explicit Category Precedence and Non-Category Commands
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs:
    - Commands with explicit "kategori" keyword: "makan 5k kategori snack"
    - Commands with no category keywords: "unknown item 5k"
    - Commands with multi-action detection: "makan 5k dan bensin 10k"
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Test that explicit category extraction takes precedence over inference
  - Test that commands without category keywords still work (categoryHint=null or "Lainnya")
  - Test that all other parseExpense phases remain unchanged (amount, date, account hints)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 3.7_

- [x] 3. Fix for pattern parser category inference

  - [x] 3.1 Export inferCategoryHint from provider.ts
    - Open `services/ai/provider.ts`
    - Find the `inferCategoryHint` function declaration
    - Change `function inferCategoryHint(lower: string): string` to `export function inferCategoryHint(lower: string): string`
    - No logic changes needed - function already implements comprehensive keyword matching
    - _Bug_Condition: isBugCondition(input) where extractCategoryHint(input) returns null and input contains category keywords_
    - _Expected_Behavior: inferCategoryHint() is available for import by pattern-parser.service.ts_
    - _Preservation: AI parser's existing use of inferCategoryHint() remains unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8_

  - [x] 3.2 Import and use inferCategoryHint in pattern-parser.service.ts
    - Open `services/ai/pattern-parser.service.ts`
    - Add `inferCategoryHint` to the existing import from `'./provider'`:
      ```typescript
      import { isBalanceQuery, isFreeCashQuery, inferAccountHint, inferCategoryHint } from './provider';
      ```
    - Find Phase 8 (category extraction) in parseExpense function
    - Replace single-line extraction with inference fallback:
      ```typescript
      // Phase 8: Extract optional category hint (Requirement 1.6)
      // Try explicit "kategori" keyword first, fallback to automatic inference
      let categoryHint = extractCategoryHint(text);
      
      if (categoryHint === null) {
        // No explicit category keyword found, attempt automatic inference
        categoryHint = inferCategoryHint(text.toLowerCase());
      }
      ```
    - No changes to other phases needed
    - _Bug_Condition: isBugCondition(input) from design_
    - _Expected_Behavior: When extractCategoryHint returns null, inferCategoryHint is called as fallback_
    - _Preservation: Explicit category extraction still takes precedence, all other phases unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 3.1, 3.2, 3.5, 3.6, 3.7_

  - [x] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Automatic Category Inference Working
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify parseExpense() now returns correct categoryHint for:
      - "makan 5k" → categoryHint="Makanan & Minuman"
      - "bensin 50rb" → categoryHint="Transportasi"
      - "pulsa 25k" → categoryHint="Tagihan & Utilitas"
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - No Regressions
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix:
      - Explicit category keywords still take precedence
      - Commands without category keywords still work correctly
      - Amount, date, and account hint extraction unchanged
      - Multi-action detection still triggers AI fallback
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 3.7_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run all tests for pattern parser and category inference
  - Verify no regressions in other parser functions (parseIncome, parseBudgetAllocation)
  - Ensure all tests pass, ask the user if questions arise

- [x] 5. Commit and document changes
  - Create git commit with clear message describing the bugfix
  - Update CLAUDE.md or relevant documentation if needed
  - Ensure commit message references bug condition and fix validation

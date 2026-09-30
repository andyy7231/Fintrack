# Implementation Plan

## Overview

This plan implements support for verbless Indonesian expense commands (e.g., "makan 12k", "kopi 5rb") in the pattern parser. The implementation follows the bug condition methodology: explore the bug first, preserve existing behavior, then apply the fix.

---

## Tasks

- [-] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Verbless Expense Commands Fail to Parse
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing cases (verbless expense commands)
  - Create test file: `__tests__/services/ai/pattern-parser-verbless-bugfix.test.ts`
  - Test that `PatternParserService.attemptPatternParse()` fails for verbless expense commands:
    - "makan 12k" → currently returns NO_MATCH, should parse as expense
    - "kopi 5rb" → currently returns NO_MATCH, should parse as expense
    - "bensin 50k" → currently returns NO_MATCH, should parse as expense
    - "parkir 3000 dari BCA" → currently returns NO_MATCH, should parse with account hint
    - "makan siang 45rb" → currently returns NO_MATCH, should parse multi-word description
  - For each test case, assert the expected behavior (what it SHOULD do after fix):
    - `result.success === true`
    - `result.intent.intent === 'EXPENSE'`
    - `result.intent.amount` matches expected value
    - `result.intent.description` equals pre-amount text
    - `result.parseMethod === 'PATTERN'`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: All tests FAIL (this is correct - it proves the bug exists)
  - Document counterexamples found in test output comments
  - Mark task complete when test is written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

- [~] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Parsing Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (verb-based commands, income, budget, multi-action, etc.)
  - Create test file: `__tests__/services/ai/pattern-parser-preservation.test.ts`
  - Write property-based tests capturing observed behavior patterns:
    - Verb-based expense commands continue to parse: "beli kopi 25rb"
    - Verb-based with hints: "bayar parkir 5000 dari BCA kategori transport"
    - Multi-action detection still triggers null: "makan 12k dan kopi 5rb"
    - Ambiguity detection still triggers null: "makan kayaknya 12k"
    - Complex date detection still triggers null: "makan 12k 3 hari yang lalu"
    - Income commands not affected: "gaji 10jt" (handled by parseIncome)
    - Budget commands not affected: "budget makan 1jt" (handled by parseBudgetAllocation)
    - Invalid inputs still fail: empty string, no amount, malicious patterns
  - Property-based testing approach: generate many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11_

- [ ] 3. Fix for verbless expense parsing

  - [~] 3.1 Implement the fix in parseExpense()
    - Open `services/ai/pattern-parser.service.ts`
    - Locate `parseExpense()` method (starts around line 368)
    - **Change 1**: Modify verb matching logic (lines 378-382)
      - Change from mandatory verb requirement to optional verb detection
      - Store verb match result but don't return null immediately
      - Code: `const matchedVerb = findStartingVerb(text, EXPENSE_VERBS); const hasVerb = matchedVerb !== null;`
    - **Change 2**: Add verbless command detection (after amount validation, before description extraction)
      - Check if command is verbless (no verb but has amount)
      - Validate that verbless command has description before amount
      - Check for income/budget verbs to avoid misclassification
      - Extract description as text before amount for verbless commands
      - Return null if no description found
    - **Change 3**: Modify description extraction logic (lines 402-407)
      - Add conditional: if hasVerb, use `extractBetweenVerbAndAmount()` (existing logic)
      - If no verb, use pre-amount text as description (already extracted in Change 2)
      - Maintain fail-fast for missing description in verb-based commands
    - **Change 4**: Verify hint extraction works for verbless commands
      - No changes needed - `extractAccountHint()`, `extractCategoryHint()`, and date extraction work independently
    - _Bug_Condition: isBugCondition(input) where input has valid amount, no leading verb (expense/income/budget), has pre-amount description text, passes safety checks, and has no multi-action indicators_
    - _Expected_Behavior: parseExpense returns PatternParsedIntent with intent='EXPENSE', extracted amount, pre-amount text as description, and any optional hints (account, category, date)_
    - _Preservation: All existing parsing behaviors for verb-based commands, income, budgets, multi-action detection, ambiguity detection, complex date detection, and security validation remain unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11_

  - [~] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Verbless Expense Commands Parse Successfully
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run: `npm test pattern-parser-verbless-bugfix.test.ts`
    - **EXPECTED OUTCOME**: All tests PASS (confirms bug is fixed)
    - Verify all verbless expense commands now parse correctly:
      - "makan 12k" → success with amount 12000, description "makan"
      - "kopi 5rb" → success with amount 5000, description "kopi"
      - "parkir 3000 dari BCA" → success with accountHint "BCA"
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [~] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Parsing Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run: `npm test pattern-parser-preservation.test.ts`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all existing behaviors preserved:
      - Verb-based expense commands still work
      - Multi-action, ambiguity, complex date detection unchanged
      - Income and budget commands unaffected
      - Security validation still rejects malicious input
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11_

- [~] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `npm test`
  - Verify no regressions in other pattern parser tests
  - Verify integration tests pass (if any exist for WhatsApp message processing)
  - If any test failures occur, investigate and resolve before proceeding
  - Ask the user if questions arise about unexpected failures

---

## Notes

- **Bug Condition Methodology**: This plan follows the C(X) → P(result) approach where C(X) identifies verbless expense commands and P(result) specifies they should parse deterministically
- **Test-First Exploration**: Task 1 explores the bug by writing tests that fail on unfixed code
- **Preservation-First Testing**: Task 2 ensures existing behavior is captured before making changes
- **Fix Validation**: Tasks 3.2 and 3.3 verify both fix correctness and preservation


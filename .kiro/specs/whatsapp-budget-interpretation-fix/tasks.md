# Implementation Plan

## Overview

This implementation plan fixes the WhatsApp budget interpretation bug where inline budget keywords (e.g., "untuk budget makan 600k") are incorrectly classified as expenses instead of budget allocations. The fix uses the bug condition methodology with property-based testing to ensure correctness and prevent regressions.

**Bug Condition**: Budget keywords appear anywhere in text (not just at line start)  
**Expected Behavior**: All budget keywords detected → BUDGET_ALLOCATION classification  
**Preservation**: Non-budget inputs remain correctly classified

## Tasks

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Inline Budget Keyword Detection
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case(s) to ensure reproducibility
  - Test that budget keywords ("budget", "anggaran", "alokasi", "jatah") are detected when they appear anywhere in the text, not just at line start
  - Test cases: "gaji untuk: budget makan 600k" (keyword after colon), "untuk budget transport 200k" (keyword mid-text), "sisa budget kos 750k" (keyword with prefix)
  - Test that _parseSingleIntent() classifies these inputs as BUDGET_ALLOCATION (not EXPENSE)
  - Test that category name and amount are extracted correctly from inline budget text
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found (e.g., "inline budget items are classified as EXPENSE instead of BUDGET_ALLOCATION")
  - Test assertions match Expected Behavior Properties from design: budget keywords anywhere → BUDGET_ALLOCATION classification
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Budget Input Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (messages without budget keywords)
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Test that pure expense messages ("beli kopi 25k", "bayar listrik 200k") are classified as EXPENSE
  - Test that income messages ("gaji 7.5jt", "bonus 500k") are classified as INCOME
  - Test that transfer messages ("transfer 100k dari BCA ke Mandiri") are classified as TRANSFER
  - Test that balance queries ("saldo saya berapa") are classified as BALANCE_QUERY
  - Test that multi-line messages without budgets parse all lines correctly
  - Test edge case: "beli budget plan book 50k" should be EXPENSE (not BUDGET_ALLOCATION) since "budget" is part of item name
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

- [ ] 3. Fix isBudgetAllocationLine() and improve category extraction

  - [ ] 3.1 Update isBudgetAllocationLine() to use .includes() instead of .startsWith()
    - Open file: `services/ai/provider.ts` (around line 121)
    - Change: `return BUDGET_ALLOC_KEYWORDS.some((kw) => lower.startsWith(kw));`
    - To: `return BUDGET_ALLOC_KEYWORDS.some((kw) => lower.includes(kw));`
    - Add comment: "// Detects budget allocation keywords anywhere in the text (inline or at start)"
    - Add comment: "// Keywords have trailing space to avoid false positives (e.g., 'prebudget' won't match 'budget ')"
    - This allows detection of budget keywords at any position in the text
    - _Bug_Condition: isBugCondition(input) where input.toLowerCase().includes("budget ") OR includes("anggaran ") OR includes("alokasi ") OR includes("jatah ") AND NOT startsWith these keywords_
    - _Expected_Behavior: For any input where budget keywords appear anywhere, isBudgetAllocationLine() returns true, enabling BUDGET_ALLOCATION classification_
    - _Preservation: Non-budget inputs (no budget keywords) are unaffected by this change_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 3.2 Improve category name extraction in _parseSingleIntent()
    - Open file: `services/ai/provider.ts` (around line 193-203)
    - Current logic removes keyword only from start of text: `.replace(/^(?:budget|anggaran|alokasi|jatah)\s+/i, "")`
    - Implement improved extraction that handles keywords at any position:
      ```typescript
      // Remove budget keyword from anywhere in the text, then extract category
      let textWithoutKeyword = lower;
      for (const kw of ["budget ", "anggaran ", "alokasi ", "jatah "]) {
        if (textWithoutKeyword.includes(kw)) {
          // Split on the keyword and take the part after it
          const parts = textWithoutKeyword.split(kw);
          textWithoutKeyword = parts[parts.length - 1] || "";
          break;
        }
      }
      
      const categoryName = textWithoutKeyword
        .replace(/[0-9]+(?:[.,][0-9]+)?\s*(?:ribu|rb|k|juta|jt)?/gi, "")
        .replace(/\s+/g, " ")
        .trim() || "Lainnya";
      ```
    - This extracts the text after the budget keyword, removes amounts, and uses remainder as category name
    - Handles cases like "untuk budget makan 600k" → extracts "makan"
    - _Bug_Condition: Category name must be extracted correctly regardless of keyword position_
    - _Expected_Behavior: Category name extracted from text between keyword and amount, regardless of position_
    - _Preservation: Category extraction for line-start budget items continues to work correctly_
    - _Requirements: 2.5, 2.9_

  - [ ] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Inline Budget Keyword Detection
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify inline budget items are now classified as BUDGET_ALLOCATION
    - Verify category names are extracted correctly from inline budget text
    - Verify amounts are parsed correctly
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

  - [ ] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Budget Input Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Verify expense messages still classified as EXPENSE
    - Verify income messages still classified as INCOME
    - Verify transfer messages still classified as TRANSFER
    - Verify balance queries still classified as BALANCE_QUERY
    - Verify multi-line messages parse correctly
    - Verify edge case "beli budget plan book 50k" still classified as EXPENSE (not falsely detected as budget)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

- [ ] 4. Write comprehensive unit tests
  - Create test file: `tests/bugfix-budget-inline-detection.test.ts`
  - Test isBudgetAllocationLine() with keywords at various positions:
    - At start: "budget makan 600k" → true
    - After colon: "untuk: budget makan 600k" → true
    - Mid-text: "sisa budget transport 200k" → true
    - Multiple keywords: "budget makan 600k budget kos 750k" → true
    - All keyword variants: "anggaran", "alokasi", "jatah" → all true
  - Test _parseSingleIntent() with inline budget items:
    - "gaji untuk: budget makan 600k" → intent: BUDGET_ALLOCATION, category: "makan", amount: 600000
    - "untuk budget transport 200k" → intent: BUDGET_ALLOCATION, category: "transport", amount: 200000
    - "sisa budget kos 750k" → intent: BUDGET_ALLOCATION, category: "kos", amount: 750000
  - Test multi-action parsing with mixed budget and expense items:
    - "gaji 2.25jt, budget makan 600k, bayar seragam 100k" → 1 INCOME, 1 BUDGET_ALLOCATION, 1 EXPENSE
  - Test category name extraction from inline budget text:
    - "untuk budget makan 600k" → category: "makan"
    - "budget transport 200k" → category: "transport"
  - Test that non-budget messages are unaffected:
    - "beli kopi 25k" → EXPENSE (unchanged)
    - "bayar listrik 200k" → EXPENSE (unchanged)
  - Test edge cases:
    - "beli budget plan book 50k" → EXPENSE (keyword as part of description, not budget allocation)
    - Multiple keywords in one message: handled correctly
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.9, 3.1, 3.3, 3.4_

- [ ] 5. Extend property-based tests in phase5-ai-parser.test.ts
  - Add property-based test for Property 1: Budget keyword detection
    - Generate messages with budget keywords at random positions
    - Assert all are classified as BUDGET_ALLOCATION
    - Generator: prefixes ["", "gaji untuk: ", "sisa ", "untuk "] × keywords ["budget", "anggaran", "alokasi", "jatah"] × categories ["makan", "kos", "transport"] × amounts ["100k", "500rb", "1.5juta"]
  - Add property-based test for Property 2: Non-budget input preservation
    - Generate non-budget expense messages
    - Assert all are classified as EXPENSE (same as before fix)
    - Generator: verbs ["beli", "bayar", "biaya"] × items ["kopi", "bensin", "parkir"] × amounts ["25k", "50rb", "100ribu"]
  - Add property-based test for category name extraction consistency
    - Same keyword at different positions should extract same category name
    - "budget makan 600k" and "untuk budget makan 600k" both extract "makan"
  - Add property-based test for amount extraction consistency
    - Budget amount extracted correctly regardless of keyword position
  - Run 1000+ generated test cases to ensure robustness
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.6, 3.7, 3.8, 3.9_

- [ ] 6. Create integration tests for end-to-end flow
  - Create test file: `tests/integration-whatsapp-budget-flow.test.ts`
  - Test end-to-end budget allocation flow:
    - Send message: "budget makan 600k"
    - Verify budget record created in budgets table with category "makan" and amount 600000
    - Verify NO transaction created in transactions table
    - Verify confirmation message displays "📊 Budget makan 600k"
  - Test end-to-end mixed actions flow:
    - Send message: "gaji 5jt, budget makan 1jt, bayar kopi 25k"
    - Verify 1 income transaction created (5,000,000)
    - Verify 1 budget record created (category "makan", 1,000,000)
    - Verify 1 expense transaction created (25,000)
    - Verify confirmation shows all three actions correctly
  - Test inline budget detection end-to-end:
    - Send message: "gaji 2.25jt dibagi untuk: budget makan 600k, budget kos 750k, bayar seragam 100k"
    - Verify 1 income transaction created (2,250,000)
    - Verify 2 budget records created ("makan" 600k, "kos" 750k)
    - Verify 1 expense transaction created (100,000)
    - Verify confirmation message shows "📊 Budget" for budget items
  - Test balance preservation:
    - Record initial account balance
    - Send message: "budget makan 600k"
    - Verify account balance UNCHANGED (budget allocation does not reduce balance)
    - Send message: "bayar makan 50k"
    - Verify account balance REDUCED by 50k (expense does reduce balance)
  - Test confirmation message accuracy:
    - Verify budget allocations show "📊 Budget [category] [amount]"
    - Verify expenses show "💸 Pengeluaran [description] [amount]"
  - Test database consistency:
    - Query budgets table and verify correct records
    - Query transactions table and verify correct records
    - Verify no budget allocations appear in transactions table
  - Use test database with seeded user accounts and categories
  - _Requirements: 2.5, 2.6, 2.7, 2.8, 2.9, 3.1, 3.3, 3.6, 3.7, 3.8_

- [ ] 7. Checkpoint - Ensure all tests pass
  - Run all unit tests: `npm test tests/bugfix-budget-inline-detection.test.ts`
  - Run all property-based tests: `npm test tests/phase5-ai-parser.test.ts`
  - Run all integration tests: `npm test tests/integration-whatsapp-budget-flow.test.ts`
  - Verify all tests pass
  - Review test coverage - ensure bug condition, expected behavior, and preservation are all validated
  - If any tests fail, investigate and fix before proceeding
  - Ask the user if questions arise
  - _Requirements: All (validation checkpoint)_


## Task Dependency Graph

```json
{
  "waves": [
    {
      "name": "Wave 1: Exploration",
      "tasks": ["1"]
    },
    {
      "name": "Wave 2: Preservation",
      "tasks": ["2"]
    },
    {
      "name": "Wave 3: Implementation",
      "tasks": ["3", "3.1", "3.2", "3.3", "3.4"]
    },
    {
      "name": "Wave 4: Testing",
      "tasks": ["4", "5", "6"]
    },
    {
      "name": "Wave 5: Validation",
      "tasks": ["7"]
    }
  ]
}
```

```
1. Bug Condition Exploration Test (Property 1)
   ↓
2. Preservation Property Tests (Property 2)
   ↓
3. Fix isBudgetAllocationLine() and improve category extraction
   ├─ 3.1 Update isBudgetAllocationLine() to use .includes()
   ├─ 3.2 Improve category name extraction
   ├─ 3.3 Verify bug condition test now passes
   └─ 3.4 Verify preservation tests still pass
   ↓
4. Write comprehensive unit tests
   ↓
5. Extend property-based tests in phase5-ai-parser.test.ts
   ↓
6. Create integration tests for end-to-end flow
   ↓
7. Checkpoint - Ensure all tests pass
```

**Critical Dependencies:**
- Task 1 MUST complete before Task 3 (exploration test validates fix)
- Task 2 MUST complete before Task 3 (preservation tests prevent regressions)
- Task 3 MUST complete before Tasks 4, 5, 6 (implementation enables verification)
- Tasks 4, 5, 6 can run in parallel after Task 3
- Task 7 MUST be last (final validation)

## Notes

### Bug Condition Methodology

This bugfix follows the bug condition methodology:
- **C(X)**: Budget keywords appear anywhere in text (not just at start)
- **P(result)**: Correctly classified as BUDGET_ALLOCATION with proper category extraction
- **¬C(X)**: Non-budget inputs that should preserve existing classification
- **F**: Original isBudgetAllocationLine() using .startsWith()
- **F'**: Fixed isBudgetAllocationLine() using .includes()

### Testing Strategy

1. **Exploration Test** (Task 1): Write property-based test BEFORE fix to confirm bug exists
2. **Preservation Test** (Task 2): Write property-based test BEFORE fix to capture baseline behavior
3. **Implementation** (Task 3): Apply fix with confidence from exploration
4. **Verification** (Tasks 3.3, 3.4): Re-run same tests to validate fix and preservation
5. **Comprehensive Coverage** (Tasks 4-6): Unit, property-based, and integration tests

### Key Implementation Details

- **File to modify**: `services/ai/provider.ts`
- **Function affected**: `isBudgetAllocationLine()` (line ~121) and `_parseSingleIntent()` (line ~193-203)
- **Change**: Replace `.startsWith()` with `.includes()` for keyword detection
- **Category extraction**: Improved to handle keywords at any position

### Edge Cases to Consider

- "beli budget plan book 50k" should be EXPENSE (keyword is part of item description)
- Multiple keywords in one message: "budget makan 600k budget kos 750k"
- Keywords with different prefixes: "untuk budget", "sisa budget", "alokasi untuk"

### Success Criteria

- All exploration tests pass (confirms bug is fixed)
- All preservation tests pass (confirms no regressions)
- Unit tests cover all keyword positions and variants
- Property-based tests generate 1000+ valid test cases
- Integration tests verify end-to-end flow correctness
- Account balances remain correct (budgets don't reduce balance)

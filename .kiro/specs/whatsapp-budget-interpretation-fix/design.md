# WhatsApp Budget Interpretation Fix - Bugfix Design

## Overview

The WhatsApp AI parser incorrectly classifies budget allocation statements as EXPENSE transactions when budget keywords ("budget", "anggaran", "alokasi", "jatah") appear mid-text in inline comma-separated items rather than at the start of a line. This causes budget allocations to be recorded as actual spending, corrupting financial tracking data.

The fix modifies the `isBudgetAllocationLine()` function to detect budget keywords anywhere in the text (not just at line start), ensuring that budget items are correctly classified as BUDGET_ALLOCATION regardless of their position within the message.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when budget keywords appear inline (not at line start) in comma-separated items
- **Property (P)**: The desired behavior - budget keywords should be detected anywhere in the text, resulting in BUDGET_ALLOCATION classification
- **Preservation**: Existing expense, income, transfer, and balance query parsing that must remain unchanged by the fix
- **isBudgetAllocationLine()**: The helper function in `services/ai/provider.ts` that checks if a text line contains budget allocation keywords
- **_parseSingleIntent()**: The private method in MockAIProvider that parses individual financial intents from text segments
- **BUDGET_ALLOCATION**: Intent type for setting spending limits (does not affect cash balance)
- **EXPENSE**: Intent type for recording actual spending (reduces cash balance)
- **Inline items**: Comma-separated financial actions within a single message (e.g., "budget makan 600k, budget kos 750k, bayar seragam 100k")

## Bug Details

### Bug Condition

The bug manifests when a user sends a message containing budget allocation keywords ("budget", "anggaran", "alokasi", "jatah") as inline items within comma-separated lists. The `isBudgetAllocationLine()` function uses `.startsWith()` to check for budget keywords, which only matches when the keyword appears at the very beginning of the text string.

When parsing multi-line or comma-separated messages, each segment is processed individually by `_parseSingleIntent()`. If a segment is "budget makan 600k" (without leading whitespace or header text), `isBudgetAllocationLine()` correctly detects it. However, if the segment has been trimmed from a larger text like "gaji dibagi untuk: budget makan 600k, budget kos 750k", the individual segments may not start with the budget keyword due to text processing, OR the keyword appears mid-text after other words.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type string (text segment to be parsed)
  OUTPUT: boolean
  
  RETURN input.toLowerCase().includes("budget ") OR
         input.toLowerCase().includes("anggaran ") OR
         input.toLowerCase().includes("alokasi ") OR
         input.toLowerCase().includes("jatah ")
         AND NOT input.toLowerCase().startsWith("budget ")
         AND NOT input.toLowerCase().startsWith("anggaran ")
         AND NOT input.toLowerCase().startsWith("alokasi ")
         AND NOT input.toLowerCase().startsWith("jatah ")
END FUNCTION
```

### Examples

**Example 1: Inline budget items (triggers bug)**
- Input: "gaji 2.25 juta dibagi untuk: budget makan 600k, budget kos 750k, bayar kurangan seragam 100k"
- Current behavior: 
  - "budget makan 600k" → classified as EXPENSE
  - "budget kos 750k" → classified as EXPENSE
  - Expected BUDGET_ALLOCATION actions are recorded as transactions
- Expected behavior: Both should be classified as BUDGET_ALLOCATION

**Example 2: Line-start budget items (works correctly)**
- Input: "budget makan 600k"
- Current behavior: Correctly classified as BUDGET_ALLOCATION ✓
- Expected behavior: Should continue to work correctly

**Example 3: Mixed actions with inline budgets (triggers bug)**
- Input: "pendapatan freelance 500k, budget transport 100k, bayar kopi 25k"
- Current behavior: "budget transport 100k" → classified as EXPENSE
- Expected behavior: Should be classified as BUDGET_ALLOCATION

**Example 4: Budget keyword with preceding text (triggers bug)**
- Input: "untuk budget makan 600k"
- Current behavior: Classified as EXPENSE (keyword not at line start)
- Expected behavior: Should be classified as BUDGET_ALLOCATION

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Actual expense transactions with keywords like "bayar", "beli", "biaya" must continue to be classified as EXPENSE
- Multi-line message parsing must continue to process each line as a separate action
- Single-action messages must continue to be parsed correctly
- Income detection (gaji, bonus, freelance) must remain unchanged
- Transfer detection (transfer, pindah, dari...ke) must remain unchanged
- Balance query detection (saldo, sisa uang) must remain unchanged
- The order of intent checking in _parseSingleIntent() must remain unchanged
- Budget items that start at line beginning must continue to work (regression test)
- Amount parsing for all intent types must remain unchanged
- Category/account hint inference must remain unchanged
- MockAIProvider and GeminiAIProvider fallback behavior must remain unchanged

**Scope:**
All inputs that do NOT involve budget allocation keywords should be completely unaffected by this fix. This includes:
- Pure expense messages: "beli kopi 25k", "bayar listrik 200k"
- Income messages: "gaji 5jt", "bonus 500k"
- Transfer messages: "transfer 100k dari BCA ke Mandiri"
- Balance queries: "saldo saya berapa"
- Unknown/ambiguous messages: "bayar 50k" (no description)

## Hypothesized Root Cause

Based on the bug description and code analysis, the root cause is:

1. **Overly Restrictive Keyword Detection**: The `isBudgetAllocationLine()` function uses `.startsWith()` which only matches keywords at position 0 of the string
   - Current implementation: `BUDGET_ALLOC_KEYWORDS.some((kw) => lower.startsWith(kw))`
   - This fails when budget keywords appear mid-text or after whitespace/punctuation

2. **Text Processing Side Effects**: When multi-line or comma-separated messages are split and trimmed, the budget keyword may not be at the start of the resulting segment
   - Example: "gaji untuk: budget makan 600k" → after split and trim → "budget makan 600k" (works)
   - But if parsed differently or with different whitespace → might not start with keyword

3. **Lack of Comprehensive Pattern Matching**: The function doesn't account for budget keywords appearing anywhere in the natural language text
   - Users naturally write "untuk budget makan 600k" or "sisa budget transport 100k"
   - Current logic cannot detect these patterns

4. **Intent Detection Order**: The budget allocation check happens early in `_parseSingleIntent()`, but if it fails, the text falls through to expense detection
   - Since budget messages contain amounts, they satisfy expense detection criteria
   - Result: misclassified as EXPENSE instead of returning to check for mid-text budget keywords

## Correctness Properties

Property 1: Bug Condition - Inline Budget Keyword Detection

_For any_ text input where budget allocation keywords ("budget", "anggaran", "alokasi", "jatah") appear anywhere in the text (not just at the start), the fixed isBudgetAllocationLine() function SHALL return true, causing _parseSingleIntent() to classify the action as BUDGET_ALLOCATION and extract the category name and amount correctly.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9**

Property 2: Preservation - Non-Budget Input Behavior

_For any_ input that does not contain budget allocation keywords, the fixed code SHALL produce exactly the same classification and parsing results as the original code, preserving all existing functionality for expense, income, transfer, balance query, and unknown intent detection.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `services/ai/provider.ts`

**Function**: `isBudgetAllocationLine()`

**Specific Changes**:

1. **Replace `.startsWith()` with `.includes()`**: Change the keyword detection logic from position-dependent to position-agnostic matching
   - Before: `BUDGET_ALLOC_KEYWORDS.some((kw) => lower.startsWith(kw))`
   - After: `BUDGET_ALLOC_KEYWORDS.some((kw) => lower.includes(kw))`
   - This allows detection of budget keywords anywhere in the text

2. **Update Function Documentation**: Add a comment explaining that the function detects budget keywords anywhere in the text (not just at the start)
   ```typescript
   // Detects budget allocation keywords anywhere in the text (inline or at start)
   export function isBudgetAllocationLine(lower: string): boolean {
     return BUDGET_ALLOC_KEYWORDS.some((kw) => lower.includes(kw));
   }
   ```

3. **Verify Category Name Extraction**: Ensure the category name extraction logic in `_parseSingleIntent()` handles budget keywords in any position
   - Current logic: `.replace(/^(?:budget|anggaran|alokasi|jatah)\s+/i, "")`
   - This may need adjustment to handle keywords that aren't at the start
   - Proposed: Extract text between keyword and amount, regardless of position

4. **Consider Edge Case: "Budget" as Part of Another Word**: Prevent false positives where "budget" appears as a substring
   - Example: "prebudget meeting 100k" should NOT trigger budget allocation
   - Solution: Ensure keywords have word boundaries or are followed by whitespace/amount
   - Note: Current keywords end with a space (" ") which provides some protection

5. **Update GeminiAIProvider System Prompt**: Ensure the AI prompt also emphasizes that budget keywords can appear anywhere
   - The prompt already states: "gaji 2.25jt untuk budget makan 600k, budget kos 750k, bayar seragam 100k" as an example
   - Verify this example is sufficient for the AI to understand inline budget detection

### Detailed Implementation Plan

**Change 1: Update `isBudgetAllocationLine()` function**

Location: `services/ai/provider.ts` (around line 121)

```typescript
// BEFORE:
export function isBudgetAllocationLine(lower: string): boolean {
  return BUDGET_ALLOC_KEYWORDS.some((kw) => lower.startsWith(kw));
}

// AFTER:
// Detects budget allocation keywords anywhere in the text (inline or at start)
// Keywords have trailing space to avoid false positives (e.g., "prebudget" won't match "budget ")
export function isBudgetAllocationLine(lower: string): boolean {
  return BUDGET_ALLOC_KEYWORDS.some((kw) => lower.includes(kw));
}
```

**Change 2: Improve category name extraction in `_parseSingleIntent()`**

Location: `services/ai/provider.ts` (around line 193-203)

The current implementation removes the keyword from the start and then removes amount patterns:

```typescript
// Current extraction:
const categoryName = lower
  .replace(/^(?:budget|anggaran|alokasi|jatah)\s+/i, "")
  .replace(/[0-9]+(?:[.,][0-9]+)?\s*(?:ribu|rb|k|juta|jt)?/gi, "")
  .replace(/\s+/g, " ")
  .trim() || "Lainnya";
```

This logic needs to handle keywords that aren't at the start. Proposed improvement:

```typescript
// Extract text between budget keyword and amount
// Find the budget keyword position
let categoryName = "Lainnya";
const budgetMatch = lower.match(/\b(budget|anggaran|alokasi|jatah)\s+([^0-9]+)/i);
if (budgetMatch && budgetMatch[2]) {
  categoryName = budgetMatch[2]
    .replace(/[0-9]+(?:[.,][0-9]+)?\s*(?:ribu|rb|k|juta|jt)?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
if (!categoryName || categoryName.length < 2) {
  categoryName = "Lainnya";
}
```

**Alternative simpler approach**: Since we're using `.includes()` now, we can remove the keyword from anywhere:

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

**Change 3: Verify no regression in GeminiAIProvider**

The Gemini system prompt already includes the correct example. No changes needed, but we should verify during testing that the AI provider also benefits from the MockAIProvider fix (since it falls back to MockAIProvider on errors).

## Testing Strategy

### Validation Approach

The testing strategy follows a three-phase approach:
1. **Exploratory Bug Condition Checking**: Run tests on UNFIXED code to observe failures and confirm root cause
2. **Fix Checking**: Verify that all budget keywords are detected correctly after the fix
3. **Preservation Checking**: Verify that all non-budget inputs produce identical results before and after the fix

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write property-based tests that generate messages with budget keywords in various positions. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Inline Budget After Header**: "gaji dibagi untuk: budget makan 600k" (will fail on unfixed code - keyword not at line start after split)
2. **Comma-Separated Budget Items**: "budget makan 600k, budget kos 750k, bayar seragam 100k" (will fail on unfixed code if parsed as comma-separated)
3. **Budget Keyword Mid-Text**: "untuk budget transport 200k" (will fail on unfixed code)
4. **Mixed Actions**: "gaji 5jt, budget makan 1jt, bayar listrik 200k" (budget item will fail on unfixed code)

**Expected Counterexamples**:
- Budget items with keywords not at position 0 are classified as EXPENSE instead of BUDGET_ALLOCATION
- Confirmation messages show "💸 Pengeluaran" instead of "📊 Budget"
- Budget amounts incorrectly reduce cash balance
- Possible root cause confirmed: `.startsWith()` is too restrictive

**Implementation Note**: Run these tests on the current codebase first, capture the failures, then implement the fix and verify they pass.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (budget keywords appear anywhere in text), the fixed function produces the expected behavior (BUDGET_ALLOCATION classification).

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := isBudgetAllocationLine_fixed(input.toLowerCase())
  ASSERT result === true
  parsedIntent := _parseSingleIntent_fixed(input)
  ASSERT parsedIntent.intent === "BUDGET_ALLOCATION"
  ASSERT parsedIntent.amount > 0
  ASSERT parsedIntent.categoryName is extracted correctly
END FOR
```

**Test Cases:**
1. **Budget keyword at start**: "budget makan 600k" → BUDGET_ALLOCATION ✓
2. **Budget keyword after colon**: "gaji untuk: budget makan 600k" → BUDGET_ALLOCATION ✓
3. **Budget keyword mid-text**: "untuk budget transport 200k" → BUDGET_ALLOCATION ✓
4. **Budget keyword with preceding words**: "sisa budget kos 750k" → BUDGET_ALLOCATION ✓
5. **Multiple budget keywords**: "budget makan 600k sama budget kos 750k" → both BUDGET_ALLOCATION ✓
6. **All budget keyword variants**:
   - "anggaran makan 500k" → BUDGET_ALLOCATION ✓
   - "alokasi transport 200k" → BUDGET_ALLOCATION ✓
   - "jatah kos 750k" → BUDGET_ALLOCATION ✓

**Property-Based Test**: Generate random messages with budget keywords in random positions and verify they are always classified as BUDGET_ALLOCATION.

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (no budget keywords), the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  resultOriginal := _parseSingleIntent_original(input)
  resultFixed := _parseSingleIntent_fixed(input)
  ASSERT resultOriginal.intent === resultFixed.intent
  ASSERT resultOriginal.amount === resultFixed.amount
  ASSERT resultOriginal.description === resultFixed.description
  // ... assert all fields are identical
END FOR
```

**Testing Approach**: Property-based testing is CRITICAL for preservation checking because:
- Budget keyword detection changes affect the control flow in `_parseSingleIntent()`
- We need to verify that thousands of non-budget inputs still work correctly
- Edge cases like "beli budget plan book 50k" (contains "budget" but is an expense) must be handled
- PBT generates diverse inputs automatically to catch unexpected interactions

**Test Plan**: 
1. Capture baseline behavior of UNFIXED code for 100+ non-budget messages
2. Run same messages through FIXED code
3. Assert identical results for every message

**Test Cases**:
1. **Pure Expense Messages**: 
   - "beli kopi 25k" → EXPENSE (same before/after) ✓
   - "bayar listrik 200k" → EXPENSE ✓
   - "biaya parkir 10k" → EXPENSE ✓
2. **Income Messages**:
   - "gaji 7.5 juta" → INCOME (same before/after) ✓
   - "bonus 500k" → INCOME ✓
3. **Transfer Messages**:
   - "transfer 100k dari BCA ke Mandiri" → TRANSFER (same before/after) ✓
4. **Balance Queries**:
   - "saldo saya berapa" → BALANCE_QUERY (same before/after) ✓
5. **Unknown Intents**:
   - "bayar 50k" → UNKNOWN (same before/after) ✓
   - "halo apa kabar" → UNKNOWN ✓
6. **Multi-Line Messages Without Budgets**:
   - "beli kopi 25k\nbayar parkir 10k" → 2 EXPENSE actions (same before/after) ✓
7. **Edge Case - "Budget" as Part of Expense Description**:
   - "beli budget plan book 50k" → EXPENSE (NOT budget allocation) ✓
   - This should NOT trigger budget detection because "budget" is part of item name
   - The trailing space in keyword "budget " should prevent this false positive

**Property-Based Test**: Generate 1000+ random non-budget messages and verify identical parsing results before and after the fix.

### Unit Tests

**File**: Create `tests/bugfix-budget-inline-detection.test.ts`

Test categories:
- Test `isBudgetAllocationLine()` with keywords at various positions
- Test `_parseSingleIntent()` with inline budget items
- Test multi-action parsing with mixed budget and expense items
- Test category name extraction from inline budget text
- Test that non-budget messages are unaffected
- Test edge cases (keyword as substring, multiple keywords, special characters)

### Property-Based Tests

**File**: Extend `tests/phase5-ai-parser.test.ts` or create new PBT file

Test properties:
- **Property 1**: ANY message containing budget keywords (with amount) → BUDGET_ALLOCATION
- **Property 2**: ANY message without budget keywords → same classification as original code
- **Property 3**: Category name extraction consistency - same keyword at different positions extracts same category
- **Property 4**: Amount extraction consistency - budget amount extracted correctly regardless of keyword position

**Input Generators**:
```typescript
// Generator: budget messages with keywords at random positions
function* generateBudgetMessages() {
  const keywords = ["budget", "anggaran", "alokasi", "jatah"];
  const prefixes = ["", "gaji untuk: ", "sisa ", "untuk ", "alokasi gaji: "];
  const categories = ["makan", "kos", "transport", "listrik", "kos", "belanja"];
  const amounts = ["100k", "500rb", "1.5juta", "750ribu"];
  
  for (const kw of keywords) {
    for (const prefix of prefixes) {
      for (const cat of categories) {
        for (const amt of amounts) {
          yield `${prefix}${kw} ${cat} ${amt}`;
        }
      }
    }
  }
}

// Generator: non-budget messages (should be unchanged)
function* generateNonBudgetMessages() {
  const expenseVerbs = ["beli", "bayar", "biaya"];
  const items = ["kopi", "bensin", "parkir", "listrik"];
  const amounts = ["25k", "50rb", "100ribu"];
  
  for (const verb of expenseVerbs) {
    for (const item of items) {
      for (const amt of amounts) {
        yield `${verb} ${item} ${amt}`;
      }
    }
  }
}
```

### Integration Tests

**File**: Create `tests/integration-whatsapp-budget-flow.test.ts`

Test full flow from message receipt to database storage:
1. **End-to-End Budget Allocation**: Send "budget makan 600k" → verify budget record created (no transaction)
2. **End-to-End Mixed Actions**: Send "gaji 5jt, budget makan 1jt, bayar kopi 25k" → verify 1 income, 1 budget, 1 expense
3. **Inline Budget Detection**: Send "gaji dibagi untuk: budget makan 600k, budget kos 750k, bayar seragam 100k" → verify 2 budgets created correctly
4. **Balance Preservation**: Verify that budget allocation does NOT reduce account balance
5. **Confirmation Message Accuracy**: Verify that confirmation shows "📊 Budget" for budget items and "💸 Pengeluaran" for expenses
6. **Database Consistency**: Query budgets table and transactions table to verify correct data storage

**Test Environment**: Use test database with seeded user accounts and categories.

### Test Execution Order

1. **Phase 1 - Exploratory (Pre-Fix)**:
   - Run exploratory tests on UNFIXED code
   - Document all failures and root cause confirmation
   - Generate baseline results for preservation checking

2. **Phase 2 - Fix Implementation**:
   - Implement the changes to `isBudgetAllocationLine()` and category extraction
   - Run unit tests to verify fix at function level

3. **Phase 3 - Fix Verification**:
   - Run fix checking tests (bug condition inputs)
   - Verify all budget keyword positions are detected correctly

4. **Phase 4 - Preservation Verification**:
   - Run preservation checking tests (non-budget inputs)
   - Run property-based tests with 1000+ generated messages
   - Verify zero regressions

5. **Phase 5 - Integration Verification**:
   - Run end-to-end integration tests
   - Verify database records, confirmations, and balance calculations

### Success Criteria

- ✅ All exploratory tests fail on UNFIXED code (confirms bug exists)
- ✅ All fix checking tests pass on FIXED code (confirms bug is resolved)
- ✅ All preservation tests show identical behavior before/after fix (confirms no regressions)
- ✅ Property-based tests pass for 1000+ generated inputs (confirms robustness)
- ✅ Integration tests show correct end-to-end behavior (confirms production readiness)

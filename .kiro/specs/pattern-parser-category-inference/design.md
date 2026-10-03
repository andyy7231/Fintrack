# Pattern Parser Category Inference Bugfix Design

## Overview

This bugfix adds automatic category inference to the pattern parser's `parseExpense()` function to match the AI parser's behavior. Currently, the pattern parser only extracts explicit category keywords (e.g., "kategori makanan") but does not infer categories from description keywords like the AI parser does. This creates inconsistent behavior where "makan 5k" gets categorized as "Lainnya" instead of "Makanan & Minuman".

The fix leverages the existing `inferCategoryHint()` function from `provider.ts` as a fallback when no explicit category keyword is found, ensuring both parsers produce consistent categorization behavior.

## Glossary

- **Bug_Condition (C)**: Commands with category keywords in description but no explicit "kategori" keyword
- **Property (P)**: Automatic category inference from description keywords
- **Preservation**: Existing explicit category extraction and all other parseExpense phases
- **parseExpense**: The function in `pattern-parser.service.ts` that extracts expense transaction data
- **extractCategoryHint**: The function in `regex.utils.ts` that extracts explicit "kategori" keywords from text
- **inferCategoryHint**: The function in `provider.ts` that infers category from description keywords using pattern matching
- **categoryHint**: The extracted or inferred category suggestion passed to the category resolver

## Bug Details

### Bug Condition

The bug manifests when users send expense commands with description keywords that match known category patterns but do not include an explicit "kategori" keyword. The pattern parser extracts the description correctly but sets `categoryHint = null`, causing the category resolver to default to "Lainnya" instead of using intelligent inference.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type string (WhatsApp message text)
  OUTPUT: boolean
  
  LET lower = input.toLowerCase()
  LET hasExplicitCategory = extractCategoryHint(input) !== null
  LET hasCategoryKeyword = (
    lower.includes("makan") OR lower.includes("kopi") OR lower.includes("bensin") OR
    lower.includes("pulsa") OR lower.includes("grab") OR lower.includes("belanja") OR
    [other keywords from inferCategoryHint function]
  )
  
  RETURN (NOT hasExplicitCategory) AND hasCategoryKeyword AND isValidExpenseCommand(input)
END FUNCTION
```

### Examples

- **Example 1**: Command: "makan 5k"
  - Current: `categoryHint = null` → categorized as "Lainnya"
  - Expected: `categoryHint = "Makanan & Minuman"` → categorized correctly

- **Example 2**: Command: "bensin 50rb"
  - Current: `categoryHint = null` → categorized as "Lainnya"
  - Expected: `categoryHint = "Transportasi"` → categorized correctly

- **Example 3**: Command: "pulsa 25k"
  - Current: `categoryHint = null` → categorized as "Lainnya"
  - Expected: `categoryHint = "Tagihan & Utilitas"` → categorized correctly

- **Edge Case**: Command: "makan 5k kategori snack"
  - Current: `categoryHint = "snack"` (explicit wins)
  - Expected: Same behavior - explicit category keyword should still take precedence

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Explicit "kategori" keyword extraction must continue to work exactly as before and take precedence
- All existing `parseExpense()` phases (verb matching, amount extraction, date parsing, account hints) must remain unchanged
- Commands with explicit "kategori" keywords must still use the explicit hint, not inference
- Multi-action, ambiguous, and complex date detection must continue to trigger AI fallback
- All other pattern parser functions (`parseIncome`, `parseBudgetAllocation`) must be unaffected
- AI parser's `inferCategoryHint()` logic must remain unchanged
- Category resolver's matching logic must remain unchanged

**Scope:**
All inputs that already have explicit "kategori" keywords or do not match any category patterns should be completely unaffected by this fix. This includes:
- Commands with explicit categories: "makan 5k kategori snack"
- Commands with no category keywords: "unknown item 5k" (should still get "Lainnya")
- Income and budget commands (use separate parsing logic)

## Hypothesized Root Cause

Based on the bug description and code review, the issue is:

1. **Missing Inference Step**: The `parseExpense()` function calls `extractCategoryHint(text)` which only looks for explicit "kategori" keywords using regex patterns. When not found, it returns `null` without attempting automatic inference.

2. **Function Not Imported**: The `inferCategoryHint()` function exists in `provider.ts` but is not exported or imported by `pattern-parser.service.ts`, so it cannot be used as a fallback.

3. **Inconsistent Parser Logic**: The AI parser uses `inferCategoryHint()` on every parsed command, while the pattern parser only uses `extractCategoryHint()`, creating inconsistent categorization behavior.

4. **No Default Inference**: When `categoryHint = null`, the category resolver defaults to "Lainnya" rather than attempting keyword-based inference, which is the correct behavior (resolver should not contain inference logic), but the pattern parser should have inferred a hint before passing to resolver.

## Correctness Properties

Property 1: Bug Condition - Automatic Category Inference

_For any_ expense command where `extractCategoryHint()` returns null and the text contains category keywords (as defined by `inferCategoryHint()`), the fixed `parseExpense()` function SHALL automatically infer the category using `inferCategoryHint(text.toLowerCase())` and set `categoryHint` to the inferred value before returning the parsed intent.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8**

Property 2: Preservation - Explicit Category Precedence

_For any_ expense command where `extractCategoryHint()` returns a non-null value (explicit "kategori" keyword present), the fixed `parseExpense()` function SHALL use the explicit category hint without calling `inferCategoryHint()`, preserving the existing precedence rule that explicit keywords always override automatic inference.

**Validates: Requirements 3.1, 3.2, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

**File 1**: `services/ai/provider.ts`

**Function**: `inferCategoryHint`

**Specific Changes**:
1. **Export the function**: Change `function inferCategoryHint(lower: string): string` to `export function inferCategoryHint(lower: string): string`
   - This allows `pattern-parser.service.ts` to import and reuse the existing inference logic
   - No logic changes needed - the function already implements comprehensive keyword matching

**File 2**: `services/ai/pattern-parser.service.ts`

**Function**: `parseExpense`

**Specific Changes**:
1. **Add import statement**: Add `inferCategoryHint` to the existing import from `'./provider'`:
   ```typescript
   import { isBalanceQuery, isFreeCashQuery, inferAccountHint, inferCategoryHint } from './provider';
   ```

2. **Modify Phase 8 (category extraction)**: Replace the single-line extraction with inference fallback:
   ```typescript
   // Phase 8: Extract optional category hint (Requirement 1.6)
   // Try explicit "kategori" keyword first, fallback to automatic inference
   let categoryHint = extractCategoryHint(text);
   
   if (categoryHint === null) {
     // No explicit category keyword found, attempt automatic inference
     categoryHint = inferCategoryHint(text.toLowerCase());
   }
   ```

3. **No other changes needed**: This modification fits perfectly in the existing Phase 8 location and does not require changes to any other phases, conditional logic, or return statements.

### Implementation Notes

- The fix preserves the existing phase structure of `parseExpense()`
- Explicit category extraction (`extractCategoryHint`) always runs first and takes precedence
- Automatic inference (`inferCategoryHint`) only runs as a fallback when explicit extraction returns null
- The inferred category hint is passed to the category resolver exactly like explicit hints
- Both verb-based and verbless expense commands benefit from this fix automatically (Phase 8 runs after description extraction for both paths)
- The fix maintains the pattern parser's fail-fast philosophy - inference failures gracefully return "Lainnya"

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that send expense commands with category keywords but no explicit "kategori" keyword. Run these tests on the UNFIXED code to observe that `categoryHint` is null and transactions get categorized as "Lainnya".

**Test Cases**:
1. **Food Keyword Test**: Command "makan 5k" (will fail on unfixed code - categoryHint should be null, expect "Lainnya")
2. **Transport Keyword Test**: Command "bensin 50rb" (will fail on unfixed code - categoryHint should be null, expect "Lainnya")
3. **Utility Keyword Test**: Command "pulsa 25k" (will fail on unfixed code - categoryHint should be null, expect "Lainnya")
4. **Multiple Keywords Test**: Command "beli kopi di warteg 15k" (will fail on unfixed code - multiple food keywords but categoryHint should be null)

**Expected Counterexamples**:
- Pattern parser returns `categoryHint = null` for commands with category keywords
- Category resolver defaults to "Lainnya" when receiving null categoryHint
- Possible causes: Missing `inferCategoryHint()` import, no fallback inference logic in Phase 8

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := parseExpense_fixed(input)
  ASSERT result.categoryHint !== null
  ASSERT result.categoryHint matches expected category for keywords in input
  ASSERT result.categoryHint is correctly inferred by inferCategoryHint(input.toLowerCase())
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT parseExpense_original(input) = parseExpense_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for explicit category commands and non-category commands, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Explicit Category Preservation**: Command "makan 5k kategori snack" - observe that unfixed code returns `categoryHint = "snack"`, then verify fixed code produces same result
2. **No Category Keywords Preservation**: Command "unknown item 5k" - observe that unfixed code returns `categoryHint = null` (inferred as "Lainnya"), then verify fixed code produces same result
3. **Multi-Action Detection Preservation**: Command "makan 5k dan bensin 10k" - observe that unfixed code returns null (triggers AI), then verify fixed code produces same result
4. **Amount Extraction Preservation**: Command "makan 25rb" - observe amount=25000, verify this remains unchanged after fix
5. **Date Extraction Preservation**: Command "makan 5k kemarin" - observe transactionDate is yesterday, verify this remains unchanged after fix
6. **Account Hint Preservation**: Command "makan 5k dari BCA" - observe accountHint="BCA", verify this remains unchanged after fix

### Unit Tests

- Test automatic inference for each category pattern (Food, Transport, Utilities, Shopping, Health, Entertainment, Education)
- Test explicit category keyword precedence (should not call inferCategoryHint when explicit keyword exists)
- Test edge cases: empty description, description with no category keywords, multiple category keywords
- Test that inference works for both verb-based and verbless commands
- Test that "Lainnya" is inferred when no category keywords match

### Property-Based Tests

- Generate random expense commands with known category keywords and verify categoryHint is automatically inferred
- Generate random expense commands with explicit "kategori" keyword and verify it takes precedence over inference
- Generate random expense commands with no category keywords and verify categoryHint is "Lainnya"
- Test that all other extracted fields (amount, description, date, account) remain consistent across parser implementations

### Integration Tests

- Test end-to-end flow: WhatsApp command → pattern parser → category resolver → transaction creation
- Test that "makan 5k" creates transaction with "Makanan & Minuman" category (if user has that category)
- Test that "makan 5k kategori snack" still uses "snack" category with explicit keyword
- Test that pattern parser and AI parser produce consistent categories for the same commands

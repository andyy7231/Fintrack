# Pattern Parser Verbless Expense Bugfix Design

## Overview

This design addresses the pattern parser's inability to recognize verbless Indonesian expense commands (e.g., "makan 12k", "kopi 5rb"). The bug causes valid expense commands to fail pattern matching and fall back to AI processing, resulting in parsing errors and poor user experience.

**Fix Approach:** Extend the `parseExpense()` method to support verbless expense commands while maintaining all existing functionality, safety validations, and fail-fast behavior for ambiguous inputs.

**Impact:** Enables pattern parsing for ~30-40% more expense commands, reducing AI fallback rate and improving response time for simple transactions.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when a message contains a valid amount with preceding description text but lacks an expense verb
- **Property (P)**: The desired behavior - verbless expense commands should be parsed deterministically with the same validation as verb-based commands
- **Preservation**: All existing parsing behaviors (verb-based expenses, income, budgets, multi-action detection, ambiguity detection) must remain unchanged
- **parseExpense()**: The private static method in `PatternParserService` at `services/ai/pattern-parser.service.ts:368` that handles expense command parsing
- **Verbless Expense Command**: A message format `<description> <amount> [hints]` without a leading action verb (e.g., "makan 12k", "kopi 5rb dari BCA")
- **Description**: The text portion before the amount that describes what the expense is for

## Bug Details

### Bug Condition

The bug manifests when a user sends an expense command without a leading verb. The `parseExpense()` function checks for expense verbs using `findStartingVerb()` and returns `null` immediately if no verb is found, preventing further parsing attempts.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type WhatsAppMessageText (string)
  OUTPUT: boolean
  
  normalizedText ← TRIM(input)
  lowerText ← LOWERCASE(normalizedText)
  
  // Must have valid amount
  amountText ← findAmountText(normalizedText)
  IF amountText = NULL THEN
    RETURN FALSE
  END IF
  
  amount ← parseIndonesianAmount(amountText)
  IF amount = NULL OR amount <= 0 THEN
    RETURN FALSE
  END IF
  
  // Must NOT start with expense verb
  FOR EACH verb IN EXPENSE_VERBS DO
    IF lowerText STARTS_WITH verb THEN
      RETURN FALSE
    END IF
  END FOR
  
  // Must NOT start with income verb
  FOR EACH verb IN INCOME_VERBS DO
    IF lowerText STARTS_WITH verb THEN
      RETURN FALSE
    END IF
  END FOR
  
  // Must NOT start with budget prefix
  FOR EACH prefix IN BUDGET_PREFIXES DO
    IF lowerText STARTS_WITH prefix THEN
      RETURN FALSE
    END IF
  END FOR
  
  // Must have description before amount
  amountIndex ← INDEX_OF(normalizedText, amountText)
  description ← TRIM(SUBSTRING(normalizedText, 0, amountIndex))
  
  IF description = "" OR LENGTH(description) = 0 THEN
    RETURN FALSE
  END IF
  
  // Must pass safety checks
  IF NOT isSafeInput(normalizedText) THEN
    RETURN FALSE
  END IF
  
  // Must not have multi-action indicators
  IF hasMultiActionIndicators(normalizedText) THEN
    RETURN FALSE
  END IF
  
  RETURN TRUE
END FUNCTION
```

### Examples

**Buggy Inputs (Current Failures):**
- "makan 12k" → Currently returns `null`, verb check fails at line 379
- "kopi 5rb" → Currently returns `null`, no expense verb found
- "bensin 50k" → Currently returns `null`, fails verb matching
- "parkir 3000 dari BCA" → Currently returns `null`, despite having account hint
- "makan siang 45rb kategori makanan" → Currently returns `null`, despite having category hint

**Expected Behavior:**
All above examples should parse successfully with:
- `intent: 'EXPENSE'`
- Correct `amount` extracted
- Pre-amount text as `description`
- Optional hints extracted (account, category, date)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Verb-based expense commands must continue to work exactly as before ("beli kopi 25rb")
- Income commands must remain unaffected ("gaji 10jt")
- Budget commands must remain unaffected ("budget makan 1jt")
- Multi-action detection must still trigger AI fallback ("makan 12k dan kopi 5rb")
- Ambiguity detection must still trigger AI fallback ("makan kayaknya 12k")
- Complex date detection must still trigger AI fallback ("makan 12k 3 hari yang lalu")
- Security validation must still reject malicious input
- All existing hint extraction (account, category, date) must work for verbless commands

**Scope:**
All inputs that do NOT match the verbless expense pattern should be completely unaffected by this fix. This includes:
- All verb-based commands (expense, income)
- All budget allocation commands
- Messages requiring AI fallback (multi-action, ambiguous, complex dates)
- Invalid or malicious input

## Hypothesized Root Cause

Based on code analysis, the root cause is clear:

1. **Early Return on Verb Mismatch**: At line 379 in `parseExpense()`, the function performs an early return when `findStartingVerb(text, EXPENSE_VERBS)` returns `null`:
   ```typescript
   const matchedVerb = findStartingVerb(text, EXPENSE_VERBS);
   if (!matchedVerb) {
     return null; // Not an expense command
   }
   ```

2. **Verb-Dependent Description Extraction**: The current implementation uses `extractBetweenVerbAndAmount()` which requires a verb to determine where the description starts. This function cannot handle verbless commands.

3. **Design Assumption**: The original design assumed all expense commands would follow the explicit verb pattern, which is valid for formal language but doesn't match colloquial Indonesian usage patterns.

## Correctness Properties

Property 1: Bug Condition - Verbless Expense Recognition

_For any_ input where the bug condition holds (isBugCondition returns true), the fixed parseExpense function SHALL successfully parse the command, extracting the pre-amount text as description, the amount as a positive number, and any optional hints (account, category, date), returning a valid PatternParsedIntent with intent 'EXPENSE'.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8**

Property 2: Preservation - Existing Behavior Unchanged

_For any_ input where the bug condition does NOT hold (isBugCondition returns false), the fixed parseExpense function SHALL produce exactly the same result as the original function, preserving all existing parsing behaviors for verb-based commands, multi-action detection, ambiguity detection, complex date detection, and security validation.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct (which is confirmed by code inspection):

**File**: `services/ai/pattern-parser.service.ts`

**Function**: `parseExpense()` (private static method starting at line 368)

**Specific Changes**:

1. **Modify Verb Matching Logic** (Lines 378-382):
   - Change from mandatory verb requirement to optional verb detection
   - Store verb match result but don't return null immediately
   - Use verb match to determine description extraction strategy
   
   ```typescript
   // BEFORE (Line 378-382):
   const matchedVerb = findStartingVerb(text, EXPENSE_VERBS);
   if (!matchedVerb) {
     return null; // Not an expense command
   }
   
   // AFTER:
   const matchedVerb = findStartingVerb(text, EXPENSE_VERBS);
   const hasVerb = matchedVerb !== null;
   ```

2. **Add Verbless Command Detection** (After amount validation, before description extraction):
   - Check if command is verbless (no verb but has amount)
   - Validate that verbless command has description before amount
   - Implement fail-fast logic for verbless commands without description
   
   ```typescript
   // NEW CODE (After line 398 - amount validation):
   
   // If no verb found, check if this is a verbless expense command
   if (!hasVerb) {
     // For verbless commands, check for other command types first
     const isIncome = findStartingVerb(text, INCOME_VERBS) !== null;
     const isBudget = BUDGET_PREFIXES.some(prefix => 
       text.toLowerCase().startsWith(prefix)
     );
     
     if (isIncome || isBudget) {
       return null; // Not an expense, let other parsers handle it
     }
     
     // Verbless expense: extract description as text before amount
     const amountIndex = text.indexOf(amountText);
     const description = text.substring(0, amountIndex).trim();
     
     if (!description || description.length === 0) {
       return null; // No description means invalid verbless command
     }
     
     // Continue to hint extraction with verbless description
   }
   ```

3. **Modify Description Extraction Logic** (Lines 402-407):
   - Add conditional logic to use different extraction strategy based on verb presence
   - For verb-based commands: use existing `extractBetweenVerbAndAmount()`
   - For verbless commands: use pre-amount text as description
   
   ```typescript
   // BEFORE (Lines 402-407):
   const description = extractBetweenVerbAndAmount(text, matchedVerb, amountText);
   if (!description || description.length === 0) {
     return null; // Description required for expense
   }
   
   // AFTER:
   let description: string;
   
   if (hasVerb) {
     // Verb-based command: extract between verb and amount
     description = extractBetweenVerbAndAmount(text, matchedVerb!, amountText);
     
     if (!description || description.length === 0) {
       return null; // Description required for verb-based expense
     }
   } else {
     // Verbless command: description already extracted above
     // (description variable already set in verbless detection block)
   }
   ```

4. **Ensure Hint Extraction Works for Verbless Commands** (Lines 409-414):
   - No changes needed - existing hint extraction functions work independently of verb presence
   - Account hint extraction: `extractAccountHint(text)` scans entire text
   - Category hint extraction: `extractCategoryHint(text)` scans entire text
   - Date extraction logic (lines 416-467) also works independently
   
   ```typescript
   // EXISTING CODE (Lines 409-414) - No changes needed:
   const accountHint = extractAccountHint(text);
   const categoryHint = extractCategoryHint(text);
   // ... date extraction continues unchanged
   ```

5. **Code Organization Refactoring** (Optional but recommended):
   - Extract verbless detection logic into a helper method for clarity
   - This keeps `parseExpense()` readable and testable
   
   ```typescript
   // NEW HELPER METHOD:
   private static extractVerblessDescription(
     text: string, 
     amountText: string
   ): string | null {
     const amountIndex = text.indexOf(amountText);
     if (amountIndex === -1) {
       return null;
     }
     
     const description = text.substring(0, amountIndex).trim();
     return description.length > 0 ? description : null;
   }
   ```

### Implementation Algorithm

**Updated parseExpense() Flow:**

```
FUNCTION parseExpense_FIXED(text)
  // Phase 1: Multi-action detection (unchanged)
  IF hasMultiActionIndicators(text) THEN
    RETURN NULL
  END IF
  
  // Phase 2: Verb detection (MODIFIED - no longer mandatory)
  matchedVerb ← findStartingVerb(text, EXPENSE_VERBS)
  hasVerb ← (matchedVerb ≠ NULL)
  
  // Phase 3: Ambiguity detection (unchanged)
  IF hasAmbiguousModifiers(text) THEN
    RETURN NULL
  END IF
  
  // Phase 4: Complex date detection (unchanged)
  IF hasComplexDateExpression(text) THEN
    RETURN NULL
  END IF
  
  // Phase 5: Amount extraction (unchanged)
  amountText ← findAmountText(text)
  IF amountText = NULL THEN
    RETURN NULL
  END IF
  
  amount ← parseIndonesianAmount(amountText)
  IF amount = NULL OR amount ≤ 0 THEN
    RETURN NULL
  END IF
  
  // Phase 6: Description extraction (NEW LOGIC)
  description ← NULL
  
  IF hasVerb THEN
    // Verb-based command (existing logic)
    description ← extractBetweenVerbAndAmount(text, matchedVerb, amountText)
    
    IF description = NULL OR LENGTH(description) = 0 THEN
      RETURN NULL
    END IF
  ELSE
    // Verbless command (NEW LOGIC)
    // Check if this is actually an income/budget command
    IF findStartingVerb(text, INCOME_VERBS) ≠ NULL THEN
      RETURN NULL  // Let income parser handle it
    END IF
    
    IF startsWithBudgetPrefix(text) THEN
      RETURN NULL  // Let budget parser handle it
    END IF
    
    // Extract description as pre-amount text
    amountIndex ← INDEX_OF(text, amountText)
    description ← TRIM(SUBSTRING(text, 0, amountIndex))
    
    IF description = NULL OR LENGTH(description) = 0 THEN
      RETURN NULL  // Invalid verbless command
    END IF
  END IF
  
  // Phase 7-9: Hint extraction and date parsing (unchanged)
  accountHint ← extractAccountHint(text)
  categoryHint ← extractCategoryHint(text)
  transactionDate ← extractDateOrDefault(text)
  
  RETURN PatternParsedIntent {
    intent: 'EXPENSE',
    amount: amount,
    description: description,
    transactionDate: transactionDate,
    accountHint: accountHint,
    categoryHint: categoryHint
  }
END FUNCTION
```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write unit tests that call `parseExpense()` with verbless expense commands on the UNFIXED code. These tests should fail, demonstrating the bug. Examine the failure modes to confirm our root cause hypothesis (early return at verb check).

**Test Cases**:
1. **Simple Verbless Expense**: Input "makan 12k" → Expected: null (will fail on unfixed code) → Confirms verb check blocks parsing
2. **Verbless with Multi-word Description**: Input "makan siang 45rb" → Expected: null (will fail on unfixed code) → Confirms description extraction issue
3. **Verbless with Account Hint**: Input "parkir 3000 dari BCA" → Expected: null (will fail on unfixed code) → Confirms hints don't save verbless commands
4. **Verbless with Category Hint**: Input "makan 25rb kategori makanan" → Expected: null (will fail on unfixed code) → Confirms category extraction doesn't work without verb

**Expected Counterexamples**:
- All verbless expense commands return `null` from `parseExpense()`
- Possible cause confirmed: Early return at line 379 when `matchedVerb` is null

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := parseExpense_fixed(input)
  ASSERT result ≠ NULL
  ASSERT result.intent = 'EXPENSE'
  ASSERT result.amount > 0
  ASSERT result.description IS_NOT_EMPTY
  ASSERT result.transactionDate IS_VALID_ISO_DATE
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  resultOriginal := parseExpense_original(input)
  resultFixed := parseExpense_fixed(input)
  ASSERT resultOriginal = resultFixed
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Run existing unit tests for `parseExpense()` against the fixed code. All existing tests should pass without modification, confirming preservation of verb-based expense parsing.

**Test Cases**:
1. **Verb-based Expense Preservation**: Verify "beli kopi 25rb" continues to parse correctly
2. **Complex Verb-based Preservation**: Verify "bayar parkir 5000 dari BCA kategori transport" continues to work
3. **Multi-action Detection Preservation**: Verify "makan 12k dan kopi 5rb" still returns null (AI fallback)
4. **Ambiguity Detection Preservation**: Verify "makan kayaknya 12k" still returns null (AI fallback)
5. **Income Command Preservation**: Verify "gaji 10jt" is not affected (returns null from parseExpense, handled by parseIncome)
6. **Budget Command Preservation**: Verify "budget makan 1jt" is not affected (returns null from parseExpense)

### Unit Tests

- Test verbless expense with simple description: "makan 12k"
- Test verbless expense with multi-word description: "makan siang 45rb"
- Test verbless expense with account hint: "parkir 3000 dari BCA"
- Test verbless expense with category hint: "makan 25rb kategori makanan"
- Test verbless expense with date: "kopi 5k kemarin"
- Test verbless expense with all hints: "makan 25rb dari BCA kategori makanan kemarin"
- Test edge case: empty description (amount at start) → should return null
- Test edge case: no amount in verbless format → should return null
- Test edge case: multiple amounts in verbless format → should return null (multi-action)
- Test preservation: all existing verb-based expense tests should pass unchanged
- Test preservation: income-like verbless commands (e.g., "gaji 10jt" without explicit income verb) handled correctly

### Property-Based Tests

Property 1: **Verbless Expense Recognition**
```typescript
// Generate random verbless expense commands
FOR 1000 iterations DO
  description ← GENERATE_RANDOM_WORD()
  amount ← GENERATE_RANDOM_AMOUNT()
  message ← description + " " + amount
  
  result ← parseExpense(message)
  
  ASSERT result ≠ NULL
  ASSERT result.intent = 'EXPENSE'
  ASSERT result.description = description
  ASSERT result.amount = PARSE(amount)
END FOR
```

Property 2: **Verb-based Command Preservation**
```typescript
// Generate random verb-based expense commands
FOR 1000 iterations DO
  verb ← RANDOM_CHOICE(EXPENSE_VERBS)
  description ← GENERATE_RANDOM_WORD()
  amount ← GENERATE_RANDOM_AMOUNT()
  message ← verb + " " + description + " " + amount
  
  resultOriginal ← parseExpense_ORIGINAL(message)
  resultFixed ← parseExpense_FIXED(message)
  
  ASSERT resultOriginal = resultFixed
END FOR
```

Property 3: **Multi-action Detection Preservation**
```typescript
// Generate random multi-action commands with verbless format
FOR 1000 iterations DO
  desc1 ← GENERATE_RANDOM_WORD()
  amt1 ← GENERATE_RANDOM_AMOUNT()
  desc2 ← GENERATE_RANDOM_WORD()
  amt2 ← GENERATE_RANDOM_AMOUNT()
  message ← desc1 + " " + amt1 + " dan " + desc2 + " " + amt2
  
  result ← parseExpense(message)
  
  ASSERT result = NULL  // Should fail fast for multi-action
END FOR
```

### Integration Tests

- Test full hybrid parser flow with verbless expense command → should use PATTERN method
- Test that verbless expenses are NOT routed to AI fallback
- Test that verbless expense results in successful transaction creation
- Test that existing verb-based expense flow continues to work end-to-end
- Test that pattern parser performance remains under 50ms for both verb-based and verbless commands

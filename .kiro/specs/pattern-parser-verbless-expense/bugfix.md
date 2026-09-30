# Bugfix Requirements Document

## Introduction

This bugfix addresses the pattern parser's failure to recognize simple Indonesian expense commands that omit action verbs. Currently, the parser requires commands to start with explicit verbs like "beli", "bayar", or "belanja". However, many Indonesian users naturally express expenses using the shortened format `<description> <amount>` (e.g., "makan 12k", "kopi 5rb", "bensin 50k"). This causes valid expense commands to fail pattern matching, fall back to AI processing, and ultimately result in parsing errors.

**Impact:** Users experience failed transaction recording and receive error messages for common, valid expense inputs. This degrades user experience and undermines the pattern parser's primary value proposition of fast, deterministic parsing for simple commands.

**Scope:** This fix modifies the expense parsing logic in `pattern-parser.service.ts` to support verbless expense commands while maintaining existing verb-based command support and all safety validations.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user sends message "makan 12k" THEN the system fails to match any expense verb and returns null from `parseExpense()`

1.2 WHEN a user sends message "kopi 5rb" without a leading verb THEN the system returns `{ success: false, reason: 'NO_MATCH', fallbackRequired: true }`

1.3 WHEN a user sends message "bensin 50k" THEN the system triggers AI fallback instead of pattern parsing

1.4 WHEN pattern parser returns null for "parkir 3000" THEN the hybrid parser routes to AI which may also fail to parse correctly

1.5 WHEN the message matches pattern `^\s*\w+\s+\d+[krbjt]?\s*$` (single word followed by amount) AND does NOT start with any verb in EXPENSE_VERBS THEN the system treats it as an unrecognized pattern

### Expected Behavior (Correct)

2.1 WHEN a user sends message "makan 12k" THEN the system SHALL parse it as an expense with amount 12000, description "makan", and use today's date

2.2 WHEN a user sends message "kopi 5rb" THEN the system SHALL return `{ success: true, intent: { intent: 'EXPENSE', amount: 5000, description: 'kopi', ... }, parseMethod: 'PATTERN' }`

2.3 WHEN a user sends message "bensin 50k" THEN the system SHALL extract amount 50000 and use "bensin" as the description without requiring a verb

2.4 WHEN a user sends message matching `<description> <amount>` format AND the description is a single word or phrase before the amount THEN the system SHALL treat the entire pre-amount text as the description

2.5 WHEN a verbless expense command is detected (description + amount only) THEN the system SHALL apply the same validation rules as verb-based commands (multi-action detection, ambiguity detection, complex date detection, security validation)

2.6 WHEN a user sends "parkir 3000 dari BCA" (verbless with account hint) THEN the system SHALL parse description "parkir", amount 3000, and extract accountHint "BCA"

2.7 WHEN a user sends "makan 25rb kategori makanan" (verbless with category hint) THEN the system SHALL parse description "makan", amount 25000, and extract categoryHint "makanan"

2.8 WHEN a user sends "kopi 5k kemarin" (verbless with date) THEN the system SHALL parse description "kopi", amount 5000, and extract date "kemarin" correctly

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user sends message "beli kopi 25rb" with explicit verb THEN the system SHALL CONTINUE TO parse it successfully as before

3.2 WHEN a user sends message "bayar parkir 5000 dari BCA" with verb and account hint THEN the system SHALL CONTINUE TO extract all components correctly

3.3 WHEN a user sends message "belanja bulanan 500k kategori belanja" with verb and category THEN the system SHALL CONTINUE TO handle it as an expense command

3.4 WHEN multi-action indicators are detected in "makan 12k dan kopi 5rb" THEN the system SHALL CONTINUE TO return null for AI fallback

3.5 WHEN ambiguous modifiers are detected in "makan kayaknya 12k" THEN the system SHALL CONTINUE TO return null for AI fallback

3.6 WHEN complex date expressions are detected in "makan 12k 3 hari yang lalu" THEN the system SHALL CONTINUE TO return null for AI fallback

3.7 WHEN security validation detects malicious patterns in input THEN the system SHALL CONTINUE TO return `{ success: false, reason: 'INVALID_FORMAT', fallbackRequired: true }`

3.8 WHEN income commands like "gaji 10jt" or budget commands like "budget makan 1jt" are sent THEN the system SHALL CONTINUE TO parse them with their respective parsers (parseIncome, parseBudgetAllocation)

3.9 WHEN empty or invalid input is provided THEN the system SHALL CONTINUE TO return INVALID_FORMAT failure

3.10 WHEN the extracted amount is zero or negative in verbless commands THEN the system SHALL return null to trigger AI fallback

3.11 WHEN no amount is found in verbless commands THEN the system SHALL return null to trigger AI fallback

---

## Bug Condition Specification

### Bug Condition Function C(X)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type WhatsAppMessageText (string)
  OUTPUT: boolean
  
  // Check if message triggers the bug
  normalizedText ← TRIM(X)
  lowerText ← LOWERCASE(normalizedText)
  
  // Condition 1: Must have valid amount
  amountText ← findAmountText(normalizedText)
  IF amountText = NULL THEN
    RETURN FALSE
  END IF
  
  amount ← parseIndonesianAmount(amountText)
  IF amount = NULL OR amount <= 0 THEN
    RETURN FALSE
  END IF
  
  // Condition 2: Must NOT start with expense verb
  FOR EACH verb IN EXPENSE_VERBS DO
    IF lowerText STARTS_WITH verb THEN
      RETURN FALSE  // Verb-based commands work correctly
    END IF
  END FOR
  
  // Condition 3: Must NOT start with income verb (different parser)
  FOR EACH verb IN INCOME_VERBS DO
    IF lowerText STARTS_WITH verb THEN
      RETURN FALSE  // Income commands handled by parseIncome
    END IF
  END FOR
  
  // Condition 4: Must NOT start with budget prefix (different parser)
  FOR EACH prefix IN BUDGET_PREFIXES DO
    IF lowerText STARTS_WITH prefix THEN
      RETURN FALSE  // Budget commands handled by parseBudgetAllocation
    END IF
  END FOR
  
  // Condition 5: Must have description (text before amount)
  amountIndex ← INDEX_OF(normalizedText, amountText)
  description ← TRIM(SUBSTRING(normalizedText, 0, amountIndex))
  
  IF description = "" OR LENGTH(description) = 0 THEN
    RETURN FALSE  // No description means not a valid expense
  END IF
  
  // Condition 6: Must pass basic safety checks
  IF NOT isSafeInput(normalizedText) THEN
    RETURN FALSE  // Malicious input handled correctly
  END IF
  
  // Condition 7: Must not have multi-action indicators
  IF hasMultiActionIndicators(normalizedText) THEN
    RETURN FALSE  // Multi-action handled by returning null (correct)
  END IF
  
  // All conditions met: this is a verbless expense command that currently fails
  RETURN TRUE
END FUNCTION
```

### Fix Checking Property

```pascal
// Property: Fix Checking - Verbless Expense Recognition
FOR ALL X WHERE isBugCondition(X) DO
  result ← PatternParserService.attemptPatternParse(X)
  
  ASSERT result.success = TRUE
  ASSERT result.intent.intent = 'EXPENSE'
  ASSERT result.intent.amount > 0
  ASSERT result.intent.description IS_NOT_EMPTY
  ASSERT result.parseMethod = 'PATTERN'
  ASSERT result.processingTimeMs < 100  // Performance maintained
END FOR
```

**Counterexamples demonstrating the bug:**
- `calculateExpense("makan 12k")` → currently returns `null`, should return parsed intent
- `calculateExpense("kopi 5rb")` → currently returns `null`, should return parsed intent
- `calculateExpense("bensin 50k")` → currently returns `null`, should return parsed intent

### Preservation Checking Property

```pascal
// Property: Preservation Checking - Existing Commands Unaffected
FOR ALL X WHERE NOT isBugCondition(X) DO
  resultBefore ← parseExpense_ORIGINAL(X)
  resultAfter ← parseExpense_FIXED(X)
  
  ASSERT resultBefore = resultAfter
END FOR
```

This ensures:
- Verb-based expense commands continue working: "beli kopi 25rb"
- Income commands remain unaffected: "gaji 10jt"
- Budget commands remain unaffected: "budget makan 1jt"
- Multi-action detection still triggers AI fallback: "makan 12k dan kopi 5rb"
- Ambiguity detection still triggers AI fallback: "makan kayaknya 12k"
- Complex dates still trigger AI fallback: "makan 12k 3 hari yang lalu"
- Security validation still rejects malicious input

---

## Test Examples

### Buggy Inputs (Should be Fixed)

| Input | Current Result | Expected Result |
|-------|----------------|-----------------|
| "makan 12k" | `null` (NO_MATCH) | `{ success: true, intent: { intent: 'EXPENSE', amount: 12000, description: 'makan' } }` |
| "kopi 5rb" | `null` (NO_MATCH) | `{ success: true, intent: { intent: 'EXPENSE', amount: 5000, description: 'kopi' } }` |
| "bensin 50k" | `null` (NO_MATCH) | `{ success: true, intent: { intent: 'EXPENSE', amount: 50000, description: 'bensin' } }` |
| "parkir 3000" | `null` (NO_MATCH) | `{ success: true, intent: { intent: 'EXPENSE', amount: 3000, description: 'parkir' } }` |
| "makan siang 45rb" | `null` (NO_MATCH) | `{ success: true, intent: { intent: 'EXPENSE', amount: 45000, description: 'makan siang' } }` |
| "kopi 5k kemarin" | `null` (NO_MATCH) | `{ success: true, intent: { intent: 'EXPENSE', amount: 5000, description: 'kopi', transactionDate: 'yesterday' } }` |
| "parkir 3000 dari BCA" | `null` (NO_MATCH) | `{ success: true, intent: { intent: 'EXPENSE', amount: 3000, description: 'parkir', accountHint: 'BCA' } }` |

### Non-Buggy Inputs (Should Remain Unchanged)

| Input | Current Result | Expected Result (Same) |
|-------|----------------|------------------------|
| "beli kopi 25rb" | Parsed as expense | Parsed as expense (no change) |
| "bayar parkir 5000" | Parsed as expense | Parsed as expense (no change) |
| "gaji 10jt" | Parsed as income | Parsed as income (no change) |
| "budget makan 1jt" | Parsed as budget | Parsed as budget (no change) |
| "makan 12k dan kopi 5rb" | `null` (MULTI_ACTION) | `null` (MULTI_ACTION) - no change |
| "makan kayaknya 12k" | `null` (AMBIGUOUS) | `null` (AMBIGUOUS) - no change |
| "" | `INVALID_FORMAT` | `INVALID_FORMAT` - no change |
| "halo" | `null` (NO_MATCH) | `null` (NO_MATCH) - no change |

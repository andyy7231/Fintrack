# Balance Query Pattern Parser Bugfix Design

## Overview

This design implements BALANCE_QUERY intent support in the pattern parser to eliminate AI dependency for balance queries. Balance queries like "cek sisa uang saya" or "saldo BCA" are simple read-only operations that should be instant and always available. Currently, they fail with "AI assistant sedang sibuk" error during high demand or rate limiting because the pattern parser returns NO_MATCH, forcing unnecessary AI fallback.

The fix adds `parseBalanceQuery()` method to `PatternParserService` that deterministically recognizes balance query patterns and extracts `accountHint` and `isFreeCash` indicators. This reduces latency from 500-2000ms to 10-30ms and achieves 100% availability by removing AI dependency.

**Impact:**
- **Availability**: 100% success rate (no AI dependency)
- **Latency**: 10-30ms (vs 500-2000ms with AI)
- **Cost**: Zero AI API calls for balance queries
- **User Experience**: Instant, reliable balance checks

## Glossary

- **Bug_Condition (C)**: Balance query messages that currently fail with NO_MATCH in pattern parser
- **Property (P)**: Pattern parser SHALL return BALANCE_QUERY intent with accountHint and isFreeCash flags
- **Preservation**: All existing pattern matching behavior (expense, income, budget) must remain unchanged
- **isBalanceQuery()**: Existing function in `provider.ts` that detects balance query keywords
- **isFreeCashQuery()**: Existing function in `provider.ts` that differentiates free cash vs total balance queries
- **_handleBalanceQuery()**: Existing method in `FinancialParserService` that processes balance queries after parsing
- **PatternParserService**: Service in `pattern-parser.service.ts` that performs deterministic intent extraction
- **HybridParserService**: Orchestration layer that tries pattern parser first, then falls back to AI
- **accountHint**: Optional string indicating which account to query (e.g., "BCA", "Mandiri")
- **isFreeCash**: Boolean flag indicating whether user wants free cash (unallocated) vs total balance

## Bug Details

### Bug Condition

The bug manifests when a user sends a balance query message through WhatsApp. The `PatternParserService.attemptPatternParse()` method tries to match against expense, income, and budget patterns but finds no match. It returns `{ success: false, reason: 'NO_MATCH', fallbackRequired: true }`, forcing the message to AI fallback. When AI service is rate limited or experiencing high demand, the query fails with "AI assistant sedang sibuk" error instead of returning balance information.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type string (WhatsApp message text)
  OUTPUT: boolean
  
  RETURN isBalanceQuery(input.toLowerCase())
         AND NOT matchesExpensePattern(input)
         AND NOT matchesIncomePattern(input)
         AND NOT matchesBudgetPattern(input)
         AND patternParserReturns(NO_MATCH)
END FUNCTION
```

### Examples

- **"cek sisa uang saya"** - General balance query
  - Current: NO_MATCH → AI fallback → may fail with "AI sedang sibuk"
  - Expected: BALANCE_QUERY intent with accountHint=null, isFreeCash=false

- **"saldo BCA"** - Account-specific balance query
  - Current: NO_MATCH → AI fallback → may fail
  - Expected: BALANCE_QUERY intent with accountHint="BCA", isFreeCash=false

- **"uang free saya"** - Free cash query
  - Current: NO_MATCH → AI fallback → may fail
  - Expected: BALANCE_QUERY intent with accountHint=null, isFreeCash=true

- **"berapa saldo Mandiri yang bisa dipakai"** - Account-specific free cash
  - Current: NO_MATCH → AI fallback → may fail
  - Expected: BALANCE_QUERY intent with accountHint="Mandiri", isFreeCash=true

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Pattern parser's existing `parseExpense()` method must continue to work identically
- Pattern parser's existing `parseIncome()` method must continue to work identically
- Pattern parser's existing `parseBudgetAllocation()` method must continue to work identically
- Multi-action detection must continue to trigger NO_MATCH for complex messages
- Ambiguous modifier detection must continue to trigger NO_MATCH
- Complex date expression detection must continue to trigger NO_MATCH
- Security validation must continue to reject malicious input patterns
- AI parser's `_handleBalanceQuery()` method must continue to work for AI fallback cases
- Existing `isBalanceQuery()` and `isFreeCashQuery()` functions must remain unchanged for backward compatibility

**Scope:**
All inputs that do NOT involve balance query keywords should be completely unaffected by this fix. This includes:
- Expense commands ("beli kopi 25rb")
- Income commands ("gaji 10jt")
- Budget allocation commands ("budget makan 1jt")
- Multi-action messages requiring AI batch processing
- Ambiguous or complex expressions requiring AI interpretation

## Hypothesized Root Cause

Based on the bug description and code analysis, the root cause is clear:

1. **Missing Pattern Matching Logic**: The `PatternParserService.attemptPatternParse()` method only calls three parsers:
   - `parseExpense()` for expense commands
   - `parseIncome()` for income commands  
   - `parseBudgetAllocation()` for budget commands
   - **No `parseBalanceQuery()` method exists**

2. **Existing Detection Code Not Integrated**: The functions `isBalanceQuery()` and `isFreeCashQuery()` exist in `provider.ts` but are only used by the AI parser, not by the pattern parser. The pattern parser has no awareness of balance query patterns.

3. **NO_MATCH Default Behavior**: When none of the three parsers match, `attemptPatternParse()` returns `{ success: false, reason: 'NO_MATCH' }`, forcing AI fallback for all balance queries.

4. **AI Dependency Failure Point**: The hybrid parser routes NO_MATCH cases to AI, creating unnecessary dependency on AI availability for simple read-only operations that could be handled deterministically.

## Correctness Properties

Property 1: Bug Condition - Balance Query Pattern Recognition

_For any_ input where the bug condition holds (balance query message that currently returns NO_MATCH), the fixed `PatternParserService` SHALL recognize it as BALANCE_QUERY intent, extract accountHint and isFreeCash flags, and return success without requiring AI fallback, completing in 10-30ms with 100% availability.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

Property 2: Preservation - Existing Pattern Matching Behavior

_For any_ input that is NOT a balance query (expense, income, budget, or complex messages), the fixed pattern parser SHALL produce exactly the same parsing result as the original pattern parser, preserving all existing functionality for expense/income/budget commands, multi-action detection, ambiguity detection, and security validation.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10**

## Fix Implementation

### Changes Required

The fix requires adding balance query pattern matching to the pattern parser while preserving all existing behavior. All changes are contained within the `pattern-parser.service.ts` file.

**File**: `services/ai/pattern-parser.service.ts`

**Specific Changes**:

1. **Add BALANCE_QUERY to PatternParsedIntent Type**:
   - Update `PatternParsedIntent` interface to support `intent: 'BALANCE_QUERY'`
   - Add optional `isFreeCash?: boolean` field for balance query intents
   - Ensure backward compatibility by making new fields optional

2. **Create parseBalanceQuery() Private Method**:
   - Implement pattern matching for balance query keywords
   - Reuse existing `isBalanceQuery()` and `isFreeCashQuery()` logic from `provider.ts`
   - Extract accountHint using existing `extractAccountHint()` helper
   - Return `PatternParsedIntent` with intent='BALANCE_QUERY' or null if no match

3. **Integrate parseBalanceQuery() into attemptPatternParse() Flow**:
   - Add balance query check BEFORE the "No pattern matched" return
   - Maintain execution order: expense → income → budget → **balance** → NO_MATCH
   - Ensure security validation and multi-action detection run before balance query check

4. **Import Balance Query Detection Functions**:
   - Import `isBalanceQuery` and `isFreeCashQuery` from `provider.ts`
   - Use these functions in `parseBalanceQuery()` for consistency with AI parser
   - Maintain single source of truth for balance query keyword detection

5. **Update Type Definitions for Balance Query Support**:
   - Document BALANCE_QUERY intent in type definitions
   - Specify that BALANCE_QUERY does not require amount or transaction date
   - Document that accountHint and isFreeCash are the key fields for balance queries

### Implementation Details

**parseBalanceQuery() Method Signature:**
```typescript
private static parseBalanceQuery(text: string): PatternParsedIntent | null {
  try {
    // Phase 1: Check if this is a balance query using existing detection
    if (!isBalanceQuery(text)) {
      return null; // Not a balance query
    }

    // Phase 2: Detect free cash query vs total balance query
    const isFreeCash = isFreeCashQuery(text);

    // Phase 3: Extract optional account hint
    const accountHint = extractAccountHint(text);

    // Phase 4: Build intent result
    return {
      intent: 'BALANCE_QUERY',
      amount: 0, // Not applicable for balance queries
      description: 'Balance Query',
      transactionDate: getJakartaDateString(), // Current date for consistency
      accountHint,
      isFreeCash,
    };
  } catch (error) {
    console.error('[PatternParser] Error in parseBalanceQuery:', error);
    return null;
  }
}
```

**Integration into attemptPatternParse():**
```typescript
// Attempt expense parsing
const expenseResult = this.parseExpense(trimmedText);
if (expenseResult) {
  return {
    success: true,
    intent: expenseResult,
    parseMethod: 'PATTERN',
    processingTimeMs: Date.now() - startTime,
  };
}

// Attempt income parsing
const incomeResult = this.parseIncome(trimmedText);
if (incomeResult) {
  return {
    success: true,
    intent: incomeResult,
    parseMethod: 'PATTERN',
    processingTimeMs: Date.now() - startTime,
  };
}

// Attempt budget allocation parsing
const budgetResult = this.parseBudgetAllocation(trimmedText);
if (budgetResult) {
  return {
    success: true,
    intent: budgetResult,
    parseMethod: 'PATTERN',
    processingTimeMs: Date.now() - startTime,
  };
}

// NEW: Attempt balance query parsing
const balanceResult = this.parseBalanceQuery(trimmedText);
if (balanceResult) {
  return {
    success: true,
    intent: balanceResult,
    parseMethod: 'PATTERN',
    processingTimeMs: Date.now() - startTime,
  };
}

// No pattern matched
return {
  success: false,
  reason: 'NO_MATCH',
  fallbackRequired: true,
};
```

**Type Definition Updates:**
```typescript
export interface PatternParsedIntent {
  intent: 'EXPENSE' | 'INCOME' | 'BUDGET_ALLOCATION' | 'BALANCE_QUERY'; // Add BALANCE_QUERY
  amount: number;
  description: string;
  transactionDate: string; // ISO date string YYYY-MM-DD
  accountHint?: string | null;
  categoryHint?: string | null;
  categoryName?: string; // For BUDGET_ALLOCATION only
  isFreeCash?: boolean; // For BALANCE_QUERY only - true if asking for free cash, false for total balance
}
```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm that balance queries currently return NO_MATCH and fail during AI rate limiting.

**Test Plan**: Write tests that send balance query messages to the unfixed pattern parser and verify NO_MATCH is returned. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **General Balance Query Test**: Send "cek sisa uang saya" to pattern parser (will return NO_MATCH on unfixed code)
2. **Account-Specific Balance Test**: Send "saldo BCA" to pattern parser (will return NO_MATCH on unfixed code)
3. **Free Cash Query Test**: Send "uang free saya" to pattern parser (will return NO_MATCH on unfixed code)
4. **Complex Balance Query Test**: Send "berapa saldo Mandiri yang bisa dipakai" to pattern parser (will return NO_MATCH on unfixed code)

**Expected Counterexamples**:
- Pattern parser returns `{ success: false, reason: 'NO_MATCH', fallbackRequired: true }` for all balance queries
- These messages are forced to AI fallback instead of being handled deterministically
- During AI rate limiting, queries fail with "AI assistant sedang sibuk" error

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed pattern parser produces the expected BALANCE_QUERY intent.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := PatternParserService.attemptPatternParse_fixed(input)
  ASSERT result.success = true
  ASSERT result.intent.intent = 'BALANCE_QUERY'
  ASSERT result.parseMethod = 'PATTERN'
  ASSERT result.processingTimeMs < 50 // Fast deterministic parsing
  
  // Verify accountHint extraction
  IF input contains account name THEN
    ASSERT result.intent.accountHint = extractedAccountName
  ELSE
    ASSERT result.intent.accountHint = null
  END IF
  
  // Verify isFreeCash flag
  IF input contains free cash keywords THEN
    ASSERT result.intent.isFreeCash = true
  ELSE
    ASSERT result.intent.isFreeCash = false
  END IF
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed pattern parser produces the same result as the original pattern parser.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT attemptPatternParse_original(input) = attemptPatternParse_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-balance inputs

**Test Plan**: Observe behavior on UNFIXED code first for expense, income, and budget commands, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Expense Command Preservation**: Verify "beli kopi 25rb" continues to return EXPENSE intent after fix
2. **Income Command Preservation**: Verify "gaji 10jt" continues to return INCOME intent after fix
3. **Budget Command Preservation**: Verify "budget makan 1jt" continues to return BUDGET_ALLOCATION intent after fix
4. **Multi-Action Detection Preservation**: Verify "beli kopi 25rb dan makan 50rb" continues to return NO_MATCH after fix
5. **Ambiguous Modifier Preservation**: Verify "kemarin kayaknya habis 50rb" continues to return NO_MATCH after fix
6. **Security Validation Preservation**: Verify malicious inputs continue to return INVALID_FORMAT after fix

### Unit Tests

**Pattern Parser Level:**
- Test `parseBalanceQuery()` with various balance query formats
- Test balance query with account hints ("saldo BCA", "cek uang di Mandiri")
- Test balance query without account hints ("sisa uang saya", "berapa saldo total")
- Test free cash queries ("uang free", "uang yang bisa dipakai")
- Test total balance queries ("saldo total", "berapa uang saya")
- Test edge cases (empty account hint, multiple account mentions)
- Test that non-balance queries return null from `parseBalanceQuery()`

**Integration Level:**
- Test that balance queries reach `_handleBalanceQuery()` in FinancialParserService
- Test that accountHint is properly passed through to account resolution
- Test that isFreeCash flag correctly determines response format
- Test end-to-end flow from WhatsApp message to balance response
- Test that AI fallback still works if pattern parser is disabled

### Property-Based Tests

**Balance Query Recognition Properties:**
- Generate random balance query messages with various formats and verify BALANCE_QUERY intent is returned
- Generate random account names and verify accountHint extraction works correctly
- Generate random combinations of balance keywords and verify isFreeCash flag is set correctly

**Preservation Properties:**
- Generate random expense/income/budget commands and verify pattern parser results are unchanged
- Generate random multi-action messages and verify NO_MATCH behavior is preserved
- Generate random malicious inputs and verify security validation is preserved

### Integration Tests

**End-to-End Balance Query Flow:**
- Test complete flow from WhatsApp message to balance response with pattern parser
- Test that balance queries work when AI service is unavailable (rate limited)
- Test that balance queries complete in 10-30ms (vs 500-2000ms with AI)
- Test that metrics correctly record parseMethod='PATTERN' for balance queries
- Test backward compatibility: AI parser's `_handleBalanceQuery()` still works for fallback cases

# Bugfix Requirements Document

## Introduction

Balance query commands (e.g., "cek sisa uang saya", "saldo BCA") currently fail with "AI assistant sedang sibuk" error because the pattern parser lacks BALANCE_QUERY intent support. All balance queries unnecessarily fall back to AI processing, which fails during high demand or rate limiting. This creates poor user experience for simple read-only operations that should be instant and always available.

The fix adds BALANCE_QUERY pattern matching to enable deterministic parsing of balance queries without AI dependency, reducing latency from 500-2000ms to 10-30ms and achieving 100% availability.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN user sends balance query message like "cek sisa uang saya" THEN the pattern parser returns NO_MATCH and forces AI fallback

1.2 WHEN user sends account-specific balance query like "saldo BCA" THEN the pattern parser returns NO_MATCH and requires AI processing

1.3 WHEN user sends free cash query like "uang free saya" THEN the pattern parser returns NO_MATCH and depends on AI availability

1.4 WHEN AI service is rate limited or experiencing high demand THEN balance query fails with "AI assistant sedang sibuk" error message

1.5 WHEN balance query reaches AI parser successfully THEN response time is 500-2000ms instead of pattern parser's 10-30ms

### Expected Behavior (Correct)

2.1 WHEN user sends balance query message like "cek sisa uang saya" THEN the pattern parser SHALL recognize it as BALANCE_QUERY intent with accountHint: null and isFreeCash: false

2.2 WHEN user sends account-specific balance query like "saldo BCA" THEN the pattern parser SHALL extract accountHint: "BCA" and return BALANCE_QUERY intent

2.3 WHEN user sends free cash query like "uang free saya" THEN the pattern parser SHALL set isFreeCash: true and return BALANCE_QUERY intent

2.4 WHEN pattern parser successfully parses balance query THEN response time SHALL be 10-30ms without any AI dependency

2.5 WHEN pattern parser returns BALANCE_QUERY intent THEN the hybrid parser SHALL route directly to _handleBalanceQuery() without AI fallback

2.6 WHEN balance query is processed by pattern parser THEN success rate SHALL be 100% regardless of AI service availability

### Unchanged Behavior (Regression Prevention)

3.1 WHEN user sends expense command like "beli kopi 25rb" THEN the system SHALL CONTINUE TO parse as EXPENSE intent through existing parseExpense() method

3.2 WHEN user sends income command like "gaji 10jt" THEN the system SHALL CONTINUE TO parse as INCOME intent through existing parseIncome() method

3.3 WHEN user sends budget allocation command like "budget makan 1jt" THEN the system SHALL CONTINUE TO parse as BUDGET_ALLOCATION intent through existing parseBudgetAllocation() method

3.4 WHEN pattern parser encounters multi-action indicators THEN the system SHALL CONTINUE TO return NO_MATCH and fall back to AI

3.5 WHEN pattern parser encounters ambiguous modifiers THEN the system SHALL CONTINUE TO return NO_MATCH and fall back to AI

3.6 WHEN pattern parser encounters complex date expressions THEN the system SHALL CONTINUE TO return NO_MATCH and fall back to AI

3.7 WHEN pattern parser encounters malicious input patterns THEN the system SHALL CONTINUE TO return INVALID_FORMAT and reject processing

3.8 WHEN AI parser receives balance query fallback THEN the system SHALL CONTINUE TO use existing _handleBalanceQuery() implementation without modification

3.9 WHEN pattern parser fails to match any intent THEN the system SHALL CONTINUE TO return NO_MATCH and allow AI fallback

3.10 WHEN existing isBalanceQuery() and isFreeCashQuery() functions are called by AI parser THEN they SHALL CONTINUE TO work identically for backward compatibility

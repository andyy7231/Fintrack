# Bugfix Requirements Document

## Introduction

This bugfix addresses unnecessary friction in the WhatsApp transaction flow. Currently, ALL normal transactions (expense/income) require explicit YA/BATAL confirmation even when parsing succeeds and data is valid. This creates unnecessary user friction and deviates from the expected "quick capture" experience.

The fix will enable immediate transaction execution for valid, unambiguous inputs while preserving the confirmation flow for cases that genuinely require clarification.

**Impact:**
- Improved user experience: one message instead of two for standard transactions
- Reduced cognitive load: no unnecessary confirmation step
- Maintained safety: ambiguous inputs still require confirmation
- Preserved atomicity: batch transactions remain atomic

## Bug Analysis

### Current Behavior (Defect)

The current implementation creates a pending action and sends a confirmation prompt for ALL parsed financial intents, regardless of whether the data is complete and unambiguous.

1.1 WHEN a user sends "makan 50k" (clear, valid expense) THEN the system creates a PendingAction, stores it in the database, and sends "📝 Konfirmasi Pengeluaran... Balas YA untuk menyimpan atau BATAL untuk membatalkan"

1.2 WHEN a user sends "gaji 5jt" (clear, valid income) THEN the system creates a PendingAction and sends a confirmation prompt requiring explicit YA response

1.3 WHEN a user sends a batch message with multiple valid transactions THEN the system creates a BATCH PendingAction and requires YA confirmation even though all actions are valid

1.4 WHEN the user must respond "YA" to confirm THEN only after this second message does the transaction execute and balances get calculated

1.5 WHEN a valid transaction requires two messages (intent + confirmation) THEN user experience suffers from unnecessary friction

### Expected Behavior (Correct)

Valid, unambiguous transactions should execute immediately after successful parsing and validation, providing instant feedback with calculated balances.

2.1 WHEN a user sends "makan 50k" (clear, valid expense) THEN the system SHALL parse, validate, execute the transaction immediately, calculate remaining balances, and send a rich response showing category budget remaining (if exists) and total balance remaining

2.2 WHEN a user sends "gaji 5jt" (clear, valid income) THEN the system SHALL execute immediately and return success response with updated balance

2.3 WHEN a user sends a batch message with multiple valid transactions THEN the system SHALL execute all transactions atomically and return a rich summary showing expense/income totals, category budgets remaining, and total balance

2.4 WHEN a transaction executes immediately THEN the response SHALL include:
   - Success indicator (✅)
   - Transaction summary (amount, category, description)
   - Category budget remaining (if active budget exists for that category)
   - Total balance remaining (always displayed)

2.5 WHEN calculating category budget remaining THEN the system SHALL:
   - Fetch active budget for the transaction's category in current period
   - Calculate spent amount for that category in current period
   - Display remaining = budget.amount - spent
   - Only display if active budget exists; omit budget line if no budget configured

2.6 WHEN calculating total balance remaining THEN the system SHALL:
   - Sum currentBalance across all active accounts for the user
   - Display as "Sisa uang keseluruhan: Rp{amount}"

2.7 WHEN a multi-action batch executes THEN the system SHALL:
   - Execute all actions atomically (existing Phase 5.1 behavior)
   - Calculate budget remaining for each affected category (if budgets exist)
   - Display summary with totals and all relevant budget/balance information

2.8 WHEN idempotency is triggered (duplicate whatsappMessageId) THEN the system SHALL return DUPLICATE status without re-executing or sending duplicate response

### Unchanged Behavior (Regression Prevention)

These flows must continue to work exactly as before:

3.1 WHEN a user sends an ambiguous message like "keluar 100k" (unclear intent) THEN the system SHALL CONTINUE TO create a PendingAction and send a clarification prompt (not execute immediately)

3.2 WHEN a user sends incomplete data like "makan" (missing amount) THEN the system SHALL CONTINUE TO return an error message requesting the missing information

3.3 WHEN a user sends a transfer without specifying accounts like "transfer 100k" THEN the system SHALL CONTINUE TO request clarification for fromAccount and toAccount

3.4 WHEN parser returns `status: "NEEDS_CLARIFICATION"` THEN the system SHALL CONTINUE TO send the clarification text without executing

3.5 WHEN a user sends "YA" in response to a legitimate clarification prompt THEN the system SHALL CONTINUE TO execute the pending action via ConfirmationExecutor

3.6 WHEN a user sends "BATAL" THEN the system SHALL CONTINUE TO cancel the pending action without executing

3.7 WHEN a verification code is sent (e.g., "123456") THEN the system SHALL CONTINUE TO process as phone verification, not as financial transaction

3.8 WHEN a greeting is detected (e.g., "halo", "hi") THEN the system SHALL CONTINUE TO respond with greeting message via GreetingService

3.9 WHEN a balance query is detected (e.g., "saldo", "balance") THEN the system SHALL CONTINUE TO respond with account balances without creating transactions

3.10 WHEN a transaction deletion command is detected (e.g., "hapus transaksi") THEN the system SHALL CONTINUE TO handle via TransactionDeletionService

3.11 WHEN a budget query is detected THEN the system SHALL CONTINUE TO handle via BudgetQueryService

3.12 WHEN a salary allocation command is detected THEN the system SHALL CONTINUE TO handle via SalaryAllocationService

3.13 WHEN transaction execution fails due to validation error (e.g., inactive account, mismatched category type) THEN the system SHALL CONTINUE TO return error message without persisting transaction

3.14 WHEN a user is not verified (no WhatsAppContact mapping) THEN the system SHALL CONTINUE TO return registration prompt without processing financial message

3.15 WHEN atomicity fails in batch execution (one action fails) THEN the system SHALL CONTINUE TO rollback all actions in the batch

3.16 WHEN account ownership validation fails THEN the system SHALL CONTINUE TO reject transaction with error message

3.17 WHEN category type compatibility check fails THEN the system SHALL CONTINUE TO reject transaction with error message

3.18 WHEN transfer currency mismatch is detected THEN the system SHALL CONTINUE TO reject transfer with error message

3.19 WHEN all existing unit tests run THEN the system SHALL CONTINUE TO pass without regression

3.20 WHEN TypeScript compilation runs THEN the system SHALL CONTINUE TO complete without type errors

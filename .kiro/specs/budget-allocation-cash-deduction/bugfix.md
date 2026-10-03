# Comprehensive Budget-Category-Expense Accounting Bugfix Requirements

## Introduction

This document addresses critical bugs in the budget-category-expense accounting system. The system currently fails to properly connect budgets to transaction categories, resulting in incorrect free cash calculations and double-deduction of budgeted expenses.

**Core Problem**: When a user creates a budget for "Makanan & Minuman" and then records a food expense via WhatsApp (e.g., "makan 19k"), the system:
1. ❌ Deducts Rp19,000 from Actual Balance (CORRECT)
2. ❌ Does NOT deduct from the Food Budget (INCORRECT)
3. ❌ Deducts Rp19,000 from Free Cash (INCORRECT - double deduction)

**Expected Behavior**: The expense should consume the budget allocation, NOT free cash.

This bug impacts core financial tracking, leading to:
- Incorrect free cash calculations (money appears "spent twice")
- Users unable to track budget consumption accurately
- Confusion between total money, allocated funds, and truly available cash
- Inability to distinguish budgeted vs. unbudgeted spending

## Core Financial Model

The system MUST implement this accounting model consistently:

### Actual Balance
```
Actual Balance = Total Income - Total Expense +/- Transfers
```
Every real expense reduces Actual Balance, regardless of budget status.

### Allocated Budget
A budget represents money already allocated/reserved for a specific category.

### Free Cash
```
Free Cash = Actual Balance - Sum(Remaining Active Budgets)
```

### Expense Routing Logic
```
IF expense category has an active applicable budget:
    Budget Remaining decreases by expense amount
    Actual Balance decreases by expense amount
    Free Cash remains UNCHANGED (no double deduction)
    
IF expense amount > Budget Remaining:
    Budget Remaining becomes 0
    Actual Balance decreases by full expense amount
    Free Cash decreases by (expense - Budget Remaining)
    
IF expense category has NO applicable budget:
    Actual Balance decreases by expense amount
    Free Cash decreases by expense amount
```

## Bug Analysis

### Current Behavior (Defects)

**1.1** Budget Allocation Creation
WHEN user creates budget allocation (e.g., "budget makan 600k")
THEN system creates budget record AND reduces calculated free cash
STATUS: ✅ PARTIALLY IMPLEMENTED (infrastructure exists but may have edge cases)

**1.2** Free Cash Calculation 
WHEN user has Actual Balance of Rp2,000,000 and active budgets totaling Rp1,850,000
THEN system SHALL calculate Free Cash as Rp150,000
STATUS: ✅ PARTIALLY IMPLEMENTED (`AccountService.getFreeCash` exists)

**1.3** Dashboard Display
WHEN user views dashboard
THEN system displays both "Uang Keseluruhan" (Actual Balance) and "Uang Free"
STATUS: ❌ NOT IMPLEMENTED (dashboard likely shows only total balance)

**1.4** Category-Budget Matching
WHEN user records expense with resolved category (e.g., "makan 19k" → "Makanan & Minuman")
THEN system SHALL find active budget for that category
STATUS: ❌ NOT IMPLEMENTED (no category-to-budget lookup in expense flow)

**1.5** Budgeted Expense Consumption
WHEN expense category HAS active applicable budget
THEN system SHALL consume budget first, NOT reduce Free Cash
STATUS: ❌ NOT IMPLEMENTED (all expenses reduce Free Cash equally)

**1.6** Unbudgeted Expense Handling
WHEN expense category has NO active budget
THEN system SHALL reduce Free Cash
STATUS: ❌ INCORRECT (current behavior, but not explicit)

**1.7** Budget Overspending
WHEN expense amount > remaining budget
THEN system SHALL consume all remaining budget, then reduce Free Cash by overflow
STATUS: ❌ NOT IMPLEMENTED

**1.8** Multiple Budget Categories
WHEN user has budgets for multiple categories
THEN expenses SHALL only consume the matching category's budget
STATUS: ❌ NOT IMPLEMENTED

**1.9** Budget Period Applicability
WHEN expense is recorded
THEN system SHALL only match budgets where transaction date is within [startDate, endDate)
STATUS: ❌ NOT VERIFIED

**1.10** Account-Budget Association
WHEN expense is recorded on specific account
THEN system SHALL only match budgets allocated from that account
STATUS: ❌ NOT VERIFIED (schema has accountId but transaction flow may not use it)

**1.11** Income Behavior
WHEN new income is recorded
THEN Actual Balance increases, Free Cash = Actual Balance - Remaining Budgets
THEN system SHALL NOT double-subtract budgets
STATUS: ⚠️ NEEDS VERIFICATION

**1.12** Transfer Exclusion
WHEN transfer between user's own accounts occurs
THEN system SHALL NOT treat as budget-consuming expense
STATUS: ⚠️ NEEDS VERIFICATION

**1.13** Budget Update/Delete
WHEN budget is updated or deleted
THEN Free Cash recalculates correctly (deleted budget's remaining amount released)
STATUS: ⚠️ NEEDS VERIFICATION

**1.14** WhatsApp Balance Query
WHEN user asks "berapa sisa uang saya" via WhatsApp
THEN system SHALL return Free Cash, not Actual Balance
STATUS: ❌ NOT VERIFIED

**1.15** User/Account Isolation
WHEN expense is recorded
THEN budget matching SHALL enforce user ownership and account matching
STATUS: ⚠️ NEEDS VERIFICATION

### Expected Behavior (Correct)

**2.1** Category-Budget Connection
WHEN expense is created with categoryId
THEN system SHALL query for active applicable budget matching:
  - userId
  - accountId  
  - categoryId
  - transactionDate BETWEEN budget.startDate AND budget.endDate

**2.2** Budgeted Expense Flow
WHEN expense category has active budget
THEN:
  - Create expense transaction (reduces Actual Balance)
  - Budget remaining automatically recalculates (spent increases)
  - Free Cash remains unchanged
  - Validation: remaining budget ≥ 0 after consumption

**2.3** Unbudgeted Expense Flow
WHEN expense category has NO active budget
THEN:
  - Create expense transaction (reduces Actual Balance)
  - Free Cash decreases by expense amount
  - No budget affected

**2.4** Budget Overspending Handling
WHEN expense amount > remaining budget
THEN:
  - Budget consumes its remaining amount → 0
  - Overage amount = expense - remaining budget
  - Actual Balance decreases by full expense
  - Free Cash decreases by overage only
  
Example:
```
Food Budget Remaining = Rp100,000
Food Expense = Rp130,000
Result:
  - Budget Remaining: Rp100,000 → Rp0
  - Actual Balance: -Rp130,000
  - Free Cash: -Rp30,000 (overage only)
```

**2.5** Free Cash Formula Consistency
ALL parts of system (Dashboard, Account, WhatsApp, Reports) SHALL use:
```
Free Cash = Actual Balance - Sum(Remaining Active Budgets for user's accounts)
```

**2.6** Budget Period Matching
System SHALL only match budgets where:
```
transaction.transactionDate >= budget.startDate AND
transaction.transactionDate < budget.endDate
```

**2.7** Account Scoping
System SHALL only match budgets where:
```
budget.accountId = transaction.accountId
```

**2.8** Income Behavior
WHEN income transaction is created:
```
Actual Balance += income amount
Free Cash = Actual Balance - Sum(Remaining Active Budgets)
```
System SHALL NOT create/modify/re-reserve budgets automatically.

**2.9** Transfer Behavior
WHEN transfer between user's accounts occurs:
```
Source Account Actual Balance -= transfer amount
Destination Account Actual Balance += transfer amount
```
Transfer SHALL NOT be treated as expense for budget purposes.
System SHALL NOT consume budgets for internal transfers.

**2.10** Budget Creation/Update/Delete
WHEN budget is created:
  - Free Cash decreases by allocation amount
  - Actual Balance unchanged (no expense transaction created)

WHEN budget amount is increased:
  - Free Cash decreases by delta
  - Validation: sufficient free cash available

WHEN budget amount is decreased:
  - Free Cash increases by delta

WHEN budget is deleted:
  - Free Cash increases by remaining budget amount
  - Already-spent amount remains spent (does NOT reappear as free cash)

**2.11** Dashboard Consistency
Dashboard SHALL display:
  - "Uang Keseluruhan" (Actual Balance across all accounts)
  - "Uang Free" (Free Cash across all accounts)
  - Both values calculated using authoritative service methods

**2.12** WhatsApp Balance Query
"berapa sisa uang" query SHALL return:
  - Calculated Free Cash (unallocated money)
  - NOT just Actual Balance

**2.13** User/Account Isolation
ALL budget operations SHALL enforce:
  - Budget belongs to authenticated user
  - Expense account matches budget account
  - Category belongs to user (or is system default)

### Unchanged Behavior (Regression Prevention)

**3.1** Income transactions continue to increase Actual Balance correctly

**3.2** Transaction history queries return all transactions accurately

**3.3** Multi-account handling maintains separate balances per account

**3.4** Transfer operations move money atomically between accounts

**3.5** Budget period resets/renewals work according to existing logic

**3.6** Total expense reporting includes all expenses regardless of budget

**3.7** Budget progress tracking (spent/remaining) continues to work

**3.8** Category type validation (EXPENSE categories only for budgets) preserved

**3.9** Existing transaction creation validation (account ownership, category type) preserved

**3.10** Existing financial precision (NUMERIC(19,2)) preserved

## Concrete Examples

### Example 1: Budgeted Expense (No Overspending)

**Initial State:**
```
Income = Rp2,000,000
Food Budget = Rp600,000
Housing Budget = Rp750,000
Actual Balance = Rp2,000,000
Free Cash = Rp650,000
```

**Action:** "makan 19k" (Food expense)

**Expected Result:**
```
Actual Balance = Rp1,981,000
Food Budget Remaining = Rp581,000
Housing Budget Remaining = Rp750,000
Free Cash = Rp650,000 (UNCHANGED - no double deduction)
```

### Example 2: Unbudgeted Expense

**Initial State:**
```
Actual Balance = Rp1,981,000
Food Budget = Rp581,000
Housing Budget = Rp750,000
Free Cash = Rp650,000
```

**Action:** "grab 50k" (Transport expense, NO transport budget)

**Expected Result:**
```
Actual Balance = Rp1,931,000
Food Budget Remaining = Rp581,000 (unchanged)
Housing Budget Remaining = Rp750,000 (unchanged)
Free Cash = Rp600,000 (decreased by expense amount)
```

### Example 3: Budget Overspending

**Initial State:**
```
Food Budget Remaining = Rp100,000
Free Cash = Rp650,000
Actual Balance = Rp1,981,000
```

**Action:** "makan 130k" (Expense exceeds remaining budget)

**Expected Result:**
```
Actual Balance = Rp1,851,000 (full expense)
Food Budget Remaining = Rp0 (consumed fully)
Free Cash = Rp620,000 (reduced by Rp30,000 overage only)
```

### Example 4: Multiple Budget Categories

**Initial State:**
```
Income = Rp5,000,000
Food Budget = Rp1,000,000
Housing Budget = Rp1,500,000
Transport Budget = Rp500,000
Health Budget = Rp250,000
Total Allocated = Rp3,250,000
Free Cash = Rp1,750,000
```

**Action:** "makan 200k" (Food expense)

**Expected Result:**
```
Actual Balance = Rp4,800,000
Food Remaining = Rp800,000
Housing Remaining = Rp1,500,000 (unchanged)
Transport Remaining = Rp500,000 (unchanged)
Health Remaining = Rp250,000 (unchanged)
Free Cash = Rp1,750,000 (UNCHANGED)
```

### Example 5: Budget Creation

**Initial State:**
```
Actual Balance = Rp2,000,000
Free Cash = Rp2,000,000
```

**Action:** Create Food Budget Rp600,000

**Expected Result:**
```
Actual Balance = Rp2,000,000 (unchanged - no expense created)
Food Budget = Rp600,000
Free Cash = Rp1,400,000 (reduced by allocation)
```

### Example 6: Budget Deletion

**Initial State:**
```
Food Budget = Rp600,000 (original)
Food Spent = Rp100,000
Food Remaining = Rp500,000
Free Cash = Rp1,400,000
```

**Action:** Delete Food Budget

**Expected Result:**
```
Food Budget = (deleted)
Free Cash = Rp1,900,000 (released Rp500,000 remaining, NOT the spent Rp100,000)
```

## Validation Requirements

**V1.** All financial calculations MUST use the authoritative Free Cash formula

**V2.** Budget matching MUST check: userId, accountId, categoryId, date range

**V3.** Expense creation MUST attempt budget matching before reducing Free Cash

**V4.** Budget overspending MUST handle partial consumption correctly

**V5.** Transfer operations MUST NOT consume budgets

**V6.** Income operations MUST NOT double-subtract budgets

**V7.** Dashboard MUST display both Actual Balance and Free Cash

**V8.** WhatsApp balance query MUST return Free Cash

**V9.** Budget deletion MUST release only remaining (unspent) allocation

**V10.** Multi-account budgets MUST be isolated per account

## Architectural Constraints

**A1.** DO NOT create fake expense transactions for budget allocations

**A2.** DO NOT modify production transaction data

**A3.** DO NOT create competing accounting systems - use single source of truth

**A4.** DO NOT change database schema unless genuinely required

**A5.** Budget allocation MUST remain a logical reservation, not a transaction

**A6.** Preserve existing transaction atomicity and idempotency

**A7.** Preserve existing financial precision (NUMERIC(19,2))

**A8.** Reuse existing services - centralize Free Cash calculation

## Test Requirements

### Regression Tests

**T1.** Budget allocation reduces Free Cash ✓ (may already pass)

**T2.** Budgeted expense consumes budget, not Free Cash ❌ (will fail - core bug)

**T3.** Unbudgeted expense consumes Free Cash ❌ (will fail)

**T4.** Budget overspending partial consumption ❌ (will fail)

**T5.** Multiple budgets - expense only affects matching category ❌ (will fail)

**T6.** Budget creation does not create expense transaction ✓ (should pass)

**T7.** Budget deletion releases remaining amount to Free Cash ❌ (will fail)

**T8.** Category matching: "makan" → "Makanan & Minuman" → Food budget ❌ (will fail)

**T9.** Transfer does not consume budgets ❌ (needs verification)

**T10.** User isolation: Budget matching enforces user ownership ⚠️ (needs verification)

**T11.** Account isolation: Budget matching enforces account match ⚠️ (needs verification)

**T12.** Date range: Budget only matches if transaction date in period ⚠️ (needs verification)

**T13.** Income increases Free Cash correctly ⚠️ (needs verification)

**T14.** Dashboard displays both Actual Balance and Free Cash ❌ (will fail)

**T15.** WhatsApp balance query returns Free Cash ❌ (needs verification)

### Preservation Tests

**P1.** Income transactions increase balance correctly ✓ (should pass)

**P2.** Transfers move money atomically ✓ (should pass)

**P3.** Transaction history queries work ✓ (should pass)

**P4.** Multi-account operations work independently ✓ (should pass)

**P5.** Budget progress tracking (spent/remaining) ✓ (should pass)

**P6.** Category type validation preserved ✓ (should pass)

**P7.** Account ownership validation preserved ✓ (should pass)

**P8.** Existing precision preserved ✓ (should pass)

## Success Criteria

The bugfix is complete when:

✅ Free Cash formula is implemented consistently across all services

✅ Expense creation checks for active applicable budget

✅ Budgeted expenses consume budget, not Free Cash

✅ Unbudgeted expenses consume Free Cash

✅ Budget overspending handles partial consumption correctly

✅ Multiple budget categories work independently

✅ Budget period and account matching works correctly

✅ Income and transfer behaviors are correct

✅ Budget creation/update/delete affects Free Cash correctly

✅ Dashboard displays both Actual Balance and Free Cash

✅ WhatsApp balance query returns Free Cash

✅ User and account isolation is enforced

✅ All regression tests pass (T1-T15)

✅ All preservation tests pass (P1-P8)

✅ npm run lint passes

✅ npx tsc --noEmit passes

✅ npm run build succeeds

✅ No production data modified

✅ No competing accounting system created

---

**Key Definitions:**
- **Actual Balance**: Total money owned (income - expense +/- transfers)
- **Allocated Budget**: Money reserved for specific category
- **Free Cash**: Actual Balance - Sum(Remaining Active Budgets)
- **Budgeted Expense**: Expense in category with active applicable budget
- **Unbudgeted Expense**: Expense in category without active budget
- **Active Applicable Budget**: Budget where userId matches, accountId matches, categoryId matches, and transactionDate is within [startDate, endDate)
- **Budget Remaining**: Original budget amount - sum of expenses in that category during budget period
- **Overage**: Amount by which expense exceeds remaining budget


# Bugfix Requirements Document

## Introduction

This document addresses a critical bug in the budget allocation system where creating budget allocations does not reduce the available cash balance. Currently, the system treats budget allocations as soft spending limits (tracking targets) rather than hard money separations (reserved funds). This causes users to see incorrect available cash balances, as allocated money remains in the free cash pool instead of being reserved for specific budget categories.

The bug impacts the core financial tracking functionality, leading to:
- Inaccurate representation of available spending money
- Users potentially overspending their truly available funds
- Confusion between total money and free (unallocated) money

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN user creates a budget allocation (e.g., "budget nabung 500k") THEN the system creates the budget record but does NOT reduce the cash balance

1.2 WHEN user has cash balance of 2,000,000 and creates budget allocations totaling 1,850,000 THEN the system shows cash balance as 2,000,000 instead of 150,000

1.3 WHEN user views the dashboard THEN the system displays only the total cash balance without distinguishing between allocated and free money

1.4 WHEN user makes an expense from a budgeted category THEN the system deducts the amount from total cash instead of from the specific budget allocation

1.5 WHEN user makes an expense not from any budget category THEN the system deducts from total cash without considering reserved budget allocations

### Expected Behavior (Correct)

2.1 WHEN user creates a budget allocation (e.g., "budget nabung 500k") THEN the system SHALL create the budget record AND reduce the cash balance by the allocated amount

2.2 WHEN user has cash balance of 2,000,000 and creates budget allocations totaling 1,850,000 THEN the system SHALL show free cash as 150,000 (2,000,000 - 1,850,000)

2.3 WHEN user views the dashboard THEN the system SHALL display two distinct values:
   - "Uang Keseluruhan" (Total Money) = Cash balance + Budget allocations (before expenses)
   - "Uang Free" (Free Money) = Cash balance only (unallocated money available for spending)

2.4 WHEN user makes an expense from a budgeted category THEN the system SHALL deduct the amount from the specific budget allocation's remaining balance, NOT from the free cash

2.5 WHEN user makes an expense not from any budget category THEN the system SHALL deduct from the free cash balance only

### Unchanged Behavior (Regression Prevention)

3.1 WHEN user creates a regular transaction (non-budget allocation) THEN the system SHALL CONTINUE TO record the transaction and update balances correctly

3.2 WHEN user views transaction history THEN the system SHALL CONTINUE TO display all transactions with correct timestamps and details

3.3 WHEN budget allocation has remaining balance THEN the system SHALL CONTINUE TO track and display the budget's remaining amount

3.4 WHEN user has multiple accounts THEN the system SHALL CONTINUE TO maintain separate balances per account

3.5 WHEN user creates income transaction THEN the system SHALL CONTINUE TO increase the cash balance correctly

3.6 WHEN budget period resets THEN the system SHALL CONTINUE TO handle budget renewal according to existing logic

3.7 WHEN user queries budget status via WhatsApp THEN the system SHALL CONTINUE TO respond with budget information

3.8 WHEN calculating total expenses THEN the system SHALL CONTINUE TO include all expense transactions regardless of budget category

---

## Bug Condition Derivation

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type BudgetOperation
  OUTPUT: boolean
  
  // Returns true when the operation involves budget allocation
  // that should affect cash balance but currently doesn't
  RETURN (X.operationType = "CREATE_BUDGET_ALLOCATION" OR 
          X.operationType = "EXPENSE_FROM_BUDGET" OR
          X.operationType = "EXPENSE_FROM_FREE_CASH")
END FUNCTION
```

### Property Specification - Fix Checking

```pascal
// Property: Budget Allocation Reduces Cash
FOR ALL X WHERE X.operationType = "CREATE_BUDGET_ALLOCATION" DO
  initialCash ← getCashBalance(X.accountId)
  result ← createBudgetAllocation'(X)
  finalCash ← getCashBalance(X.accountId)
  
  ASSERT finalCash = initialCash - X.allocationAmount
  ASSERT result.success = true
END FOR

// Property: Dashboard Shows Separated Money Views
FOR ALL X WHERE X.operationType = "VIEW_DASHBOARD" DO
  dashboard ← getDashboard'(X.userId)
  totalAllocated ← sumBudgetAllocations(X.userId)
  
  ASSERT dashboard.totalMoney = dashboard.freeCash + totalAllocated
  ASSERT dashboard.freeCash >= 0
  ASSERT exists(dashboard.totalMoney) AND exists(dashboard.freeCash)
END FOR

// Property: Budget Expense Deducts From Allocation
FOR ALL X WHERE X.operationType = "EXPENSE_FROM_BUDGET" DO
  initialBudget ← getBudgetRemaining(X.budgetId)
  initialFreeCash ← getFreeCash(X.accountId)
  result ← recordExpense'(X)
  finalBudget ← getBudgetRemaining(X.budgetId)
  finalFreeCash ← getFreeCash(X.accountId)
  
  ASSERT finalBudget = initialBudget - X.expenseAmount
  ASSERT finalFreeCash = initialFreeCash  // Free cash unchanged
END FOR

// Property: Non-Budget Expense Deducts From Free Cash Only
FOR ALL X WHERE X.operationType = "EXPENSE_FROM_FREE_CASH" DO
  initialFreeCash ← getFreeCash(X.accountId)
  totalAllocatedBefore ← sumBudgetAllocations(X.userId)
  result ← recordExpense'(X)
  finalFreeCash ← getFreeCash(X.accountId)
  totalAllocatedAfter ← sumBudgetAllocations(X.userId)
  
  ASSERT finalFreeCash = initialFreeCash - X.expenseAmount
  ASSERT totalAllocatedAfter = totalAllocatedBefore  // Allocations unchanged
END FOR
```

### Preservation Goal

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  // For operations that don't involve budget allocation mechanics,
  // behavior should remain identical to original system
  ASSERT F(X) = F'(X)
END FOR

// Specifically preserved behaviors:
// - Regular income transactions
// - Transaction history queries
// - Account balance queries (for non-budget contexts)
// - Multi-account handling
// - Budget period resets
// - WhatsApp query responses
// - Expense tracking and reporting
```

### Concrete Counterexample

**Scenario**: User with 2,000,000 cash creates budget allocations

```
Initial State:
  Cash Balance: 2,000,000
  Budget Allocations: 0

Action: User sends "budget makan 600k, budget kos 750k, budget nabung 500k"

Current (Buggy) Result:
  Cash Balance: 2,000,000  ❌ (should be 150,000)
  Budget Allocations: 1,850,000
  Free Cash: Not distinguished from total cash  ❌

Expected (Fixed) Result:
  Free Cash: 150,000  ✓
  Budget Allocations: 1,850,000  ✓
  Total Money: 2,000,000  ✓
  Dashboard shows both "Uang Free" (150k) and "Uang Keseluruhan" (2M)  ✓
```

**Key Definitions:**
- **F**: The original (unfixed) budget allocation system
- **F'**: The fixed budget allocation system
- **isBugCondition(X)**: True for budget allocation operations
- **¬isBugCondition(X)**: True for all other financial operations (income, transfers, queries, etc.)

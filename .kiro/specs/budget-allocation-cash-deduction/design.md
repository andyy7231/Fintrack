# Budget-Category-Expense Accounting Bugfix Design

## Overview

This design addresses critical bugs in the budget-category-expense accounting system. The core issue is that expenses do NOT check if their category has an active budget and consume that budget first. This causes incorrect Free Cash calculations and "double deduction" of budgeted expenses.

**Current Architecture**: `TransactionService.createTransaction` creates expense transactions that always reduce Actual Balance, but there is NO logic to:
1. Check if the expense category has an active applicable budget
2. Mark the budget as "spent" (budget remaining decreases)
3. Prevent Free Cash from being reduced when a budget covers the expense

**Fixed Architecture**: Expense creation MUST route through budget-aware logic that:
1. Attempts to match expense category → active budget
2. If match found: consumes budget, keeps Free Cash unchanged
3. If no match: reduces Free Cash
4. If overspending: partial budget consumption + partial Free Cash reduction

The fix implements a unified accounting model:

**Financial Model:**
```
Actual Balance = Total Income - Total Expense +/- Transfers
Free Cash = Actual Balance - Sum(Remaining Active Budgets)

Expense Routing:
  IF category has active budget THEN
    Budget Remaining -= expense
    Free Cash unchanged
  ELSE
    Free Cash -= expense
  END

Overspending:
  IF expense > Budget Remaining THEN
    Budget Remaining = 0
    Free Cash -= (expense - Budget Remaining)
  END
```

## Glossary

- **Bug_Condition (C)**: Operations involving budget-category-expense interaction (expense creation, budget matching, free cash calculation)
- **Property (P)**: Desired behavior - budgeted expenses consume budgets, unbudgeted expenses consume free cash, no double deduction
- **Preservation**: Existing income, transfer, balance calculations, and non-budget operations remain unchanged
- **Actual Balance**: Total money owned by user (income - expense +/- transfers)
- **Free Cash**: Unallocated money available for spending (Actual Balance - Remaining Budgets)
- **Allocated Budget**: Money reserved for a specific expense category
- **Budget Remaining**: Original budget amount - sum of matching category expenses in period
- **Active Applicable Budget**: Budget matching userId, accountId, categoryId, and transaction date within [startDate, endDate)
- **Budgeted Expense**: Expense in category with active applicable budget
- **Unbudgeted Expense**: Expense in category without active applicable budget
- **Overage**: Amount by which expense exceeds remaining budget
- **TransactionService.createTransaction**: Function in `services/transaction.service.ts` that creates transactions
- **BudgetService.findApplicableBudget**: NEW function to match expense → budget
- **BudgetService.consumeBudget**: NEW function to validate budget consumption
- **AccountService.getFreeCash**: Existing function that calculates Free Cash

## Bug Details

### Bug Condition

The bug manifests when expenses are created. The system creates the expense transaction (reducing Actual Balance) but:
1. Does NOT check if category has active budget
2. Does NOT consume the budget
3. Incorrectly reduces Free Cash even when budget should cover it

This causes "double deduction" - the expense reduces both Actual Balance AND Free Cash, when it should only reduce Actual Balance and the matched budget.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type TransactionOperation  
  OUTPUT: boolean
  
  RETURN input.operationType IN ['CREATE_EXPENSE', 
                                   'VIEW_FREE_CASH',
                                   'VIEW_DASHBOARD',
                                   'WHATSAPP_BALANCE_QUERY']
         AND (expenseNotMatchedToBudget(input)
              OR freeCashIncorrectlyCalculated(input)
              OR dashboardNotShowingFreeCash(input))
END FUNCTION
```

### Examples

- **Budgeted Expense**: User has Food budget Rp600k, records "makan 19k" → System reduces Actual Balance by 19k (✓) but also reduces Free Cash by 19k (❌) instead of consuming Food budget
- **Unbudgeted Expense**: User has no Transport budget, records "grab 50k" → System reduces Actual Balance (✓) and Free Cash (✓) but this is NOT explicitly budget-aware
- **Budget Overspending**: Food budget has Rp100k remaining, user spends Rp130k on food → System should consume Rp100k from budget and Rp30k from Free Cash, but currently reduces Free Cash by full Rp130k
- **Multiple Categories**: User has Food and Housing budgets, records food expense → System should only affect Food budget, but currently affects Free Cash without category distinction
- **Dashboard**: Dashboard shows only Actual Balance, not distinguishing between allocated and free money
- **WhatsApp Query**: "berapa sisa uang" likely returns Actual Balance instead of Free Cash

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Income transactions increase Actual Balance
- Transfers move money atomically between accounts
- Transaction history queries return accurate results
- Multi-account handling maintains separate balances
- Budget period resets work correctly
- Total expense reporting includes all expenses
- Budget progress tracking (spent/remaining) continues to aggregate from transactions
- Category type validation (EXPENSE only) preserved
- Account ownership validation preserved
- Financial precision (NUMERIC(19,2)) preserved

**Scope:**
All inputs that do NOT involve expense-budget interaction should be unaffected. This includes:
- Income creation
- Transfer creation
- Transaction queries
- Account balance queries (except Free Cash calculation)
- Budget queries that don't involve expense matching
- Category management
- Non-expense operations

## Hypothesized Root Cause

Based on code analysis, the root causes are:

**RC1. No Budget Matching Logic in Expense Creation**

`TransactionService.createTransaction` (lines 21-75 in `services/transaction.service.ts`) creates expense transactions but:
- ✅ Validates account ownership
- ✅ Validates category ownership and type
- ✅ Inserts transaction
- ❌ Does NOT check if category has active budget
- ❌ Does NOT mark budget as consumed

**RC2. Budget "Spent" is Derived, Not Tracked**

Budget service calculates spent amount by aggregating transactions (lines 168-186 in `services/budget.service.ts`):
```typescript
async function aggregateSpending(
  userId: string,
  categoryId: string,
  startDate: Date,
  endDate: Date
): Promise<number>
```

This is CORRECT architecture (spent is derived), but expense creation doesn't validate against budget limits or track budget-expense relationship.

**RC3. Free Cash Calculation Exists But May Not Be Used Everywhere**

`AccountService.getFreeCash` (lines 221-280 in `services/account.service.ts`) correctly calculates:
```
Free Cash = Actual Balance - Sum(Active Budget Allocations)
```

However:
- ❌ Dashboard may not use it (needs verification)
- ❌ WhatsApp balance query may not use it (needs verification)
- ✅ Account detail endpoints likely use it

**RC4. No Overspending Handling**

There is no logic to handle when expense > budget remaining:
- Should consume entire remaining budget
- Should reduce Free Cash by overage only
- Current behavior likely reduces Free Cash by full amount

**RC5. Dashboard May Not Display Free Cash**

`DashboardService.getSummary` (in `services/dashboard.service.ts`) likely returns `totalBalance` but may not include `freeCash` field.

## Correctness Properties

Property 1: Bug Condition - Budgeted Expense Consumes Budget

_For any_ expense transaction where the category has an active applicable budget (userId matches, accountId matches, categoryId matches, transactionDate within budget period), the fixed system SHALL consume the budget (spent increases) and SHALL NOT reduce Free Cash.

**Validates: Requirements 2.2**

Property 2: Bug Condition - Unbudgeted Expense Consumes Free Cash

_For any_ expense transaction where the category does NOT have an active applicable budget, the fixed system SHALL reduce Free Cash by the expense amount.

**Validates: Requirements 2.3**

Property 3: Bug Condition - Budget Overspending Partial Consumption

_For any_ expense transaction where the expense amount exceeds the budget remaining, the fixed system SHALL consume all remaining budget (to zero) and SHALL reduce Free Cash by the overage amount only.

**Validates: Requirements 2.4**

Property 4: Bug Condition - Category Budget Isolation

_For any_ expense transaction, if the user has multiple active budgets, ONLY the budget matching the expense's categoryId SHALL be affected.

**Validates: Requirements 2.8**

Property 5: Bug Condition - Dashboard Shows Free Cash

_For any_ dashboard query, the fixed system SHALL return both totalBalance (Actual Balance) and freeCash (calculated Free Cash).

**Validates: Requirements 2.11**

Property 6: Bug Condition - WhatsApp Balance Query Returns Free Cash

_For any_ WhatsApp "sisa uang" query, the fixed system SHALL return calculated Free Cash, NOT total Actual Balance.

**Validates: Requirements 2.12**

Property 7: Preservation - Budget Allocation Reduces Free Cash

_For any_ budget creation operation, the fixed system SHALL reduce calculated Free Cash by the allocation amount (existing behavior preserved).

**Validates: Requirements 3.1** (from previous phase)

Property 8: Preservation - Income Increases Balance

_For any_ income transaction, the fixed system SHALL increase Actual Balance correctly, and Free Cash SHALL equal Actual Balance minus Remaining Budgets.

**Validates: Requirements 3.1**

Property 9: Preservation - Transfers Are Budget-Neutral

_For any_ transfer operation, the fixed system SHALL NOT consume budgets, and Free Cash SHALL recalculate correctly for both source and destination accounts.

**Validates: Requirements 3.4**

Property 10: Preservation - Non-Expense Operations Unchanged

_For any_ operation that does NOT involve expense creation or free cash display (income, transfer, queries, budget queries), the fixed system SHALL produce identical behavior to the original system.

**Validates: Requirements 3.1-3.10**

## Fix Implementation

### Architectural Decision: Budget Matching Strategy

**Decision**: Use **category-based budget matching at expense creation time**.

When an expense is created:
1. Query for active applicable budget matching:
   - `budget.userId = transaction.userId`
   - `budget.accountId = transaction.accountId`
   - `budget.categoryId = transaction.categoryId`
   - `transaction.transactionDate >= budget.startDate`
   - `transaction.transactionDate < budget.endDate`

2. If match found:
   - Validate: Can the budget afford this expense?
   - If yes: Allow transaction (budget remaining will decrease via derived aggregation)
   - If no (overspending): Allow transaction but warn/validate against Free Cash

3. If no match found:
   - Validate against Free Cash availability
   - Allow transaction (Free Cash will decrease)

**Why this approach:**
- ✅ Budgets remain declarative (no stored "spent" field to synchronize)
- ✅ Budget remaining is always correct (derived from transactions)
- ✅ Expense creation validates affordability at write time
- ✅ Maintains single source of truth for balance calculations
- ✅ Supports budget overspending gracefully
- ✅ No schema changes required

### Changes Required

### File 1: `services/budget.service.ts`

**New Function**: `BudgetService.findApplicableBudget`

**Purpose**: Find active budget matching expense parameters

**Specific Changes:**

```typescript
// Add after aggregateSpendingBulk function (after line ~215)
/**
 * Find active applicable budget for an expense transaction.
 * Returns budget if found, null if no matching budget.
 * 
 * Matches on:
 * - userId
 * - accountId
 * - categoryId
 * - transactionDate within [startDate, endDate)
 */
static async findApplicableBudget(
  userId: string,
  accountId: string,
  categoryId: string,
  transactionDate: Date
): Promise<{
  id: string;
  amount: string;
  spentAmount: number;
  remaining: number;
} | null> {
  // 1. Find matching budget
  const [budget] = await db
    .select()
    .from(budgets)
    .where(
      and(
        eq(budgets.userId, userId),
        eq(budgets.accountId, accountId),
        eq(budgets.categoryId, categoryId),
        lte(budgets.startDate, transactionDate),
        gt(budgets.endDate, transactionDate)  // exclusive upper bound
      )
    )
    .limit(1);

  if (!budget) return null;

  // 2. Calculate spent amount
  const spentAmount = await aggregateSpending(
    userId,
    categoryId,
    budget.startDate,
    budget.endDate
  );

  const limitAmount = parseFloat(budget.amount);
  const remaining = limitAmount - spentAmount;

  return {
    id: budget.id,
    amount: budget.amount,
    spentAmount,
    remaining,
  };
}
```

**New Function**: `BudgetService.validateBudgetConsumption`

**Purpose**: Validate if expense can be covered by budget and/or free cash

**Specific Changes:**

```typescript
// Add after findApplicableBudget
/**
 * Validate budget consumption for an expense.
 * Returns validation result indicating:
 * - Can expense proceed?
 * - How much from budget?
 * - How much from free cash?
 * - Any warnings?
 */
static async validateBudgetConsumption(
  userId: string,
  accountId: string,
  categoryId: string | null,
  expenseAmount: number,
  transactionDate: Date
): Promise<{
  canProceed: boolean;
  budgetConsumption: number;
  freeCashConsumption: number;
  warnings: string[];
  budgetId?: string;
}> {
  const warnings: string[] = [];

  // If no category, use free cash only
  if (!categoryId) {
    const { AccountService } = await import("./account.service");
    const freeCash = await AccountService.getFreeCash(userId, accountId);

    if (expenseAmount > freeCash) {
      return {
        canProceed: false,
        budgetConsumption: 0,
        freeCashConsumption: 0,
        warnings: [
          `Free cash tidak mencukupi. Tersedia: Rp${freeCash.toLocaleString()}, Dibutuhkan: Rp${expenseAmount.toLocaleString()}`
        ],
      };
    }

    return {
      canProceed: true,
      budgetConsumption: 0,
      freeCashConsumption: expenseAmount,
      warnings: [],
    };
  }

  // Try to find applicable budget
  const budget = await this.findApplicableBudget(
    userId,
    accountId,
    categoryId,
    transactionDate
  );

  // No budget found - use free cash
  if (!budget) {
    const { AccountService } = await import("./account.service");
    const freeCash = await AccountService.getFreeCash(userId, accountId);

    if (expenseAmount > freeCash) {
      return {
        canProceed: false,
        budgetConsumption: 0,
        freeCashConsumption: 0,
        warnings: [
          `Free cash tidak mencukupi (tidak ada budget untuk kategori ini). Tersedia: Rp${freeCash.toLocaleString()}, Dibutuhkan: Rp${expenseAmount.toLocaleString()}`
        ],
      };
    }

    return {
      canProceed: true,
      budgetConsumption: 0,
      freeCashConsumption: expenseAmount,
      warnings: [],
    };
  }

  // Budget found - check if it covers the expense
  if (expenseAmount <= budget.remaining) {
    // Budget covers entire expense
    return {
      canProceed: true,
      budgetConsumption: expenseAmount,
      freeCashConsumption: 0,
      warnings: [],
      budgetId: budget.id,
    };
  }

  // Overspending - budget + free cash
  const overage = expenseAmount - budget.remaining;
  const { AccountService } = await import("./account.service");
  const freeCash = await AccountService.getFreeCash(userId, accountId);

  if (overage > freeCash) {
    return {
      canProceed: false,
      budgetConsumption: 0,
      freeCashConsumption: 0,
      warnings: [
        `Budget tersisa Rp${budget.remaining.toLocaleString()}, overage Rp${overage.toLocaleString()} melebihi free cash Rp${freeCash.toLocaleString()}`
      ],
    };
  }

  warnings.push(
    `⚠️ Budget melebihi sisa! Budget tersisa: Rp${budget.remaining.toLocaleString()}, Expense: Rp${expenseAmount.toLocaleString()}. Overage Rp${overage.toLocaleString()} akan dikurangi dari free cash.`
  );

  return {
    canProceed: true,
    budgetConsumption: budget.remaining,
    freeCashConsumption: overage,
    warnings,
    budgetId: budget.id,
  };
}
```

### File 2: `services/transaction.service.ts`

**Modified Function**: `TransactionService.createTransaction`

**Purpose**: Add budget-aware expense validation before creating transaction

**Specific Changes:**

```typescript
// Modify createTransaction function (starts at line ~21)
static async createTransaction(userId: string, input: CreateTransactionInput) {
  // 1. Verify account ownership (EXISTING)
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, input.accountId), eq(accounts.userId, userId)))
    .limit(1);

  if (!account) {
    throw new Error("Akun keuangan tidak ditemukan atau bukan milik Anda.");
  }

  if (!account.isActive) {
    throw new Error("Akun keuangan sedang nonaktif.");
  }

  // 2. Verify category ownership and type compatibility (EXISTING)
  if (input.categoryId) {
    const [category] = await db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.id, input.categoryId),
          or(isNull(categories.userId), eq(categories.userId, userId))
        )
      )
      .limit(1);

    if (!category) {
      throw new Error("Kategori tidak ditemukan.");
    }

    if (category.type !== input.type) {
      throw new Error(
        `Kategori '${category.name}' adalah tipe ${category.type}, tidak cocok dengan transaksi ${input.type}.`
      );
    }
  }

  // 3. NEW: Budget-aware validation for EXPENSE transactions
  if (input.type === "EXPENSE") {
    const { BudgetService } = await import("./budget.service");
    
    const validation = await BudgetService.validateBudgetConsumption(
      userId,
      input.accountId,
      input.categoryId || null,
      parseFloat(input.amount),
      input.transactionDate
    );

    if (!validation.canProceed) {
      throw new Error(validation.warnings.join(". "));
    }

    // Log warnings if any (overspending, etc.)
    if (validation.warnings.length > 0) {
      console.warn(`[Budget Warning] ${validation.warnings.join(". ")}`);
    }
  }

  // 4. Insert transaction (EXISTING)
  const [created] = await db
    .insert(transactions)
    .values({
      userId,
      accountId: input.accountId,
      categoryId: input.categoryId || null,
      type: input.type,
      amount: input.amount,
      description: input.description,
      transactionDate: input.transactionDate,
      source: "WEB",
      status: "CONFIRMED",
    })
    .returning();

  return created;
}
```

### File 3: `services/dashboard.service.ts`

**Modified Function**: `DashboardService.getSummary`

**Purpose**: Add freeCash to dashboard summary

**Specific Changes:**

```typescript
// Modify getSummary return (before final return statement, around line ~217)
// Calculate free cash across all active accounts
let totalFreeCash = 0;
for (const acc of activeAccounts) {
  const freeCash = await AccountService.getFreeCash(userId, acc.id);
  totalFreeCash += freeCash;
}
totalFreeCash = Math.round(totalFreeCash * 100) / 100;

return {
  totalBalance: Math.round(totalBalance * 100) / 100,  // Uang Keseluruhan
  freeCash: totalFreeCash,  // NEW: Uang Free
  incomeThisMonth: Math.round(incomeThisMonth * 100) / 100,
  expenseThisMonth: Math.round(expenseThisMonth * 100) / 100,
  netThisMonth: Math.round(netThisMonth * 100) / 100,
  activeAccountsCount: activeAccounts.length,
  recentTransactions: recent,
};
```

**Update Interface**: Add freeCash field to DashboardSummary interface:

```typescript
// Update interface (around line ~7)
export interface DashboardSummary {
  totalBalance: number;     // Uang Keseluruhan (Actual Balance)
  freeCash: number;         // NEW: Uang Free (unallocated cash)
  incomeThisMonth: number;
  expenseThisMonth: number;
  netThisMonth: number;
  activeAccountsCount: number;
  recentTransactions: RecentTransaction[];
}
```

### File 4: `app/dashboard/page.tsx` (or dashboard component)

**Modified Component**: Dashboard UI

**Purpose**: Display both Actual Balance and Free Cash

**Specific Changes:**

```typescript
// Update dashboard grid to show both values
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">
        Uang Keseluruhan
      </CardTitle>
      <DollarSign className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">
        {formatCurrency(summary.totalBalance)}
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Total saldo termasuk alokasi budget
      </p>
    </CardContent>
  </Card>
  
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">
        Uang Free
      </CardTitle>
      <Wallet className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">
        {formatCurrency(summary.freeCash)}
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Saldo tersedia untuk dibelanjakan
      </p>
      {summary.freeCash < summary.totalBalance * 0.1 && (
        <Badge variant="destructive" className="mt-2">
          Saldo free rendah!
        </Badge>
      )}
    </CardContent>
  </Card>
</div>
```

### File 5: WhatsApp Balance Query Handler

**File**: Likely in `services/whatsapp/` directory

**Purpose**: Return Free Cash for "sisa uang" queries

**Specific Changes:**

```typescript
// In WhatsApp balance query handler (find isBalanceQuery usage)
if (isBalanceQuery(message)) {
  const accounts = await AccountService.getAccountsWithBalances(userId);
  
  // Calculate total free cash across all accounts
  let totalFreeCash = 0;
  for (const acc of accounts) {
    totalFreeCash += acc.freeCash || 0;
  }
  
  return `Sisa uang Anda: ${formatCurrency(totalFreeCash)}\n\n` +
         `(Uang free/tersedia untuk dibelanjakan, sudah dikurangi alokasi budget aktif)`;
}
```

### File 6: Export new BudgetService methods

**Purpose**: Make new methods available for import

**Specific Changes:**

Ensure `findApplicableBudget` and `validateBudgetConsumption` are exported from `BudgetService` class (they are static methods, so already exported via class).

## Testing Strategy

### Validation Approach

The testing strategy follows three phases:
1. **Exploration**: Write tests that demonstrate the bug on unfixed code
2. **Fix Verification**: Verify budgeted/unbudgeted expense routing works correctly
3. **Preservation**: Ensure existing behaviors remain unchanged

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples demonstrating the bug BEFORE implementing the fix.

**Test Plan**: Create budgets, record expenses, verify incorrect behavior on UNFIXED code.

**Test Cases**:
1. **Budgeted Expense Double Deduction**: Create Food budget 600k, record food expense 19k → Verify Free Cash incorrectly decreases (WILL FAIL - this is the bug)
2. **Unbudgeted Expense**: No Transport budget, record transport expense 50k → Verify Free Cash decreases (SHOULD PASS but may not be explicitly budget-aware)
3. **Budget Overspending**: Food budget remaining 100k, expense 130k → Verify Free Cash incorrectly decreases by full 130k (WILL FAIL)
4. **Category Isolation**: Food and Housing budgets, food expense → Verify Housing budget unaffected (SHOULD PASS if budgets exist)

**Expected Counterexamples**:
- Budgeted expense reduces both budget AND Free Cash (double deduction)
- No budget matching logic exists in expense creation
- All expenses treated equally regardless of budget status

### Fix Checking

**Goal**: Verify budget-expense routing works correctly after fix.

**Pseudocode:**
```
// Property 1: Budgeted expense consumes budget, not free cash
FOR ALL input WHERE input.type = "EXPENSE" AND hasApplicableBudget(input) DO
  initialFreeCash := getFreeCash(input.accountId)
  budget := findApplicableBudget(input)
  initialBudgetRemaining := budget.remaining
  
  result := createTransaction'(input)
  
  finalFreeCash := getFreeCash(input.accountId)
  finalBudgetRemaining := getUpdatedBudget(budget.id).remaining
  
  ASSERT finalFreeCash = initialFreeCash  // Free cash unchanged
  ASSERT finalBudgetRemaining = initialBudgetRemaining - input.amount
END FOR

// Property 2: Unbudgeted expense consumes free cash
FOR ALL input WHERE input.type = "EXPENSE" AND NOT hasApplicableBudget(input) DO
  initialFreeCash := getFreeCash(input.accountId)
  
  result := createTransaction'(input)
  
  finalFreeCash := getFreeCash(input.accountId)
  
  ASSERT finalFreeCash = initialFreeCash - input.amount
END FOR

// Property 3: Overspending partial consumption
FOR ALL input WHERE input.type = "EXPENSE" AND input.amount > budgetRemaining DO
  budget := findApplicableBudget(input)
  overage := input.amount - budget.remaining
  initialFreeCash := getFreeCash(input.accountId)
  
  result := createTransaction'(input)
  
  finalBudgetRemaining := getUpdatedBudget(budget.id).remaining
  finalFreeCash := getFreeCash(input.accountId)
  
  ASSERT finalBudgetRemaining = 0
  ASSERT finalFreeCash = initialFreeCash - overage
END FOR

// Property 4: Dashboard shows free cash
FOR ALL userId DO
  summary := getDashboardSummary'(userId)
  
  ASSERT exists(summary.freeCash)
  ASSERT exists(summary.totalBalance)
  ASSERT summary.freeCash >= 0
  ASSERT summary.freeCash <= summary.totalBalance
END FOR
```

### Preservation Checking

**Goal**: Verify non-expense operations remain unchanged.

**Test Plan**: Run preservation tests on UNFIXED code first, then verify FIXED code produces identical results.

**Test Cases**:
1. Income transactions increase balance correctly
2. Transfers move money atomically
3. Transaction history queries return accurate results
4. Budget progress tracking (spent/remaining) works
5. Category validation preserved
6. Account ownership validation preserved

### Unit Tests

- Test `BudgetService.findApplicableBudget` with various matching scenarios
- Test `BudgetService.validateBudgetConsumption` with budget/no-budget/overspending cases
- Test expense creation with budget matching
- Test expense creation without budget
- Test budget overspending scenarios
- Test dashboard Free Cash display
- Test WhatsApp Free Cash query

### Property-Based Tests

- Generate random budgets and expenses → Verify routing logic
- Generate random overspending scenarios → Verify partial consumption
- Generate random multi-category scenarios → Verify isolation
- Generate random income/transfer operations → Verify preservation

### Integration Tests

- Full flow: Create budget → Record budgeted expense → Verify budget consumed, Free Cash unchanged
- Full flow: Record unbudgeted expense → Verify Free Cash reduced
- Full flow: Overspend budget → Verify partial consumption
- Dashboard integration: Verify both values displayed
- WhatsApp integration: Verify Free Cash returned for balance query
- Multi-account: Verify budget matching enforces account isolation


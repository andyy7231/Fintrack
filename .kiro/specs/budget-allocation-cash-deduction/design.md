# Budget Allocation Cash Deduction Bugfix Design

## Overview

This design addresses the bug where creating budget allocations does not reduce the available cash balance. The system currently treats budgets as soft tracking limits rather than hard money reservations, causing users to see incorrect available spending money.

The fix implements a dual-view cash management system:
- **Uang Keseluruhan (Total Money)**: The full account balance including both allocated and free money
- **Uang Free (Free Cash)**: Only the unallocated money available for non-budgeted spending

The fix ensures that:
1. Creating a budget allocation immediately reduces free cash by the allocated amount
2. Expenses from budgeted categories deduct from the allocation, not free cash
3. Expenses from non-budgeted categories deduct from free cash only
4. The dashboard displays both total and free cash to prevent overspending

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when budget allocation operations occur without affecting cash balance correctly
- **Property (P)**: The desired behavior - budget allocations should reduce free cash, expenses should deduct from correct pools
- **Preservation**: Existing transaction recording, balance calculations for non-budget operations, and multi-account handling that must remain unchanged
- **Free Cash**: The unallocated money available for non-budgeted spending (account balance minus budget allocations)
- **Total Money**: The full account balance including both allocated and free money
- **Budget Allocation**: A reserved amount of money assigned to a specific expense category for a time period
- **Budgeted Expense**: An expense transaction that belongs to a category with an active budget allocation
- **Non-Budgeted Expense**: An expense transaction that does NOT belong to any category with an active budget allocation
- **BudgetService.createBudget**: The function in `services/budget.service.ts` that creates budget allocations
- **AccountService.getAccountBalance**: The function in `services/account.service.ts` that calculates derived account balances
- **DashboardService.getSummary**: The function in `services/dashboard.service.ts` that aggregates dashboard data

## Bug Details

### Bug Condition

The bug manifests when budget allocation operations occur. The system is either not tracking budget allocations as reserved funds, not separating free cash from allocated cash, or not routing expense deductions through the correct cash pools.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type BudgetOperation
  OUTPUT: boolean
  
  RETURN input.operationType IN ['CREATE_BUDGET_ALLOCATION', 
                                   'EXPENSE_FROM_BUDGET', 
                                   'EXPENSE_FROM_FREE_CASH',
                                   'VIEW_DASHBOARD_BALANCE']
         AND (cashBalanceNotReduced(input) 
              OR expenseDeductedFromWrongPool(input)
              OR dashboardNotShowingSeparateViews(input))
END FUNCTION
```

### Examples

- **Budget Allocation**: User with 2,000,000 cash creates "budget nabung 500k" → System creates budget but cash stays at 2,000,000 instead of reducing to 1,500,000
- **Multiple Allocations**: User creates "budget makan 600k, budget kos 750k, budget nabung 500k" (total 1,850,000) → Free cash should be 150,000 but system shows 2,000,000
- **Budgeted Expense**: User spends 50,000 on "makan" category with active budget → System deducts from total cash instead of from the 600k "makan" budget allocation
- **Non-Budgeted Expense**: User spends 30,000 on "entertainment" with no budget → System should deduct from free cash only, but currently deducts from total without considering reserved allocations
- **Dashboard View**: Dashboard shows only total balance (2,000,000) without distinguishing that 1,850,000 is allocated and only 150,000 is truly free to spend

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Regular income transactions must continue to increase account balance correctly
- Transaction history queries must continue to display all transactions accurately
- Multi-account handling must maintain separate balances per account
- Transfer operations must continue to move money between accounts atomically
- Budget period resets and renewals must continue according to existing logic
- WhatsApp query responses must continue to provide budget information
- Total expense tracking and reporting must include all expense transactions regardless of budget category

**Scope:**
All inputs that do NOT involve budget allocation mechanics (creation, expense routing, dashboard display) should be completely unaffected by this fix. This includes:
- Income transactions (add to both free cash and total money)
- Account-to-account transfers (neutral to budget allocations)
- Transaction queries and history views
- Non-cash account operations (goals, categories, etc.)
- Budget queries and status checks that don't modify state

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **No Cash Deduction on Budget Creation**: The `BudgetService.createBudget` function inserts a budget record into the `budgets` table but does not create any transaction or mechanism to reduce the account balance. The system treats budgets as pure metadata (tracking limits) rather than as cash reservations.

2. **Missing Free Cash Calculation**: The `AccountService.getAccountBalance` function calculates balance as:
   ```
   balance = initialBalance + income - expense + transfersIn - transfersOut
   ```
   This does NOT subtract budget allocations, so it returns total money instead of free cash.

3. **No Budget-Aware Expense Routing**: When expenses are recorded, the system does not check if the expense category has an active budget allocation. All expenses simply deduct from the account balance without distinguishing between budgeted and non-budgeted spending.

4. **Dashboard Shows Total Only**: The `DashboardService.getSummary` function calculates `totalBalance` using `_calcTotalNetWorth`, which aggregates account balances. Since account balances don't subtract allocations, the dashboard only shows total money, not free cash.

## Correctness Properties

Property 1: Budget Condition - Budget Allocation Reduces Free Cash

_For any_ input where a budget allocation is created (operationType = "CREATE_BUDGET_ALLOCATION"), the fixed system SHALL reduce the account's free cash by the allocation amount while keeping the allocation amount tracked separately, such that totalMoney = freeCash + budgetAllocations.

**Validates: Requirements 2.1, 2.2**

Property 2: Budget Condition - Dashboard Shows Separated Views

_For any_ input where the dashboard is viewed (operationType = "VIEW_DASHBOARD"), the fixed system SHALL display both "Uang Keseluruhan" (total money including allocations) and "Uang Free" (unallocated cash available for spending), with the relationship totalMoney = freeCash + sumOfActiveAllocations.

**Validates: Requirements 2.3**

Property 3: Budget Condition - Budgeted Expense Deducts From Allocation

_For any_ expense transaction where the category has an active budget allocation (operationType = "EXPENSE_FROM_BUDGET"), the fixed system SHALL deduct the amount from the specific budget allocation's remaining balance and NOT from the free cash pool.

**Validates: Requirements 2.4**

Property 4: Budget Condition - Non-Budgeted Expense Deducts From Free Cash

_For any_ expense transaction where the category does NOT have an active budget allocation (operationType = "EXPENSE_FROM_FREE_CASH"), the fixed system SHALL deduct the amount from the free cash balance only, leaving budget allocations unchanged.

**Validates: Requirements 2.5**

Property 5: Preservation - Non-Budget Operations Unchanged

_For any_ input where the operation does NOT involve budget allocation mechanics (isBugCondition returns false), the fixed system SHALL produce exactly the same behavior as the original system, preserving all existing functionality for income transactions, transfers, transaction queries, multi-account handling, and non-budget operations.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

## Fix Implementation

### Changes Required

The fix requires modifying budget creation, expense handling, balance calculation, and dashboard aggregation to implement the dual-view cash management system.

**Architectural Decision: Derived vs Stored Approach**

We will use a **derived calculation approach** (no new database columns) because:
- Budget allocations are already stored in the `budgets` table with amounts
- Free cash can be calculated as: `accountBalance - sumOfActiveBudgetAllocations`
- This maintains consistency with the existing architecture where balances are derived from transactions
- Avoids synchronization issues between stored values
- Leverages existing transaction aggregation patterns

### File 1: `services/budget.service.ts`

**Function**: `BudgetService.createBudget`

**Current Behavior**: Creates a budget record only, does not affect account balance

**Specific Changes**:

1. **Validate Sufficient Free Cash**: Before creating the budget, calculate the account's current free cash and verify that the new allocation amount does not exceed available free cash.
   ```typescript
   // After line ~244 (after category validation)
   const freeCash = await AccountService.getFreeCash(userId, accountId);
   const allocationAmount = parseFloat(input.amount);
   
   if (allocationAmount > freeCash) {
     throw new Error(
       `Saldo free cash tidak mencukupi. Tersedia: ${freeCash}, Dibutuhkan: ${allocationAmount}`
     );
   }
   ```

2. **Track Account Association**: Budgets need to know which account they're allocated from. Add `accountId` parameter to the function signature and store it in the budget record.
   ```typescript
   // Update function signature (line 238)
   static async createBudget(
     userId: string,
     accountId: string,  // NEW parameter
     input: CreateBudgetInput
   ): Promise<BudgetProgressDTO>
   ```

3. **Store Account Reference**: Add accountId to the database insert operation.
   ```typescript
   // Modify insert values (line ~276)
   const [created] = await db
     .insert(budgets)
     .values({
       userId,
       accountId,  // NEW field
       categoryId: input.categoryId,
       periodType: input.periodType,
       startDate: startUtc,
       endDate: endUtc,
       amount: input.amount,
       currency: input.currency ?? "IDR",
     })
     .returning();
   ```

**Note**: This requires a database migration to add the `accountId` column to the `budgets` table.

### File 2: `db/schema/budget.ts`

**Changes**: Add `accountId` foreign key to track which account a budget is allocated from

**Specific Changes**:

1. **Add Account Reference**: Add the accountId field with foreign key constraint.
   ```typescript
   // After userId field (line ~38)
   accountId: text("account_id")
     .notNull()
     .references(() => accounts.id, { onDelete: "restrict" }),
   ```

2. **Add Index**: Add index for accountId queries.
   ```typescript
   // In indexes array (line ~81)
   index("budgets_accountId_idx").on(table.accountId),
   ```

3. **Add Relation**: Add relation to accounts table.
   ```typescript
   // In budgetsRelations (line ~95)
   account: one(accounts, {
     fields: [budgets.accountId],
     references: [accounts.id],
   }),
   ```

4. **Import accounts**: Add accounts import at top of file.
   ```typescript
   // Update import (line ~12)
   import { categories, accounts } from "./finance";
   ```

### File 3: `services/account.service.ts`

**New Function**: `AccountService.getFreeCash`

**Purpose**: Calculate the free (unallocated) cash for an account

**Specific Changes**:

1. **Add getFreeCash Method**: New static method to calculate free cash after budget allocations.
   ```typescript
   // Add after getAccountBalance method (line ~159)
   /**
    * Calculate free cash (unallocated money) for an account
    * Free Cash = Account Balance - Sum of Active Budget Allocations
    */
   static async getFreeCash(
     userId: string,
     accountId: string
   ): Promise<number> {
     // 1. Get total account balance
     const [account] = await db
       .select({ initialBalance: accounts.initialBalance })
       .from(accounts)
       .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
       .limit(1);
     
     if (!account) throw new Error("Account not found");
     
     const totalBalance = await this.getAccountBalance(
       userId,
       accountId,
       parseFloat(account.initialBalance)
     );
     
     // 2. Sum active budget allocations for this account
     const now = new Date();
     const [allocationsRes] = await db
       .select({
         total: sql<string>`coalesce(sum(${budgets.amount}), '0.00')`,
       })
       .from(budgets)
       .where(
         and(
           eq(budgets.userId, userId),
           eq(budgets.accountId, accountId),
           lte(budgets.startDate, now),  // Budget has started
           gte(budgets.endDate, now)     // Budget hasn't ended
         )
       );
     
     const totalAllocated = parseFloat(allocationsRes?.total || "0");
     
     // 3. Free cash = total balance - allocations
     const freeCash = totalBalance - totalAllocated;
     
     return Math.round(freeCash * 100) / 100;
   }
   ```

2. **Add Import**: Add budgets import at top of file.
   ```typescript
   // Update import (line ~2)
   import { accounts, transactions, transfers, budgets } from "@/db/schema";
   ```

3. **Update getAccountById**: Modify to return both totalBalance and freeCash.
   ```typescript
   // Modify return value (line ~109)
   const freeCash = await this.getFreeCash(userId, account.id);
   
   return {
     ...account,
     currentBalance,  // Keep for backward compatibility (total balance)
     totalBalance: currentBalance,  // Explicit total balance
     freeCash,  // New: unallocated cash
   };
   ```

4. **Update AccountWithBalance Interface**: Add freeCash field.
   ```typescript
   // Update interface (line ~7)
   export interface AccountWithBalance {
     id: string;
     userId: string;
     name: string;
     type: string;
     initialBalance: string;
     currency: string;
     isActive: boolean;
     createdAt: Date;
     updatedAt: Date;
     currentBalance: number;  // Total balance (for backward compatibility)
     totalBalance?: number;    // Explicit total balance
     freeCash?: number;        // Unallocated cash
   }
   ```

5. **Update getAccountsWithBalances**: Include freeCash for each account.
   ```typescript
   // Modify loop (line ~59)
   for (const acc of userAccounts) {
     const balance = await this.getAccountBalance(userId, acc.id, parseFloat(acc.initialBalance));
     const freeCash = await this.getFreeCash(userId, acc.id);
     results.push({
       ...acc,
       currentBalance: balance,
       totalBalance: balance,
       freeCash,
     });
   }
   ```

### File 4: `services/dashboard.service.ts`

**Functions**: `DashboardService.getSummary` and `DashboardService.getKPIs`

**Specific Changes**:

1. **Add Free Cash to Summary**: Calculate and include free cash in dashboard summary.
   ```typescript
   // Before return statement in getSummary (line ~217)
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

2. **Update DashboardSummary Interface**: Add freeCash field.
   ```typescript
   // Update interface (line ~7)
   export interface DashboardSummary {
     totalBalance: number;     // Uang Keseluruhan (total including allocations)
     freeCash: number;         // NEW: Uang Free (unallocated cash)
     incomeThisMonth: number;
     expenseThisMonth: number;
     netThisMonth: number;
     activeAccountsCount: number;
     recentTransactions: RecentTransaction[];
   }
   ```

3. **Add AccountService Import**: Ensure AccountService is imported.
   ```typescript
   // At top of file
   import { AccountService } from "./account.service";
   ```

### File 5: `schemas/budget.schema.ts`

**Changes**: Add accountId to create and update schemas

**Specific Changes**:

1. **Add accountId to createMonthlyBudgetSchema**:
   ```typescript
   // After categoryId field (line ~21)
   accountId: z.string().min(1, "accountId diperlukan"),
   ```

2. **Add accountId to createCustomBudgetSchema**:
   ```typescript
   // After categoryId field (line ~44)
   accountId: z.string().min(1, "accountId diperlukan"),
   ```

3. **Add accountId to updateBudgetSchema** (optional for updates):
   ```typescript
   // In object definition (line ~68)
   accountId: z.string().min(1).optional(),
   ```

### File 6: `app/api/v1/budgets/route.ts`

**Changes**: Pass accountId when creating budgets

**Specific Changes**:

1. **Extract accountId from Request**: Get accountId from request body.
   ```typescript
   // In POST handler, after input validation
   const { accountId, ...budgetInput } = input;
   
   if (!accountId) {
     return NextResponse.json(
       { error: "accountId diperlukan" },
       { status: 400 }
     );
   }
   ```

2. **Pass to Service**: Update service call.
   ```typescript
   // Update createBudget call
   const budget = await BudgetService.createBudget(
     session.user.id,
     accountId,  // NEW parameter
     budgetInput as CreateBudgetInput
   );
   ```

### File 7: Database Migration

**New File**: `drizzle/migrations/XXXX_add_budget_account_id.sql`

**Purpose**: Add accountId column to budgets table

**Specific Changes**:

1. **Create Migration SQL**:
   ```sql
   -- Add accountId column to budgets table
   ALTER TABLE budgets 
   ADD COLUMN account_id TEXT;
   
   -- For existing budgets, set accountId to the user's first active account
   -- (or require manual data migration before running this)
   UPDATE budgets b
   SET account_id = (
     SELECT id FROM accounts 
     WHERE user_id = b.user_id 
     AND is_active = true 
     ORDER BY created_at ASC 
     LIMIT 1
   )
   WHERE account_id IS NULL;
   
   -- Make column NOT NULL after backfill
   ALTER TABLE budgets 
   ALTER COLUMN account_id SET NOT NULL;
   
   -- Add foreign key constraint
   ALTER TABLE budgets 
   ADD CONSTRAINT budgets_account_id_fkey 
   FOREIGN KEY (account_id) 
   REFERENCES accounts(id) 
   ON DELETE RESTRICT;
   
   -- Add index for performance
   CREATE INDEX budgets_accountId_idx ON budgets(account_id);
   ```

### File 8: Frontend Dashboard Component

**Files**: `app/dashboard/page.tsx` and related dashboard components

**Specific Changes**:

1. **Display Both Values**: Update dashboard UI to show both Uang Keseluruhan and Uang Free.
   ```typescript
   // In dashboard component
   <div className="grid gap-4 md:grid-cols-2">
     <Card>
       <CardHeader>
         <CardTitle>Uang Keseluruhan</CardTitle>
         <CardDescription>Total saldo termasuk alokasi budget</CardDescription>
       </CardHeader>
       <CardContent>
         <div className="text-2xl font-bold">
           {formatCurrency(summary.totalBalance)}
         </div>
       </CardContent>
     </Card>
     
     <Card>
       <CardHeader>
         <CardTitle>Uang Free</CardTitle>
         <CardDescription>Saldo yang tersedia untuk dibelanjakan</CardDescription>
       </CardHeader>
       <CardContent>
         <div className="text-2xl font-bold">
           {formatCurrency(summary.freeCash)}
         </div>
       </CardContent>
     </Card>
   </div>
   ```

2. **Add Visual Indicator**: Show warning if free cash is low.
   ```typescript
   // Add warning badge
   {summary.freeCash < summary.totalBalance * 0.1 && (
     <Badge variant="destructive">Saldo free rendah!</Badge>
   )}
   ```

### File 9: WhatsApp Service (if applicable)

**Files**: Services that handle WhatsApp budget creation commands

**Specific Changes**:

1. **Parse or Default accountId**: When processing "budget makan 600k" commands, either:
   - Use the user's primary/default account, or
   - Prompt user to specify which account if they have multiple
   
   ```typescript
   // In WhatsApp budget creation handler
   const userAccounts = await AccountService.getAccounts(userId);
   
   if (userAccounts.length === 0) {
     return "Anda belum memiliki akun. Silakan buat akun terlebih dahulu.";
   }
   
   // Use first active account as default
   const defaultAccount = userAccounts.find(a => a.isActive) || userAccounts[0];
   
   // Create budget with accountId
   await BudgetService.createBudget(userId, defaultAccount.id, budgetInput);
   ```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that create budget allocations and verify that cash balance is reduced, then record expenses and verify they're routed correctly. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Budget Creation Test**: Create a budget allocation of 500,000 from account with 2,000,000 balance → Verify balance is NOT reduced to 1,500,000 (will fail on unfixed code)
2. **Multiple Allocations Test**: Create three budget allocations totaling 1,850,000 → Verify free cash is NOT calculated as 150,000 (will fail on unfixed code)
3. **Budgeted Expense Test**: Record expense of 50,000 to category with active budget → Verify expense deducts from total balance instead of budget allocation (will fail on unfixed code)
4. **Dashboard View Test**: Fetch dashboard summary → Verify only totalBalance is returned, no freeCash field (will fail on unfixed code)

**Expected Counterexamples**:
- Cash balance remains unchanged after budget allocation creation
- Dashboard does not show separate free cash value
- Expenses deduct from account balance regardless of budget allocation
- Possible causes: no transaction created for allocation, no free cash calculation, no expense routing logic

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
// Property 1: Budget allocation reduces free cash
FOR ALL input WHERE input.operationType = "CREATE_BUDGET_ALLOCATION" DO
  initialTotal := getAccountBalance(input.accountId)
  initialFree := getFreeCash(input.accountId)
  result := createBudget'(input.userId, input.accountId, input)
  finalFree := getFreeCash(input.accountId)
  finalTotal := getAccountBalance(input.accountId)
  
  ASSERT finalFree = initialFree - input.allocationAmount
  ASSERT finalTotal = initialTotal  // Total unchanged
  ASSERT result.success = true
END FOR

// Property 2: Dashboard shows both views
FOR ALL input WHERE input.operationType = "VIEW_DASHBOARD" DO
  dashboard := getDashboardSummary'(input.userId)
  totalAllocated := sumActiveBudgetAllocations(input.userId)
  
  ASSERT exists(dashboard.totalBalance)
  ASSERT exists(dashboard.freeCash)
  ASSERT dashboard.totalBalance >= dashboard.freeCash
  ASSERT dashboard.freeCash >= 0
END FOR

// Property 3: Budgeted expense deducts from allocation
FOR ALL input WHERE input.operationType = "EXPENSE_FROM_BUDGET" DO
  budget := getActiveBudget(input.categoryId)
  initialBudgetRemaining := budget.amount - budget.spent
  initialFreeCash := getFreeCash(input.accountId)
  
  result := recordExpense'(input)
  
  finalBudgetRemaining := getUpdatedBudget(budget.id).amount - getUpdatedBudget(budget.id).spent
  finalFreeCash := getFreeCash(input.accountId)
  
  ASSERT finalBudgetRemaining = initialBudgetRemaining - input.amount
  ASSERT finalFreeCash = initialFreeCash  // Free cash unchanged
END FOR

// Property 4: Non-budgeted expense deducts from free cash
FOR ALL input WHERE input.operationType = "EXPENSE_FROM_FREE_CASH" DO
  initialFreeCash := getFreeCash(input.accountId)
  allocationsBefore := sumActiveBudgetAllocations(input.userId)
  
  result := recordExpense'(input)
  
  finalFreeCash := getFreeCash(input.accountId)
  allocationsAfter := sumActiveBudgetAllocations(input.userId)
  
  ASSERT finalFreeCash = initialFreeCash - input.amount
  ASSERT allocationsAfter = allocationsBefore  // Allocations unchanged
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  // For operations that don't involve budget allocation mechanics,
  // behavior should remain identical to original system
  ASSERT F(input) = F'(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for income transactions, transfers, and queries, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Income Transaction Preservation**: Record income of 500,000 on unfixed code, observe it increases balance → Verify fixed code produces identical result
2. **Transfer Preservation**: Execute account-to-account transfer on unfixed code → Verify fixed code produces identical balances on both accounts
3. **Transaction Query Preservation**: Query transaction history on unfixed code → Verify fixed code returns identical results
4. **Multi-Account Preservation**: Operate on multiple accounts on unfixed code → Verify fixed code maintains separate balances identically

### Unit Tests

- Test `AccountService.getFreeCash` calculation with various budget allocation scenarios
- Test `BudgetService.createBudget` with sufficient and insufficient free cash
- Test edge case: creating budget when free cash exactly equals allocation amount
- Test edge case: attempting to create budget when free cash is zero
- Test budget creation validation error messages

### Property-Based Tests

- Generate random account balances and budget allocations → Verify `freeCash = totalBalance - allocations` invariant holds
- Generate random expense scenarios (budgeted vs non-budgeted) → Verify correct pool deduction
- Generate random dashboard queries across different user states → Verify both totalBalance and freeCash are always present and consistent
- Test preservation: generate random income/transfer operations → Verify behavior identical to original system

### Integration Tests

- Test full flow: create account → add income → create budget → verify free cash reduced
- Test expense routing: create budget → record budgeted expense → verify budget spent increases, free cash unchanged
- Test expense routing: create budget → record non-budgeted expense → verify free cash decreases, budget unchanged
- Test dashboard display: create various budgets and expenses → verify dashboard shows correct Uang Keseluruhan and Uang Free values
- Test multi-account scenario: create budgets on different accounts → verify free cash calculated independently per account
- Test WhatsApp integration: send "budget makan 600k" command → verify budget created with correct accountId and free cash reduced

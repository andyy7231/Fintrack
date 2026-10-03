# Budget-Category-Expense Accounting Bugfix Implementation Plan

## Overview

This task list implements the comprehensive bugfix for budget-category-expense accounting. The workflow follows exploratory testing methodology:
1. **Explore** - Write property-based tests BEFORE fix to understand the bug (Bug Condition)
2. **Preserve** - Write tests for non-buggy behavior (Preservation Requirements)
3. **Implement** - Apply the fix with understanding from tests
4. **Validate** - Verify fix works and doesn't break anything

**Core Issue**: Expenses do NOT check if their category has an active budget and consume that budget first. This causes:
- Double deduction (expense reduces both Actual Balance AND Free Cash when budget should cover it)
- Incorrect Free Cash calculations
- No distinction between budgeted vs. unbudgeted spending

**Architecture**: Add budget-aware expense routing that matches expense category → active budget → consumes budget OR free cash.

---

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Budgeted Expense Should Consume Budget, Not Free Cash
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples demonstrating the bug exists
  - Test implementation details from Bug Condition in design:
    - Scenario 1: Create Food budget 600k, record food expense 19k
    - EXPECTED (on unfixed code): Free Cash incorrectly decreases by 19k (BUG)
    - EXPECTED (after fix): Free Cash unchanged, Food budget remaining decreases by 19k
    - Scenario 2: No Transport budget, record transport expense 50k
    - EXPECTED: Free Cash decreases by 50k (current behavior, should be explicit)
    - Scenario 3: Food budget remaining 100k, food expense 130k
    - EXPECTED (on unfixed code): Free Cash decreases by full 130k (BUG)
    - EXPECTED (after fix): Budget consumed to 0, Free Cash decreases by 30k (overage only)
    - Scenario 4: Multiple budgets (Food 600k, Housing 750k), food expense 19k
    - EXPECTED (after fix): Only Food budget affected, Housing unchanged
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found:
    - "Budgeted expense reduces both budget AND Free Cash (double deduction)"
    - "No budget matching logic in TransactionService.createTransaction"
    - "Budget overspending reduces Free Cash by full amount instead of overage only"
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.2, 2.3, 2.4, 2.8_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Expense Operations Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs:
    - Create income transaction of 500,000 → Observe: Actual Balance increases
    - Create transfer 100,000 from Account A to B → Observe: A decreases, B increases
    - Query transaction history → Observe: All transactions returned
    - View budget progress → Observe: Spent amount calculated from transactions
    - Record expense (observe current behavior to preserve non-budget aspects)
  - Write property-based tests capturing observed behavior patterns:
    - Property: Income transactions increase Actual Balance correctly
    - Property: Transfers move money atomically
    - Property: Transaction history queries work correctly
    - Property: Budget spent aggregation works correctly
    - Property: Multi-account operations maintain isolation
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

- [ ] 3. Implement budget-category-expense accounting fix

  - [-] 3.1 Implement BudgetService.findApplicableBudget() method
    - Edit `services/budget.service.ts`
    - Add new static method after `aggregateSpendingBulk` function (after line ~215)
    - **Purpose**: Find active budget matching expense parameters
    - **Signature**: `static async findApplicableBudget(userId: string, accountId: string, categoryId: string, transactionDate: Date): Promise<{id, amount, spentAmount, remaining} | null>`
    - **Implementation**:
      1. Query budgets table with filters:
         - `eq(budgets.userId, userId)`
         - `eq(budgets.accountId, accountId)`
         - `eq(budgets.categoryId, categoryId)`
         - `lte(budgets.startDate, transactionDate)`
         - `gt(budgets.endDate, transactionDate)` // exclusive upper bound
      2. If no budget found: return null
      3. If budget found: calculate spentAmount using `aggregateSpending(userId, categoryId, startDate, endDate)`
      4. Calculate remaining: `parseFloat(budget.amount) - spentAmount`
      5. Return budget details with remaining amount
    - **Edge Cases**: Handle multiple overlapping budgets (LIMIT 1 takes first match), timezone handling (dates already in UTC from budget creation)
    - _Bug_Condition: System needs to match expense → budget before allowing expense_
    - _Expected_Behavior: Returns matching budget or null if no match_
    - _Preservation: Does not modify existing aggregateSpending logic_
    - _Requirements: 2.1_

  - [ ] 3.2 Implement BudgetService.validateBudgetConsumption() method
    - Edit `services/budget.service.ts`
    - Add new static method after `findApplicableBudget`
    - **Purpose**: Validate if expense can be covered by budget and/or free cash
    - **Signature**: `static async validateBudgetConsumption(userId, accountId, categoryId, expenseAmount, transactionDate): Promise<{canProceed, budgetConsumption, freeCashConsumption, warnings, budgetId?}>`
    - **Implementation**:
      1. If categoryId is null: validate against Free Cash only (unbudgeted expense)
         - Get Free Cash from AccountService
         - If expenseAmount > freeCash: return canProceed=false with warning
         - Else: return canProceed=true, freeCashConsumption=expenseAmount
      2. Call findApplicableBudget(userId, accountId, categoryId, transactionDate)
      3. If no budget found: validate against Free Cash (same as step 1)
      4. If budget found and expenseAmount <= remaining:
         - return canProceed=true, budgetConsumption=expenseAmount, freeCashConsumption=0
      5. If budget found and expenseAmount > remaining (overspending):
         - Calculate overage: expenseAmount - remaining
         - Get Free Cash from AccountService
         - If overage > freeCash: return canProceed=false with warning
         - Else: return canProceed=true, budgetConsumption=remaining, freeCashConsumption=overage, warnings=[overspending message]
    - **Edge Cases**: Zero budget remaining, negative amounts (should be prevented by schema), concurrent transactions (use transaction isolation)
    - _Bug_Condition: Expense creation needs affordability validation_
    - _Expected_Behavior: Returns detailed breakdown of budget/free cash consumption_
    - _Preservation: Uses existing getFreeCash method_
    - _Requirements: 2.2, 2.3, 2.4_

  - [~] 3.3 Update TransactionService.createTransaction to use budget validation
    - Edit `services/transaction.service.ts`
    - Modify `createTransaction` method (starts at line ~21)
    - **Changes**:
      1. Keep existing account ownership validation (lines 23-32)
      2. Keep existing category validation (lines 34-58)
      3. **ADD NEW**: After category validation, before transaction insert:
         ```typescript
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
         ```
      4. Keep existing transaction insert (lines 60-73)
    - **Edge Cases**: INCOME and TRANSFER types skip budget validation, null categoryId handled by validateBudgetConsumption
    - **Important**: This does NOT create separate transaction records - budget consumption is tracked via the expense transaction's category and amount matching the budget's aggregation query
    - _Bug_Condition: Expense creation must check budget before allowing transaction_
    - _Expected_Behavior: Expenses validated against budgets, throw error if insufficient funds_
    - _Preservation: Existing validation logic preserved, only adds new budget check for EXPENSE type_
    - _Requirements: 2.2, 2.3, 2.4_

  - [~] 3.4 Verify AccountService.getFreeCash implementation is correct
    - Read `services/account.service.ts` lines 221-280
    - **Verify**:
      1. Formula is correct: `Actual Balance - Sum(Active Budget Allocations)`
      2. Active budgets filtered correctly: `lte(startDate, now)` AND `gte(endDate, now)`
      3. Account isolation enforced: `eq(budgets.accountId, accountId)`
      4. User isolation enforced: `eq(budgets.userId, userId)`
      5. Null account handling correct
      6. Precision preserved: `Math.round(freeCash * 100) / 100`
    - **If corrections needed**:
      - Fix budget date filtering (should be: `lte(startDate, now)` AND `gt(endDate, now)` for exclusive upper bound)
      - Fix any isolation issues
      - Ensure fallback logic for missing accountId column works
    - _Bug_Condition: Free Cash calculation is foundation for all budget operations_
    - _Expected_Behavior: Free Cash = Actual Balance - Remaining Active Budgets_
    - _Preservation: Method already exists, only verify/fix if needed_
    - _Requirements: 1.2, 2.5_

  - [~] 3.5 Update DashboardService to include freeCash in summary
    - Edit `services/dashboard.service.ts`
    - Update `getSummary` method
    - **Changes**:
      1. Import AccountService if not already imported
      2. Before return statement (around line ~217), add:
         ```typescript
         // Calculate free cash across all active accounts
         let totalFreeCash = 0;
         for (const acc of activeAccounts) {
           const freeCash = await AccountService.getFreeCash(userId, acc.id);
           totalFreeCash += freeCash;
         }
         totalFreeCash = Math.round(totalFreeCash * 100) / 100;
         ```
      3. Update return object:
         ```typescript
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
    - Update `DashboardSummary` interface (around line ~7):
      ```typescript
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
    - _Bug_Condition: Dashboard must show both Actual Balance and Free Cash_
    - _Expected_Behavior: Dashboard returns both totalBalance and freeCash fields_
    - _Preservation: Existing summary fields preserved, only adds freeCash_
    - _Requirements: 2.11_

  - [~] 3.6 Update Dashboard UI to display both Uang Keseluruhan and Uang Free
    - Find dashboard UI component (likely `app/dashboard/page.tsx` or similar)
    - **Changes**:
      1. Create two-column grid (or update existing grid) with cards for:
         - Card 1: "Uang Keseluruhan" - displays `summary.totalBalance` with description "Total saldo termasuk alokasi budget"
         - Card 2: "Uang Free" - displays `summary.freeCash` with description "Saldo tersedia untuk dibelanjakan"
      2. Add visual indicator: if `freeCash < totalBalance * 0.1`: show warning badge "Saldo free rendah!"
      3. Use existing `formatCurrency` helper for number formatting
      4. Ensure responsive layout works on mobile
    - Example implementation provided in design document
    - _Bug_Condition: Users need to see Free Cash to avoid overspending_
    - _Expected_Behavior: Dashboard clearly displays both values_
    - _Preservation: Existing dashboard layout preserved_
    - _Requirements: 2.11_

  - [~] 3.7 Update WhatsApp balance query to return Free Cash
    - Search codebase for WhatsApp balance query handler (likely in `services/whatsapp/`)
    - Find where `isBalanceQuery()` is used (grep for "isBalanceQuery" or "sisa uang")
    - **Changes**:
      1. Update balance response to use Free Cash instead of Actual Balance
      2. Calculate total Free Cash across all user accounts:
         ```typescript
         if (isBalanceQuery(message)) {
           const accounts = await AccountService.getAccountsWithBalances(userId);
           
           let totalFreeCash = 0;
           for (const acc of accounts) {
             totalFreeCash += acc.freeCash || 0;
           }
           
           return `Sisa uang Anda: ${formatCurrency(totalFreeCash)}\n\n` +
                  `(Uang free/tersedia untuk dibelanjakan, sudah dikurangi alokasi budget aktif)`;
         }
         ```
    - **Edge Cases**: If getAccountsWithBalances doesn't include freeCash yet, call getFreeCash for each account
    - _Bug_Condition: Balance query should return unallocated money, not total balance_
    - _Expected_Behavior: WhatsApp "sisa uang" returns Free Cash with explanation_
    - _Preservation: Existing WhatsApp command parsing preserved_
    - _Requirements: 2.12_

  - [~] 3.8 Verify budget spent aggregation still works correctly
    - Read `services/budget.service.ts` lines 168-186 (`aggregateSpending` function)
    - **Verify**:
      1. Aggregation query sums EXPENSE transactions correctly
      2. Date range filtering: `gte(startDate)` AND `lt(endDate)`
      3. Category matching: `eq(transactions.categoryId, categoryId)`
      4. User isolation: `eq(transactions.userId, userId)`
      5. Type filtering: `eq(transactions.type, "EXPENSE")`
    - **Test**: Create budget, record expense, verify budget progress shows correct spent amount
    - **No changes needed** - this function is already correct and will automatically pick up new expenses
    - _Bug_Condition: Budget spent calculation is the source of truth_
    - _Expected_Behavior: Spent amount derived from transactions, always accurate_
    - _Preservation: Existing aggregation logic preserved_
    - _Requirements: 3.7_

  - [~] 3.9 Verify budget creation validation still works
    - Read `services/budget.service.ts` lines 238-262 (`createBudget` method)
    - **Verify**:
      1. Free cash validation exists: checks `AccountService.getFreeCash`
      2. Validation rejects if `allocationAmount > freeCash`
      3. accountId is required parameter and stored in budget
      4. Error message is user-friendly
    - **Test**: Attempt to create budget exceeding free cash → verify error thrown
    - **If fixes needed**: Ensure validation is robust
    - _Bug_Condition: Budget creation must not exceed available free cash_
    - _Expected_Behavior: Validation prevents over-allocation_
    - _Preservation: Existing validation preserved_
    - _Requirements: 2.10_

  - [~] 3.10 Verify transfer operations don't affect budgets
    - Search for transfer creation logic (grep for "TRANSFER" or transfer service)
    - **Verify**:
      1. Transfers are NOT type "EXPENSE"
      2. TransactionService budget validation only runs for type "EXPENSE"
      3. Free Cash recalculates correctly after transfer (via getFreeCash)
    - **Test**: Create budget, perform transfer → verify budget unaffected
    - **No changes should be needed** - transfer type is different from EXPENSE
    - _Bug_Condition: Transfers are NOT expenses and should not consume budgets_
    - _Expected_Behavior: Transfers move money without affecting budgets_
    - _Preservation: Existing transfer logic preserved_
    - _Requirements: 2.9, 3.4_

  - [~] 3.11 Verify income operations work correctly with budgets
    - Search for income creation logic
    - **Verify**:
      1. Income transactions are type "INCOME", not "EXPENSE"
      2. TransactionService budget validation only runs for type "EXPENSE"
      3. Free Cash increases correctly: `Free Cash = Actual Balance - Budgets`
      4. No automatic budget allocation or re-reservation occurs
    - **Test**: Create budget, add income → verify Free Cash increases, budget unchanged
    - **No changes should be needed** - income type is different from EXPENSE
    - _Bug_Condition: Income should NOT double-subtract budgets_
    - _Expected_Behavior: Income increases Actual Balance and Free Cash correctly_
    - _Preservation: Existing income logic preserved_
    - _Requirements: 2.8, 3.5_

  - [~] 3.12 Verify budget update/delete affects Free Cash correctly
    - Search for budget update/delete logic in `services/budget.service.ts`
    - **Verify**:
      1. Budget deletion removes budget record
      2. Free Cash recalculates via getFreeCash (which will no longer see deleted budget)
      3. Budget update changes amount
      4. Free Cash recalculates correctly after update
    - **Test scenarios**:
      - Delete budget with remaining amount → verify Free Cash increases by remaining
      - Update budget amount down → verify Free Cash increases
      - Update budget amount up → verify validation checks sufficient Free Cash
    - **Fixes if needed**: Add validation for budget increase (check Free Cash availability)
    - _Bug_Condition: Budget changes must affect Free Cash calculation_
    - _Expected_Behavior: Deleted/decreased budgets release money to Free Cash_
    - _Preservation: Existing update/delete logic preserved_
    - _Requirements: 2.10_

  - [~] 3.13 Add comprehensive integration tests for budget-expense interaction
    - Create new test file: `__tests__/services/budget-expense-integration.test.ts`
    - **Test Cases**:
      1. **Budgeted Expense Flow**: Create Food budget 600k → Record food expense 19k → Assert: Food remaining = 581k, Free Cash unchanged
      2. **Unbudgeted Expense Flow**: No Transport budget → Record transport expense 50k → Assert: Free Cash decreased by 50k
      3. **Budget Overspending**: Food budget remaining 100k → Record food expense 130k → Assert: Food remaining = 0, Free Cash decreased by 30k
      4. **Multiple Categories**: Food 600k, Housing 750k budgets → Record food expense → Assert: Only Food affected
      5. **Category Matching**: "makan 19k" → resolved to "Makanan & Minuman" → Find and consume Food budget
      6. **Period Filtering**: Budget for January → Record expense in February → Assert: Treated as unbudgeted
      7. **Account Isolation**: Budget on Account A → Expense on Account B → Assert: Treated as unbudgeted
      8. **Budget Creation**: Create budget 600k → Assert: Free Cash decreased by 600k, no expense transaction created
      9. **Budget Deletion**: Delete budget with 500k remaining → Assert: Free Cash increased by 500k
      10. **Insufficient Free Cash**: Attempt unbudgeted expense exceeding free cash → Assert: Error thrown
    - Use existing test utilities and database setup
    - _Requirements: All from 2.2-2.12_

  - [~] 3.14 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Budgeted Expense Consumes Budget, Not Free Cash
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify all assertions pass:
      - Budgeted expense: Free Cash unchanged, budget remaining decreased
      - Unbudgeted expense: Free Cash decreased
      - Budget overspending: Budget consumed to 0, Free Cash decreased by overage only
      - Multiple categories: Only matching category budget affected
    - Document that counterexamples are now resolved
    - _Requirements: 2.2, 2.3, 2.4, 2.8 (Expected Behavior Properties)_

  - [~] 3.15 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Expense Operations Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Verify all properties still hold:
      - Income transactions increase balance correctly
      - Transfers move money atomically
      - Transaction history queries work correctly
      - Budget spent aggregation works correctly
      - Multi-account operations maintain isolation
    - Confirm all tests still pass after fix (no regressions)
    - Document that preservation is maintained
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

- [~] 4. Checkpoint - Ensure all tests pass and quality gates met
  - Run complete test suite: `npm run test`
  - Verify all exploration tests pass (bug is fixed)
  - Verify all preservation tests pass (no regressions)
  - Verify integration tests pass (full flow works end-to-end)
  - Run TypeScript compilation: `npx tsc --noEmit` → 0 errors
  - Run linter: `npm run lint` → 0 errors
  - Run build: `npm run build` → success
  - Review any failing tests and address issues
  - If any questions arise or edge cases discovered, ask user for clarification
  - Verify no production data modified
  - Verify no competing accounting system created
  - Confirm fix is complete and ready for deployment

---

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1", "2"],
      "description": "Exploration and preservation tests (run on unfixed code)"
    },
    {
      "wave": 2,
      "tasks": ["3.1", "3.2"],
      "description": "Core budget matching and validation logic"
    },
    {
      "wave": 3,
      "tasks": ["3.3"],
      "description": "Integrate budget validation into expense creation"
    },
    {
      "wave": 4,
      "tasks": ["3.4", "3.8", "3.9"],
      "description": "Verify existing infrastructure (getFreeCash, aggregation, creation)"
    },
    {
      "wave": 5,
      "tasks": ["3.5", "3.6"],
      "description": "Dashboard service and UI updates"
    },
    {
      "wave": 6,
      "tasks": ["3.7"],
      "description": "WhatsApp integration updates"
    },
    {
      "wave": 7,
      "tasks": ["3.10", "3.11", "3.12"],
      "description": "Verify transfer, income, budget update/delete behavior"
    },
    {
      "wave": 8,
      "tasks": ["3.13"],
      "description": "Integration tests"
    },
    {
      "wave": 9,
      "tasks": ["3.14", "3.15"],
      "description": "Test verification (run on fixed code)"
    },
    {
      "wave": 10,
      "tasks": ["4"],
      "description": "Final checkpoint and quality gates"
    }
  ]
}
```

**Wave Explanation:**
- **Wave 1**: Independent exploration and preservation tests must be written and run on unfixed code first
- **Wave 2**: Core budget matching logic is foundational - must exist before integration
- **Wave 3**: Expense creation integration depends on Wave 2 budget logic being available
- **Wave 4**: Verification tasks can run in parallel - check existing infrastructure
- **Wave 5**: Dashboard updates depend on service layer (Wave 3-4) being correct
- **Wave 6**: WhatsApp updates depend on service layer being correct
- **Wave 7**: Behavioral verification tasks can run in parallel after core fix
- **Wave 8**: Integration tests depend on all implementation being complete
- **Wave 9**: Test verification depends on all implementation being complete
- **Wave 10**: Final checkpoint depends on all tests passing

---

## Notes

- **Property-Based Tests**: Tasks 1 and 2 use property-based testing to provide stronger guarantees. The `**Property N:**` format enables hover status tracking in the UI.
- **Exploration-First**: Task 1 MUST be run on unfixed code to confirm the bug exists before implementing the fix.
- **Observation-First**: Task 2 MUST observe behavior on unfixed code before writing preservation tests.
- **Budget Matching Architecture**: Uses category-based matching at expense creation time with derived "spent" calculation (no stored spent field).
- **No Schema Changes Required**: All infrastructure (accountId, getFreeCash, aggregateSpending) already exists.
- **Single Source of Truth**: Free Cash formula used consistently across all services.
- **No Production Data Modification**: Budget consumption tracked via transaction aggregation, not separate records.


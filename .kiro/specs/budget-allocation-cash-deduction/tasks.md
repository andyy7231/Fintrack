# Implementation Plan

## Overview

This task list implements the bugfix for budget allocation cash deduction. The workflow follows exploratory testing methodology:
1. **Explore** - Write property-based tests BEFORE fix to understand the bug (Bug Condition)
2. **Preserve** - Write tests for non-buggy behavior (Preservation Requirements)
3. **Implement** - Apply the fix with understanding from tests
4. **Validate** - Verify fix works and doesn't break anything

---

## Tasks

- [-] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Budget Allocation Should Reduce Free Cash
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For deterministic budget allocation scenarios, scope the property to concrete failing cases (e.g., creating budget of 500k from account with 2M balance)
  - Test implementation details from Bug Condition in design:
    - Create test account with initial balance of 2,000,000
    - Create budget allocation of 500,000 for "makan" category
    - Attempt to calculate free cash using AccountService.getFreeCash (function doesn't exist yet on unfixed code)
    - EXPECTED: Function does not exist OR free cash equals 2,000,000 instead of 1,500,000
    - Document the exact failure mode (missing function, incorrect calculation, etc.)
    - Create second scenario: multiple allocations (600k + 750k + 500k = 1,850k from 2M balance)
    - EXPECTED: Free cash shows 2,000,000 instead of 150,000
    - Verify dashboard only shows totalBalance, no freeCash field
  - The test assertions should match Expected Behavior Properties from design:
    - After fix: freeCash should equal totalBalance minus sum of active allocations
    - After fix: dashboard should show both totalBalance and freeCash
    - After fix: freeCash >= 0 and freeCash <= totalBalance
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found:
    - "AccountService.getFreeCash does not exist"
    - "Dashboard summary missing freeCash field"
    - "Budget allocation does not reduce available cash"
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

- [~] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Budget Operations Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs:
    - Create test account and record income transaction of 500,000
    - Observe: account balance increases by 500,000
    - Create transfer between two accounts (transfer 100,000 from A to B)
    - Observe: account A decreases by 100,000, account B increases by 100,000
    - Query transaction history
    - Observe: all transactions returned with correct details
    - Create expense transaction (not budget-related)
    - Observe: account balance decreases by expense amount
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    - Property: For all income transactions, balance increases by income amount
    - Property: For all transfers, source decreases and destination increases by same amount
    - Property: For all transaction queries, system returns complete history
    - Property: For all expense transactions (without budget context), balance decreases by expense amount
    - Property: Multi-account operations maintain separate balances
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [ ] 3. Fix for budget allocation cash deduction

  - [~] 3.1 Create database migration for accountId in budgets table
    - Create new migration file: `drizzle/migrations/XXXX_add_budget_account_id.sql`
    - Add `account_id` column to budgets table (TEXT type)
    - Backfill existing budgets with first active account per user
    - Make column NOT NULL after backfill
    - Add foreign key constraint: `budgets.account_id` references `accounts.id` with ON DELETE RESTRICT
    - Add index: `budgets_accountId_idx` on `account_id` column
    - Run migration using `npm run db:migrate` or equivalent command
    - Verify migration applied successfully
    - _Bug_Condition: isBugCondition(input) where input.operationType = "CREATE_BUDGET_ALLOCATION"_
    - _Expected_Behavior: Budget must be associated with specific account to enable free cash calculation_
    - _Preservation: Existing budget data preserved, foreign key constraint maintains referential integrity_
    - _Requirements: 2.1, 2.2_

  - [~] 3.2 Update budget schema to include accountId field
    - Edit `db/schema/budget.ts`
    - Add accountId field with foreign key reference: `accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "restrict" })`
    - Add to imports: update line ~12 to include `accounts` from `"./finance"`
    - Add index in indexes array: `index("budgets_accountId_idx").on(table.accountId)`
    - Add relation in budgetsRelations: `account: one(accounts, { fields: [budgets.accountId], references: [accounts.id] })`
    - Regenerate TypeScript types if needed
    - _Bug_Condition: Budget records need account association to calculate free cash_
    - _Expected_Behavior: Schema enforces accountId as required field with foreign key_
    - _Preservation: Existing schema structure maintained, only adds new required field_
    - _Requirements: 2.1, 2.2_

  - [~] 3.3 Implement AccountService.getFreeCash() method
    - Edit `services/account.service.ts`
    - Add import for budgets: update line ~2 to include `budgets` from `"@/db/schema"`
    - Add new static method `getFreeCash(userId: string, accountId: string): Promise<number>` after getAccountBalance (after line ~159)
    - Implementation steps:
      1. Get account and calculate total balance using getAccountBalance
      2. Query sum of active budget allocations: `SELECT sum(amount) FROM budgets WHERE userId = ? AND accountId = ? AND startDate <= NOW() AND endDate >= NOW()`
      3. Calculate: `freeCash = totalBalance - totalAllocated`
      4. Return rounded value: `Math.round(freeCash * 100) / 100`
    - Handle edge cases: account not found (throw error), no active budgets (allocations = 0)
    - _Bug_Condition: System needs to distinguish between total balance and free (unallocated) cash_
    - _Expected_Behavior: expectedBehavior(result) = result >= 0 AND result <= totalBalance AND result = totalBalance - sumActiveAllocations_
    - _Preservation: Does not modify existing balance calculation methods_
    - _Requirements: 2.2, 2.3_

  - [~] 3.4 Update AccountWithBalance interface to include freeCash field
    - Edit `services/account.service.ts`
    - Update AccountWithBalance interface (around line ~7):
      - Add `totalBalance?: number;` // Explicit total balance
      - Add `freeCash?: number;` // Unallocated cash available for spending
    - Update getAccountById method (around line ~109):
      - Calculate freeCash: `const freeCash = await this.getFreeCash(userId, account.id);`
      - Include in return: `{ ...account, currentBalance, totalBalance: currentBalance, freeCash }`
    - Update getAccountsWithBalances method (around line ~59):
      - In loop, calculate freeCash for each account
      - Include in results: `{ ...acc, currentBalance: balance, totalBalance: balance, freeCash }`
    - _Bug_Condition: Account data structure needs to expose free cash alongside total balance_
    - _Expected_Behavior: Interface provides both totalBalance and freeCash fields_
    - _Preservation: Maintains backward compatibility with currentBalance field_
    - _Requirements: 2.3_

  - [~] 3.5 Update BudgetService.createBudget to validate and reduce free cash
    - Edit `services/budget.service.ts`
    - Update function signature (around line ~238): `static async createBudget(userId: string, accountId: string, input: CreateBudgetInput)`
    - Add free cash validation after category validation (after line ~244):
      ```typescript
      const freeCash = await AccountService.getFreeCash(userId, accountId);
      const allocationAmount = parseFloat(input.amount);
      
      if (allocationAmount > freeCash) {
        throw new Error(
          `Saldo free cash tidak mencukupi. Tersedia: ${freeCash}, Dibutuhkan: ${allocationAmount}`
        );
      }
      ```
    - Update database insert (around line ~276): add `accountId` to values object
    - _Bug_Condition: isBugCondition(input) where input.operationType = "CREATE_BUDGET_ALLOCATION"_
    - _Expected_Behavior: Budget creation validates sufficient free cash AND associates budget with account_
    - _Preservation: Budget creation logic preserved except for validation and account association_
    - _Requirements: 1.1, 2.1, 2.2_

  - [~] 3.6 Update budget validation schemas to include accountId
    - Edit `schemas/budget.schema.ts`
    - Add to createMonthlyBudgetSchema (after categoryId, around line ~21): `accountId: z.string().min(1, "accountId diperlukan")`
    - Add to createCustomBudgetSchema (after categoryId, around line ~44): `accountId: z.string().min(1, "accountId diperlukan")`
    - Add to updateBudgetSchema (around line ~68): `accountId: z.string().min(1).optional()`
    - _Bug_Condition: API must accept accountId for budget allocation operations_
    - _Expected_Behavior: Schema validation enforces accountId as required field_
    - _Preservation: Existing validation rules preserved_
    - _Requirements: 2.1_

  - [~] 3.7 Update budget API route to pass accountId to service
    - Edit `app/api/v1/budgets/route.ts`
    - In POST handler, extract accountId from request body
    - Add validation: `if (!accountId) return NextResponse.json({ error: "accountId diperlukan" }, { status: 400 })`
    - Update service call: `await BudgetService.createBudget(session.user.id, accountId, budgetInput)`
    - Handle validation errors (insufficient free cash) and return appropriate error response
    - _Bug_Condition: API endpoint must route accountId to service layer_
    - _Expected_Behavior: API validates and passes accountId for budget creation_
    - _Preservation: Existing API response format and error handling preserved_
    - _Requirements: 2.1_

  - [~] 3.8 Update DashboardService to include freeCash in summary
    - Edit `services/dashboard.service.ts`
    - Add import: `import { AccountService } from "./account.service";`
    - Update DashboardSummary interface (around line ~7): add `freeCash: number;` field with comment "Uang Free (unallocated cash)"
    - In getSummary method, before return statement (around line ~217):
      ```typescript
      let totalFreeCash = 0;
      for (const acc of activeAccounts) {
        const freeCash = await AccountService.getFreeCash(userId, acc.id);
        totalFreeCash += freeCash;
      }
      totalFreeCash = Math.round(totalFreeCash * 100) / 100;
      ```
    - Add to return object: `freeCash: totalFreeCash`
    - Add comment to totalBalance field: "Uang Keseluruhan (total including allocations)"
    - _Bug_Condition: isBugCondition(input) where input.operationType = "VIEW_DASHBOARD"_
    - _Expected_Behavior: expectedBehavior(dashboard) = dashboard has both totalBalance and freeCash fields with totalBalance >= freeCash >= 0_
    - _Preservation: Existing summary fields and calculations preserved_
    - _Requirements: 1.3, 2.3_

  - [~] 3.9 Update Dashboard UI to display both Uang Keseluruhan and Uang Free
    - Edit `app/dashboard/page.tsx` and related dashboard components
    - Create two-column grid displaying:
      - Card 1: "Uang Keseluruhan" with description "Total saldo termasuk alokasi budget" showing summary.totalBalance
      - Card 2: "Uang Free" with description "Saldo yang tersedia untuk dibelanjakan" showing summary.freeCash
    - Add visual indicator: show warning badge if `freeCash < totalBalance * 0.1` with text "Saldo free rendah!"
    - Use existing formatCurrency helper for consistent number formatting
    - Ensure responsive layout works on mobile devices
    - _Bug_Condition: Dashboard view must distinguish total vs free cash_
    - _Expected_Behavior: Dashboard displays both values clearly with appropriate labels_
    - _Preservation: Existing dashboard layout and other components preserved_
    - _Requirements: 2.3_

  - [~] 3.10 Update WhatsApp budget handler to use default account
    - Identify WhatsApp service file(s) handling budget creation commands (likely in `services/` or webhook handler)
    - For budget creation commands (e.g., "budget makan 600k"):
      - Query user's accounts: `const accounts = await AccountService.getAccounts(userId)`
      - If no accounts exist: return error message "Anda belum memiliki akun. Silakan buat akun terlebih dahulu."
      - Select default account: `const defaultAccount = accounts.find(a => a.isActive) || accounts[0]`
      - Pass accountId to budget creation: `await BudgetService.createBudget(userId, defaultAccount.id, budgetInput)`
    - Handle insufficient free cash error and return user-friendly message
    - _Bug_Condition: WhatsApp integration must provide accountId for budget operations_
    - _Expected_Behavior: WhatsApp handler selects appropriate account for budget allocation_
    - _Preservation: Existing WhatsApp command parsing and response logic preserved_
    - _Requirements: 2.1, 3.7_

  - [~] 3.11 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Budget Allocation Reduces Free Cash
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify all assertions pass:
      - AccountService.getFreeCash exists and works
      - Creating budget of 500k from 2M balance results in freeCash = 1,500,000
      - Creating multiple budgets (1,850k total) from 2M balance results in freeCash = 150,000
      - Dashboard returns both totalBalance and freeCash fields
      - freeCash = totalBalance - sumActiveAllocations
    - Document that counterexamples are now resolved
    - _Requirements: 2.1, 2.2, 2.3 (Expected Behavior Properties)_

  - [~] 3.12 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Budget Operations Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Verify all properties still hold:
      - Income transactions increase balance correctly
      - Transfers move money between accounts atomically
      - Transaction history queries return complete results
      - Expense transactions (without budget) decrease balance correctly
      - Multi-account operations maintain separate balances
    - Confirm all tests still pass after fix (no regressions)
    - Document that preservation is maintained
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [~] 4. Checkpoint - Ensure all tests pass
  - Run complete test suite (unit + integration + property-based tests)
  - Verify all exploration tests pass (bug is fixed)
  - Verify all preservation tests pass (no regressions)
  - Verify integration tests pass (full flow works end-to-end)
  - Review any failing tests and address issues
  - If any questions arise or edge cases discovered, ask user for clarification
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
      "description": "Database schema changes and migration"
    },
    {
      "wave": 3,
      "tasks": ["3.3", "3.4"],
      "description": "Core service layer implementation (free cash calculation)"
    },
    {
      "wave": 4,
      "tasks": ["3.5", "3.6", "3.7"],
      "description": "Budget creation validation and API updates"
    },
    {
      "wave": 5,
      "tasks": ["3.8", "3.9"],
      "description": "Dashboard service and UI updates"
    },
    {
      "wave": 6,
      "tasks": ["3.10"],
      "description": "WhatsApp integration updates"
    },
    {
      "wave": 7,
      "tasks": ["3.11", "3.12"],
      "description": "Test verification (run on fixed code)"
    },
    {
      "wave": 8,
      "tasks": ["4"],
      "description": "Final checkpoint and validation"
    }
  ]
}
```

**Wave Explanation:**
- **Wave 1**: Independent exploration and preservation tests must be written and run on unfixed code first
- **Wave 2**: Database schema changes are foundational - must be completed before service layer changes
- **Wave 3**: Core service implementation depends on schema changes being complete
- **Wave 4**: Budget validation and API changes depend on service layer methods being available
- **Wave 5**: Dashboard updates depend on service layer providing free cash data
- **Wave 6**: WhatsApp integration updates depend on API and service changes
- **Wave 7**: Test verification depends on all implementation being complete
- **Wave 8**: Final checkpoint depends on all tests passing

---

## Notes

- **Property-Based Tests**: Tasks 1 and 2 use property-based testing to provide stronger guarantees. The `**Property N:**` format enables hover status tracking in the UI.
- **Exploration-First**: Task 1 MUST be run on unfixed code to confirm the bug exists before implementing the fix.
- **Observation-First**: Task 2 MUST observe behavior on unfixed code before writing preservation tests.
- **Derived Calculation Approach**: This fix uses a derived calculation approach (no new database columns for free cash) to maintain consistency with existing balance calculation patterns.
- **Migration Required**: Task 3.1 requires running a database migration. Ensure database backup before running migration in production.
- **WhatsApp Integration**: Task 3.10 assumes WhatsApp handlers exist. Skip if not applicable to your deployment.

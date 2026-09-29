-- Migration: Add accountId column to budgets table (nullable initially for safe migration)
-- This enables budget allocations to be associated with specific accounts
-- Required for free cash calculation (total balance - budget allocations per account)

-- Step 1: Add account_id column (nullable to allow safe migration)
ALTER TABLE budgets 
ADD COLUMN account_id TEXT;

-- Step 2: Add foreign key constraint
ALTER TABLE budgets 
ADD CONSTRAINT budgets_account_id_fkey 
FOREIGN KEY (account_id) 
REFERENCES accounts(id) 
ON DELETE RESTRICT;

-- Step 3: Add indexes for performance
CREATE INDEX budgets_accountId_idx ON budgets(account_id);
CREATE INDEX budgets_userId_accountId_dates_idx ON budgets(user_id, account_id, start_date, end_date);

-- Note: accountId is left nullable to support existing budgets
-- The application layer will ensure all NEW budgets have accountId
-- Existing budgets can be migrated manually or will work in a degraded mode

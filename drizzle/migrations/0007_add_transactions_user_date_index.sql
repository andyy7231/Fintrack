-- Migration: Add composite index for efficient user + date range queries
-- Task: transaction-period-filter / Task 7.1
-- Purpose: Optimize getTransactionsWithSummary queries that filter by user_id and date range

-- Create composite index on (user_id, transaction_date) for efficient date filtering
-- This index supports queries like:
-- WHERE user_id = ? AND transaction_date >= ? AND transaction_date <= ?
CREATE INDEX IF NOT EXISTS "idx_transactions_user_date" ON "transactions" ("user_id", "transaction_date");

-- Note: Column order matters for index efficiency
-- user_id first because it's always used in WHERE clause (high selectivity)
-- transaction_date second for range scans within user's transactions

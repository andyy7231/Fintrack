import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { categories, accounts } from "./finance";

/**
 * Budgets Table (Phase 6)
 *
 * One budget = one user + one EXPENSE category + one period + one amount limit.
 *
 * Period types:
 *   MONTHLY – one calendar month in Asia/Jakarta timezone
 *   CUSTOM  – arbitrary [startDate, endDate] range
 *
 * start_date / end_date store the Jakarta-local date boundaries represented as
 * UTC timestamps (i.e. the UTC instant that corresponds to midnight Jakarta).
 * When comparing against `transaction_date` (stored as UTC), we apply the same
 * +7-hour offset semantics that the rest of the codebase uses.
 *
 * actual `spentAmount` is NEVER stored here — it is always aggregated live from
 * the transactions table so that edits/deletions are automatically reflected.
 */
export const budgets = pgTable(
  "budgets",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    accountId: text("account_id")
      .references(() => accounts.id, { onDelete: "restrict" }),

    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),

    /** 'MONTHLY' | 'CUSTOM' */
    periodType: text("period_type").notNull(),

    /**
     * Inclusive start of the budget period (UTC value representing Jakarta midnight).
     * For MONTHLY budgets this is the first day of the month at 00:00 Jakarta.
     */
    startDate: timestamp("start_date").notNull(),

    /**
     * Exclusive end of the budget period (UTC value representing Jakarta midnight of
     * the NEXT day after the last day of the period).  Using an exclusive upper bound
     * avoids the 23:59:59.999 edge case.
     */
    endDate: timestamp("end_date").notNull(),

    /** Budget limit (NUMERIC to avoid floating point). Must be > 0. */
    amount: numeric("amount", { precision: 19, scale: 2 }).notNull(),

    /** Currency code. Defaults to IDR; no conversion implemented in Phase 6. */
    currency: text("currency").default("IDR").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("budgets_userId_idx").on(table.userId),
    index("budgets_accountId_idx").on(table.accountId),
    index("budgets_categoryId_idx").on(table.categoryId),
    index("budgets_startDate_idx").on(table.startDate),
    index("budgets_endDate_idx").on(table.endDate),
    index("budgets_userId_category_period_idx").on(
      table.userId,
      table.categoryId,
      table.startDate,
      table.endDate
    ),
    index("budgets_userId_accountId_dates_idx").on(
      table.userId,
      table.accountId,
      table.startDate,
      table.endDate
    ),
  ]
);

// ─── Relations ─────────────────────────────────────────────────────────────────

export const budgetsRelations = relations(budgets, ({ one }) => ({
  user: one(user, {
    fields: [budgets.userId],
    references: [user.id],
  }),
  account: one(accounts, {
    fields: [budgets.accountId],
    references: [accounts.id],
  }),
  category: one(categories, {
    fields: [budgets.categoryId],
    references: [categories.id],
  }),
}));

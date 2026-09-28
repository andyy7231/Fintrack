import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { transactions } from "./finance";

/**
 * Financial Goals Table (Phase 7)
 *
 * Stores user financial planning targets (e.g. Umrah, Dana Darurat, etc.).
 * Status: 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'ARCHIVED'
 * Target amount is stored as NUMERIC(19, 2).
 * current_balance is NEVER stored here — progress is always dynamically
 * aggregated from goal_contributions to prevent state drift.
 */
export const financialGoals = pgTable(
  "financial_goals",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    description: text("description"),

    /** Target nominal (NUMERIC(19, 2)). Must be > 0. */
    targetAmount: numeric("target_amount", { precision: 19, scale: 2 }).notNull(),

    /** Target business date in Asia/Jakarta */
    targetDate: timestamp("target_date").notNull(),

    currency: text("currency").default("IDR").notNull(),

    /** Status: 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'ARCHIVED' */
    status: text("status").default("ACTIVE").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("financial_goals_userId_idx").on(table.userId),
    index("financial_goals_status_idx").on(table.status),
    index("financial_goals_userId_status_idx").on(table.userId, table.status),
    index("financial_goals_userId_targetDate_idx").on(table.userId, table.targetDate),
  ]
);

/**
 * Goal Contributions Table (Phase 7)
 *
 * Explicit fund allocations toward a financial goal.
 * Does NOT alter account balances, does NOT create transactions, does NOT create new money.
 * Optionally links to an existing transaction via transaction_id.
 */
export const goalContributions = pgTable(
  "goal_contributions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    goalId: text("goal_id")
      .notNull()
      .references(() => financialGoals.id, { onDelete: "cascade" }),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    transactionId: text("transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),

    /** Contribution amount (NUMERIC(19, 2)). Must be > 0. */
    amount: numeric("amount", { precision: 19, scale: 2 }).notNull(),

    /** Date of contribution (Asia/Jakarta calendar date) */
    contributionDate: timestamp("contribution_date").notNull(),

    description: text("description"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("goal_contributions_goalId_idx").on(table.goalId),
    index("goal_contributions_userId_idx").on(table.userId),
    index("goal_contributions_transactionId_idx").on(table.transactionId),
    index("goal_contributions_date_idx").on(table.contributionDate),
  ]
);

// ─── Relations ─────────────────────────────────────────────────────────────────

export const financialGoalsRelations = relations(financialGoals, ({ one, many }) => ({
  user: one(user, {
    fields: [financialGoals.userId],
    references: [user.id],
  }),
  contributions: many(goalContributions),
}));

export const goalContributionsRelations = relations(goalContributions, ({ one }) => ({
  goal: one(financialGoals, {
    fields: [goalContributions.goalId],
    references: [financialGoals.id],
  }),
  user: one(user, {
    fields: [goalContributions.userId],
    references: [user.id],
  }),
  transaction: one(transactions, {
    fields: [goalContributions.transactionId],
    references: [transactions.id],
  }),
}));

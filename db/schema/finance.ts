import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Financial Accounts Table
 * Represents user's wallets, bank accounts, cash, etc.
 */
export const accounts = pgTable(
  "accounts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(), // 'CASH' | 'BANK' | 'E_WALLET' | 'OTHER'
    initialBalance: numeric("initial_balance", { precision: 19, scale: 2 })
      .default("0.00")
      .notNull(),
    currency: text("currency").default("IDR").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("accounts_userId_idx").on(table.userId),
    index("accounts_isActive_idx").on(table.isActive),
  ]
);

/**
 * Transaction Categories Table
 * Includes both system default categories (userId = NULL)
 * and custom user-created categories (userId = authenticated user ID).
 */
export const categories = pgTable(
  "categories",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }), // null for system defaults
    name: text("name").notNull(),
    type: text("type").notNull(), // 'INCOME' | 'EXPENSE'
    icon: text("icon"),
    color: text("color"),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("categories_userId_idx").on(table.userId),
    index("categories_type_idx").on(table.type),
  ]
);

/**
 * Transactions Table
 * Stores Income and Expense records.
 * Transfers are NOT stored here — they have their own dedicated table.
 */
export const transactions = pgTable(
  "transactions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull(), // 'INCOME' | 'EXPENSE'
    amount: numeric("amount", { precision: 19, scale: 2 }).notNull(),
    description: text("description").notNull(),
    transactionDate: timestamp("transaction_date").notNull(),
    source: text("source").default("WEB").notNull(), // 'WEB' | 'WHATSAPP' | 'SYSTEM'
    status: text("status").default("CONFIRMED").notNull(), // 'CONFIRMED' | 'PENDING' | 'CANCELLED'
    externalMessageId: text("external_message_id").unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("transactions_userId_idx").on(table.userId),
    index("transactions_date_idx").on(table.transactionDate),
    index("transactions_accountId_idx").on(table.accountId),
    index("transactions_categoryId_idx").on(table.categoryId),
    index("transactions_type_idx").on(table.type),
  ]
);

/**
 * Transfers Table
 * Atomic balance movements between accounts of the same user.
 * Transfers do NOT count as income or expense.
 */
export const transfers = pgTable(
  "transfers",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    fromAccountId: text("from_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    toAccountId: text("to_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 19, scale: 2 }).notNull(),
    description: text("description"),
    transferDate: timestamp("transfer_date").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("transfers_userId_idx").on(table.userId),
    index("transfers_date_idx").on(table.transferDate),
    index("transfers_fromAccount_idx").on(table.fromAccountId),
    index("transfers_toAccount_idx").on(table.toAccountId),
  ]
);

// ============================================
// RELATIONS
// ============================================

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(user, {
    fields: [accounts.userId],
    references: [user.id],
  }),
  transactions: many(transactions),
  outgoingTransfers: many(transfers, { relationName: "fromAccount" }),
  incomingTransfers: many(transfers, { relationName: "toAccount" }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(user, {
    fields: [categories.userId],
    references: [user.id],
  }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(user, {
    fields: [transactions.userId],
    references: [user.id],
  }),
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
}));

export const transfersRelations = relations(transfers, ({ one }) => ({
  user: one(user, {
    fields: [transfers.userId],
    references: [user.id],
  }),
  fromAccount: one(accounts, {
    fields: [transfers.fromAccountId],
    references: [accounts.id],
    relationName: "fromAccount",
  }),
  toAccount: one(accounts, {
    fields: [transfers.toAccountId],
    references: [accounts.id],
    relationName: "toAccount",
  }),
}));

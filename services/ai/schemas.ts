import { z } from "zod";

/**
 * Phase 5.1 / 5.2 — Financial Intent Zod Schemas (Multi-Action Batch Support)
 *
 * Phase 5.1: EXPENSE | INCOME | TRANSFER in batch
 * Phase 5.2: BUDGET_ALLOCATION | BALANCE_QUERY added
 */

// ─────────────────────────────────────────────────────────────
// Single-action intent schemas
// ─────────────────────────────────────────────────────────────

export const expenseIntentSchema = z.object({
  intent: z.literal("EXPENSE"),
  amount: z
    .number()
    .positive("Nominal harus lebih besar dari 0")
    .finite("Nominal harus berupa angka valid"),
  description: z
    .string()
    .trim()
    .min(1, "Deskripsi pengeluaran tidak boleh kosong"),
  transactionDate: z.string().optional(), // ISO date string YYYY-MM-DD
  accountHint: z.string().trim().nullable().optional(),
  categoryHint: z.string().trim().nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const incomeIntentSchema = z.object({
  intent: z.literal("INCOME"),
  amount: z
    .number()
    .positive("Nominal harus lebih besar dari 0")
    .finite("Nominal harus berupa angka valid"),
  description: z
    .string()
    .trim()
    .min(1, "Deskripsi pemasukan tidak boleh kosong"),
  transactionDate: z.string().optional(),
  accountHint: z.string().trim().nullable().optional(),
  categoryHint: z.string().trim().nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const transferIntentSchema = z.object({
  intent: z.literal("TRANSFER"),
  amount: z
    .number()
    .positive("Nominal harus lebih besar dari 0")
    .finite("Nominal harus berupa angka valid"),
  description: z.string().trim().nullable().optional(),
  transferDate: z.string().optional(),
  fromAccountHint: z.string().trim().nullable().optional(),
  toAccountHint: z.string().trim().nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const unknownIntentSchema = z.object({
  intent: z.literal("UNKNOWN"),
  reason: z.string(),
  clarificationQuestion: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────
// Phase 5.2: BUDGET_ALLOCATION intent
//
// AI provides only semantic information (categoryName, amount).
// Server is responsible for resolving categoryName → categoryId.
// AI MUST NOT provide categoryId.
// ─────────────────────────────────────────────────────────────

export const budgetAllocationIntentSchema = z.object({
  intent: z.literal("BUDGET_ALLOCATION"),
  amount: z
    .number()
    .positive("Nominal budget harus lebih besar dari 0")
    .finite("Nominal harus berupa angka valid"),
  /**
   * Free-text category name from AI — server resolves this to a
   * real user-scoped EXPENSE category ID. Never trust a categoryId from AI.
   */
  categoryName: z.string().trim().min(1, "Nama kategori budget tidak boleh kosong"),
  confidence: z.number().min(0).max(1).optional(),
});

// ─────────────────────────────────────────────────────────────
// Phase 5.2: BALANCE_QUERY intent
//
// Read-only intent. No mutation. No pending action. No confirmation.
// AI only signals "user wants to know their balance."
// Optional accountHint for account-specific queries.
// ─────────────────────────────────────────────────────────────

export const balanceQueryIntentSchema = z.object({
  intent: z.literal("BALANCE_QUERY"),
  /** If the user asked about a specific account, AI provides its name hint */
  accountHint: z.string().trim().nullable().optional(),
});

// ─────────────────────────────────────────────────────────────
// Discriminated union of all single-action intent types
// ─────────────────────────────────────────────────────────────

export const financialIntentSchema = z.discriminatedUnion("intent", [
  expenseIntentSchema,
  incomeIntentSchema,
  transferIntentSchema,
  unknownIntentSchema,
  budgetAllocationIntentSchema,
  balanceQueryIntentSchema,
]);

// ─────────────────────────────────────────────────────────────
// Phase 5.1+5.2: Batch schema — array of single-action intents
// ─────────────────────────────────────────────────────────────

export const financialBatchSchema = z.object({
  actions: z
    .array(financialIntentSchema)
    .min(1, "At least one action required")
    .max(15, "Maximum 15 actions per message"),
});

// ─────────────────────────────────────────────────────────────
// TypeScript type exports
// ─────────────────────────────────────────────────────────────

export type ExpenseIntent = z.infer<typeof expenseIntentSchema>;
export type IncomeIntent = z.infer<typeof incomeIntentSchema>;
export type TransferIntent = z.infer<typeof transferIntentSchema>;
export type UnknownIntent = z.infer<typeof unknownIntentSchema>;
export type BudgetAllocationIntent = z.infer<typeof budgetAllocationIntentSchema>;
export type BalanceQueryIntent = z.infer<typeof balanceQueryIntentSchema>;
export type ParsedFinancialIntent = z.infer<typeof financialIntentSchema>;
export type ParsedFinancialBatch = z.infer<typeof financialBatchSchema>;

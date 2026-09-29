import { z } from "zod";

/**
 * Phase 5.1 — Financial Intent Zod Schemas (Multi-Action Batch Support)
 *
 * Strict validation models ensuring AI-extracted financial intents never
 * bypass application safety or inject invalid values into the financial core.
 *
 * Key change in 5.1: The AI provider now returns an ARRAY of intents,
 * allowing a single WhatsApp message to trigger multiple atomic actions.
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

// A single financial action intent (used per-item in batch)
export const financialIntentSchema = z.discriminatedUnion("intent", [
  expenseIntentSchema,
  incomeIntentSchema,
  transferIntentSchema,
  unknownIntentSchema,
]);

// ─────────────────────────────────────────────────────────────
// Phase 5.1: Batch schema — array of single-action intents
// ─────────────────────────────────────────────────────────────

/**
 * The AI provider always returns a batch (array), even when there is only
 * one action. This eliminates the single-vs-multi ambiguity at the source.
 *
 * Constraints:
 * - Min 1 item, max 10 items per message.
 * - Items are ordered as they appear in the original message.
 * - If the entire message is unclear, the array contains one UNKNOWN item.
 */
export const financialBatchSchema = z.object({
  actions: z
    .array(financialIntentSchema)
    .min(1, "At least one action required")
    .max(10, "Maximum 10 actions per message"),
});

// ─────────────────────────────────────────────────────────────
// TypeScript type exports
// ─────────────────────────────────────────────────────────────

export type ExpenseIntent = z.infer<typeof expenseIntentSchema>;
export type IncomeIntent = z.infer<typeof incomeIntentSchema>;
export type TransferIntent = z.infer<typeof transferIntentSchema>;
export type UnknownIntent = z.infer<typeof unknownIntentSchema>;
export type ParsedFinancialIntent = z.infer<typeof financialIntentSchema>;
export type ParsedFinancialBatch = z.infer<typeof financialBatchSchema>;

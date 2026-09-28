import { z } from "zod";

/**
 * Phase 5 — Financial Intent Zod Schemas
 *
 * Strict validation models ensuring AI-extracted financial intents never
 * bypass application safety or inject invalid values into the financial core.
 */

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

export const financialIntentSchema = z.discriminatedUnion("intent", [
  expenseIntentSchema,
  incomeIntentSchema,
  transferIntentSchema,
  unknownIntentSchema,
]);

export type ExpenseIntent = z.infer<typeof expenseIntentSchema>;
export type IncomeIntent = z.infer<typeof incomeIntentSchema>;
export type TransferIntent = z.infer<typeof transferIntentSchema>;
export type UnknownIntent = z.infer<typeof unknownIntentSchema>;
export type ParsedFinancialIntent = z.infer<typeof financialIntentSchema>;

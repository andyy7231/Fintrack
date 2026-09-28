import { z } from "zod";

// ─── Period type ───────────────────────────────────────────────────────────────

export const periodTypeSchema = z.enum(["MONTHLY", "CUSTOM"]);

export type PeriodType = z.infer<typeof periodTypeSchema>;

// ─── Create budget ─────────────────────────────────────────────────────────────

/**
 * Schema for creating a MONTHLY budget.
 * `year` and `month` (1-indexed) define the calendar month in Asia/Jakarta.
 */
export const createMonthlyBudgetSchema = z.object({
  periodType: z.literal("MONTHLY"),
  categoryId: z.string().min(1, "categoryId diperlukan"),
  /** Budget limit amount — must be positive */
  amount: z
    .string()
    .or(z.number())
    .transform((v) => String(v))
    .refine((v) => parseFloat(v) > 0, {
      message: "Nominal budget harus lebih dari 0",
    }),
  currency: z.string().default("IDR"),
  /** 4-digit year in Jakarta timezone */
  year: z.number().int().min(2000).max(2100),
  /** 1-indexed month (1 = January … 12 = December) */
  month: z.number().int().min(1).max(12),
});

/**
 * Schema for creating a CUSTOM budget.
 * `startDate` and `endDate` must be ISO-8601 date strings (YYYY-MM-DD) or
 * parseable Date values. Internally they are treated as Jakarta local dates.
 */
export const createCustomBudgetSchema = z
  .object({
    periodType: z.literal("CUSTOM"),
    categoryId: z.string().min(1, "categoryId diperlukan"),
    amount: z
      .string()
      .or(z.number())
      .transform((v) => String(v))
      .refine((v) => parseFloat(v) > 0, {
        message: "Nominal budget harus lebih dari 0",
      }),
    currency: z.string().default("IDR"),
    /** Jakarta-local start date string e.g. "2026-09-01" */
    startDate: z.string().date("startDate harus format YYYY-MM-DD"),
    /** Jakarta-local end date string e.g. "2026-09-30" */
    endDate: z.string().date("endDate harus format YYYY-MM-DD"),
  })
  .refine((d) => d.startDate <= d.endDate, {
    message: "startDate harus sebelum atau sama dengan endDate",
    path: ["startDate"],
  });

export const createBudgetSchema = z.discriminatedUnion("periodType", [
  createMonthlyBudgetSchema,
  createCustomBudgetSchema,
]);

export type CreateMonthlyBudgetInput = z.infer<typeof createMonthlyBudgetSchema>;
export type CreateCustomBudgetInput = z.infer<typeof createCustomBudgetSchema>;
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;

// ─── Update budget ─────────────────────────────────────────────────────────────

/**
 * All fields optional. The service re-validates period/overlap constraints after
 * applying partial changes.
 */
export const updateBudgetSchema = z
  .object({
    categoryId: z.string().min(1).optional(),
    amount: z
      .string()
      .or(z.number())
      .transform((v) => String(v))
      .refine((v) => parseFloat(v) > 0, {
        message: "Nominal budget harus lebih dari 0",
      })
      .optional(),
    currency: z.string().optional(),
    periodType: periodTypeSchema.optional(),
    /** Only used when updating to / within MONTHLY period */
    year: z.number().int().min(2000).max(2100).optional(),
    month: z.number().int().min(1).max(12).optional(),
    /** Only used when updating to / within CUSTOM period */
    startDate: z.string().date().optional(),
    endDate: z.string().date().optional(),
  })
  .refine(
    (d) => {
      if (d.startDate && d.endDate) return d.startDate <= d.endDate;
      return true;
    },
    {
      message: "startDate harus sebelum atau sama dengan endDate",
      path: ["startDate"],
    }
  );

export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;

import { z } from "zod";

// ─── Goal Status ───────────────────────────────────────────────────────────────

export const goalStatusSchema = z.enum(["ACTIVE", "COMPLETED", "PAUSED", "ARCHIVED"]);
export type GoalStatus = z.infer<typeof goalStatusSchema>;

// ─── Create Goal ───────────────────────────────────────────────────────────────

export const createGoalSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama goal tidak boleh kosong")
    .max(100, "Nama goal maksimal 100 karakter"),
  description: z.string().trim().max(500, "Deskripsi maksimal 500 karakter").optional().nullable(),
  targetAmount: z
    .string()
    .or(z.number())
    .transform((v) => String(v))
    .refine(
      (v) => {
        const num = parseFloat(v);
        return !isNaN(num) && num > 0;
      },
      {
        message: "Target nominal harus lebih dari 0",
      }
    ),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Target date harus berformat YYYY-MM-DD")
    .refine(
      (val) => {
        const d = new Date(val + "T00:00:00Z");
        return !isNaN(d.getTime());
      },
      { message: "Target date tidak valid" }
    ),
  currency: z.string().trim().min(1, "Currency tidak boleh kosong").default("IDR"),
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;

// ─── Update Goal ───────────────────────────────────────────────────────────────

export const updateGoalSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama goal tidak boleh kosong")
    .max(100, "Nama goal maksimal 100 karakter")
    .optional(),
  description: z.string().trim().max(500, "Deskripsi maksimal 500 karakter").optional().nullable(),
  targetAmount: z
    .string()
    .or(z.number())
    .transform((v) => String(v))
    .refine(
      (v) => {
        const num = parseFloat(v);
        return !isNaN(num) && num > 0;
      },
      {
        message: "Target nominal harus lebih dari 0",
      }
    )
    .optional(),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Target date harus berformat YYYY-MM-DD")
    .refine(
      (val) => {
        const d = new Date(val + "T00:00:00Z");
        return !isNaN(d.getTime());
      },
      { message: "Target date tidak valid" }
    )
    .optional(),
  currency: z.string().trim().min(1).optional(),
  status: goalStatusSchema.optional(),
});

export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;

// ─── Create Goal Contribution ──────────────────────────────────────────────────

export const createContributionSchema = z.object({
  amount: z
    .string()
    .or(z.number())
    .transform((v) => String(v))
    .refine(
      (v) => {
        const num = parseFloat(v);
        return !isNaN(num) && num > 0;
      },
      {
        message: "Nominal kontribusi harus lebih dari 0",
      }
    ),
  contributionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal kontribusi harus berformat YYYY-MM-DD")
    .refine(
      (val) => {
        const d = new Date(val + "T00:00:00Z");
        return !isNaN(d.getTime());
      },
      { message: "Tanggal kontribusi tidak valid" }
    )
    .optional(),
  description: z.string().trim().max(500, "Deskripsi maksimal 500 karakter").optional().nullable(),
  transactionId: z.string().trim().min(1).optional().nullable(),
});

export type CreateContributionInput = z.infer<typeof createContributionSchema>;

// ─── Update Goal Contribution ──────────────────────────────────────────────────

export const updateContributionSchema = z.object({
  amount: z
    .string()
    .or(z.number())
    .transform((v) => String(v))
    .refine(
      (v) => {
        const num = parseFloat(v);
        return !isNaN(num) && num > 0;
      },
      {
        message: "Nominal kontribusi harus lebih dari 0",
      }
    )
    .optional(),
  contributionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal kontribusi harus berformat YYYY-MM-DD")
    .refine(
      (val) => {
        const d = new Date(val + "T00:00:00Z");
        return !isNaN(d.getTime());
      },
      { message: "Tanggal kontribusi tidak valid" }
    )
    .optional(),
  description: z.string().trim().max(500, "Deskripsi maksimal 500 karakter").optional().nullable(),
  transactionId: z.string().trim().min(1).optional().nullable(),
});

export type UpdateContributionInput = z.infer<typeof updateContributionSchema>;

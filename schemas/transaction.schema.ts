import { z } from "zod";

export const TRANSACTION_TYPES = ["INCOME", "EXPENSE"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_SOURCES = ["WEB", "WHATSAPP", "SYSTEM"] as const;
export type TransactionSource = (typeof TRANSACTION_SOURCES)[number];

export const createTransactionSchema = z.object({
  accountId: z.string().min(1, "Akun wajib dipilih"),
  categoryId: z.string().optional().nullable(),
  type: z.enum(TRANSACTION_TYPES, {
    message: "Tipe transaksi harus INCOME atau EXPENSE",
  }),
  amount: z
    .union([z.string(), z.number()])
    .transform((val) => {
      const num = typeof val === "string" ? parseFloat(val.replace(/[^0-9.-]+/g, "")) : val;
      return num;
    })
    .refine((val) => !isNaN(val) && val > 0, {
      message: "Nominal transaksi harus lebih besar dari 0",
    })
    .transform((val) => val.toFixed(2)),
  description: z
    .string()
    .trim()
    .min(1, "Deskripsi transaksi wajib diisi")
    .max(255, "Deskripsi maksimal 255 karakter"),
  transactionDate: z
    .union([z.string(), z.date()])
    .transform((val) => (typeof val === "string" ? new Date(val) : val))
    .refine((val) => !isNaN(val.getTime()), {
      message: "Format tanggal tidak valid",
    }),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const updateTransactionSchema = z.object({
  accountId: z.string().min(1).optional(),
  categoryId: z.string().optional().nullable(),
  type: z.enum(TRANSACTION_TYPES).optional(),
  amount: z
    .union([z.string(), z.number()])
    .transform((val) => {
      const num = typeof val === "string" ? parseFloat(val.replace(/[^0-9.-]+/g, "")) : val;
      return num;
    })
    .refine((val) => !isNaN(val) && val > 0, {
      message: "Nominal transaksi harus lebih besar dari 0",
    })
    .transform((val) => val.toFixed(2))
    .optional(),
  description: z.string().trim().min(1).max(255).optional(),
  transactionDate: z
    .union([z.string(), z.date()])
    .transform((val) => (typeof val === "string" ? new Date(val) : val))
    .refine((val) => !isNaN(val.getTime()), {
      message: "Format tanggal tidak valid",
    })
    .optional(),
});

export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

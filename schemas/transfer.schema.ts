import { z } from "zod";

export const createTransferSchema = z
  .object({
    fromAccountId: z.string().min(1, "Akun asal wajib dipilih"),
    toAccountId: z.string().min(1, "Akun tujuan wajib dipilih"),
    amount: z
      .union([z.string(), z.number()])
      .transform((val) => {
        const num = typeof val === "string" ? parseFloat(val.replace(/[^0-9.-]+/g, "")) : val;
        return num;
      })
      .refine((val) => !isNaN(val) && val > 0, {
        message: "Nominal transfer harus lebih besar dari 0",
      })
      .transform((val) => val.toFixed(2)),
    description: z.string().trim().max(255).optional(),
    transferDate: z
      .union([z.string(), z.date()])
      .transform((val) => (typeof val === "string" ? new Date(val) : val))
      .refine((val) => !isNaN(val.getTime()), {
        message: "Format tanggal tidak valid",
      }),
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    message: "Akun asal dan akun tujuan transfer tidak boleh sama",
    path: ["toAccountId"],
  });

export type CreateTransferInput = z.infer<typeof createTransferSchema>;

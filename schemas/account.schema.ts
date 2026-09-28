import { z } from "zod";

export const ACCOUNT_TYPES = ["CASH", "BANK", "E_WALLET", "OTHER"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const createAccountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama akun wajib diisi")
    .max(100, "Nama akun maksimal 100 karakter"),
  type: z.enum(ACCOUNT_TYPES, {
    message: "Tipe akun harus berupa CASH, BANK, E_WALLET, atau OTHER",
  }),
  initialBalance: z
    .union([z.string(), z.number()])
    .transform((val) => {
      const num = typeof val === "string" ? parseFloat(val.replace(/[^0-9.-]+/g, "")) : val;
      return isNaN(num) ? 0 : Math.max(0, num);
    })
    .refine((val) => val >= 0, {
      message: "Saldo awal tidak boleh negatif",
    })
    .transform((val) => val.toFixed(2)),
  currency: z.string().trim().default("IDR"),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = z.object({
  name: z.string().trim().min(1, "Nama akun wajib diisi").max(100).optional(),
  type: z.enum(ACCOUNT_TYPES).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

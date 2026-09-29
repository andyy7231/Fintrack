import { z } from "zod";

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Nama minimal harus 2 karakter")
      .max(100, "Nama maksimal 100 karakter"),
    phoneNumber: z
      .string()
      .trim()
      .min(10, "Nomor WhatsApp minimal 10 digit")
      .max(16, "Nomor WhatsApp maksimal 16 digit")
      .regex(
        /^(\+?62|0)8[0-9]{8,12}$/,
        "Format nomor tidak valid. Contoh: 08xx atau +628xx"
      ),
    password: z
      .string()
      .min(8, "Password minimal 8 karakter")
      .max(100, "Password maksimal 100 karakter"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Konfirmasi password tidak cocok",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(3, "Nomor WhatsApp atau email wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
});

export type LoginInput = z.infer<typeof loginSchema>;

import { z } from "zod";

export const CATEGORY_TYPES = ["INCOME", "EXPENSE"] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama kategori wajib diisi")
    .max(50, "Nama kategori maksimal 50 karakter"),
  type: z.enum(CATEGORY_TYPES, {
    message: "Tipe kategori harus berupa INCOME atau EXPENSE",
  }),
  icon: z.string().trim().max(50).optional(),
  color: z.string().trim().max(20).optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  icon: z.string().trim().max(50).optional(),
  color: z.string().trim().max(20).optional(),
});

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

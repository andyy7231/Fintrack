import { z } from "zod";

export const reportPresetSchema = z.enum([
  "this_month",
  "last_month",
  "last_3_months",
  "last_6_months",
  "this_year",
  "last_year",
  "custom",
]);

export type ReportPreset = z.infer<typeof reportPresetSchema>;

export const reportFilterSchema = z
  .object({
    preset: reportPresetSchema.optional().default("this_month"),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate harus format YYYY-MM-DD")
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "endDate harus format YYYY-MM-DD")
      .optional(),
    accountId: z.string().trim().min(1).optional(),
    categoryId: z.string().trim().min(1).optional(),
    type: z.enum(["INCOME", "EXPENSE"]).optional(),
  })
  .refine(
    (data) => {
      if (data.preset === "custom") {
        return !!data.startDate && !!data.endDate;
      }
      return true;
    },
    {
      message: "startDate dan endDate wajib diisi jika preset custom",
      path: ["startDate"],
    }
  )
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.startDate <= data.endDate;
      }
      return true;
    },
    {
      message: "startDate tidak boleh lebih besar dari endDate",
      path: ["startDate"],
    }
  );

export type ReportFilterInput = z.infer<typeof reportFilterSchema>;

export const exportQuerySchema = reportFilterSchema.and(
  z.object({
    format: z.enum(["csv", "xlsx"]),
  })
);

export type ExportQueryInput = z.infer<typeof exportQuerySchema>;

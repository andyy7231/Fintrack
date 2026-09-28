import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { ReportService } from "@/services/report.service";
import { reportFilterSchema } from "@/schemas/report.schema";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  try {
    const url = new URL(req.url);
    const rawParams = {
      preset: url.searchParams.get("preset") || undefined,
      startDate: url.searchParams.get("startDate") || undefined,
      endDate: url.searchParams.get("endDate") || undefined,
      accountId: url.searchParams.get("accountId") || undefined,
      categoryId: url.searchParams.get("categoryId") || undefined,
      type: url.searchParams.get("type") || undefined,
    };

    const validation = reportFilterSchema.safeParse(rawParams);
    if (!validation.success) {
      return apiError(
        ErrorCodes.VALIDATION_ERROR,
        validation.error.issues[0]?.message || "Parameter filter laporan tidak valid",
        400
      );
    }

    const report = await ReportService.getFinancialReport(user.id, validation.data);
    return apiSuccess(report);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat laporan keuangan";
    if (message.includes("tidak ditemukan atau bukan milik Anda")) {
      return apiError(ErrorCodes.FORBIDDEN, message, 403);
    }
    return apiError(ErrorCodes.INVALID_INPUT, message, 400);
  }
}

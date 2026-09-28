import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { ReportService } from "@/services/report.service";
import { exportQuerySchema } from "@/schemas/report.schema";
import { apiError, ErrorCodes } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  try {
    const url = new URL(req.url);
    const rawParams = {
      format: url.searchParams.get("format") || undefined,
      preset: url.searchParams.get("preset") || undefined,
      startDate: url.searchParams.get("startDate") || undefined,
      endDate: url.searchParams.get("endDate") || undefined,
      accountId: url.searchParams.get("accountId") || undefined,
      categoryId: url.searchParams.get("categoryId") || undefined,
      type: url.searchParams.get("type") || undefined,
    };

    const validation = exportQuerySchema.safeParse(rawParams);
    if (!validation.success) {
      return apiError(
        ErrorCodes.VALIDATION_ERROR,
        validation.error.issues[0]?.message ||
          "Format ekspor tidak valid atau parameter tidak lengkap. Gunakan format 'csv' atau 'xlsx'",
        400
      );
    }

    const { format, ...filter } = validation.data;

    if (format === "csv") {
      const { filename, csvContent } = await ReportService.exportToCsv(user.id, filter);
      return new Response(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    if (format === "xlsx") {
      const { filename, buffer } = await ReportService.exportToXlsx(user.id, filter);
      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return apiError(
      ErrorCodes.INVALID_INPUT,
      "Format ekspor tidak didukung. Gunakan 'csv' atau 'xlsx'",
      400
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mengekspor laporan keuangan";
    if (message.includes("tidak ditemukan atau bukan milik Anda")) {
      return apiError(ErrorCodes.FORBIDDEN, message, 403);
    }
    return apiError(ErrorCodes.INVALID_INPUT, message, 400);
  }
}

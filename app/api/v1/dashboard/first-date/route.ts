import { getCurrentUser } from "@/lib/auth/session";
import { DashboardService } from "@/services/dashboard.service";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/utils/api-response";

const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Convert UTC Date to Jakarta "YYYY-MM-DD" string */
function toJakartaDateStr(d: Date): string {
  return new Date(d.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  const firstDate = await DashboardService.getFirstTransactionDate(user.id);
  return apiSuccess({ firstDate: toJakartaDateStr(firstDate) });
}

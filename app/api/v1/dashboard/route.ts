import { getCurrentUser } from "@/lib/auth/session";
import { DashboardService } from "@/services/dashboard.service";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/utils/api-response";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  const timezone = ((user as Record<string, unknown>).timezone as string) || "Asia/Jakarta";
  const summary = await DashboardService.getSummary(user.id, timezone);
  return apiSuccess(summary);
}

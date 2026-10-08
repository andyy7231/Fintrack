import { getCurrentUser } from "@/lib/auth/session";
import { MarketService } from "@/services/market.service";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/utils/api-response";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  try {
    const data = await MarketService.getMarketPulse();
    return apiSuccess(data);
  } catch (error) {
    console.error("[API] Failed to fetch market pulse:", error);
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      "Gagal mengambil data pergerakan pasar",
      500
    );
  }
}

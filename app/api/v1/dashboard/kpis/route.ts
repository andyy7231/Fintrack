import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { DashboardService } from "@/services/dashboard.service";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/utils/api-response";

const TZ_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Jakarta = UTC+7

/** Jakarta-local midnight → UTC Date */
function jakartaDayStart(isoDateStr: string): Date {
  // isoDateStr is "YYYY-MM-DD" in Jakarta local time
  const [y, m, d] = isoDateStr.split("-").map(Number);
  // midnight Jakarta = midnight UTC - 7h
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - TZ_OFFSET_MS);
}

/** Jakarta-local end of day → UTC Date */
function jakartaDayEnd(isoDateStr: string): Date {
  const [y, m, d] = isoDateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - TZ_OFFSET_MS);
}

/** Today in Jakarta as "YYYY-MM-DD" */
function jakartaToday(): string {
  return new Date(Date.now() + TZ_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  const { searchParams } = new URL(req.url);
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");

  // "all" is a sentinel value meaning "since first transaction"
  let start: Date;
  let end: Date;

  if (startParam === "all" || !startParam) {
    start = await DashboardService.getFirstTransactionDate(user.id);
    end = jakartaDayEnd(jakartaToday());
  } else {
    // Validate the dates are parseable YYYY-MM-DD strings
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startParam) ||
        (endParam && !/^\d{4}-\d{2}-\d{2}$/.test(endParam))) {
      return apiError(ErrorCodes.VALIDATION_ERROR, "Invalid date format. Use YYYY-MM-DD.", 400);
    }
    start = jakartaDayStart(startParam);
    end = endParam ? jakartaDayEnd(endParam) : jakartaDayEnd(jakartaToday());
  }

  const kpis = await DashboardService.getKPIsForPeriod(user.id, start, end);
  return apiSuccess(kpis);
}

import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { GoalService } from "@/services/goal.service";
import { createGoalSchema, GoalStatus } from "@/schemas/goal.schema";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  try {
    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const status = statusParam ? (statusParam as GoalStatus | "ALL") : undefined;

    const list = await GoalService.listGoals(user.id, status);
    return apiSuccess(list);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat daftar goal";
    return apiError(ErrorCodes.INTERNAL_ERROR, message, 500);
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  try {
    const body = await req.json();
    const validation = createGoalSchema.safeParse(body);

    if (!validation.success) {
      return apiError(
        ErrorCodes.VALIDATION_ERROR,
        validation.error.issues[0]?.message || "Input goal tidak valid",
        400
      );
    }

    const created = await GoalService.createGoal(user.id, validation.data);
    return apiSuccess(created, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal membuat goal";
    return apiError(ErrorCodes.INVALID_INPUT, message, 400);
  }
}

import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { GoalService } from "@/services/goal.service";
import { updateGoalSchema } from "@/schemas/goal.schema";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/utils/api-response";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  const { id } = await ctx.params;
  const goal = await GoalService.getGoal(user.id, id);

  if (!goal) {
    return apiError(ErrorCodes.NOT_FOUND, "Goal tidak ditemukan", 404);
  }

  return apiSuccess(goal);
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  const { id } = await ctx.params;

  try {
    const body = await req.json();
    const validation = updateGoalSchema.safeParse(body);

    if (!validation.success) {
      return apiError(
        ErrorCodes.VALIDATION_ERROR,
        validation.error.issues[0]?.message || "Input tidak valid",
        400
      );
    }

    const updated = await GoalService.updateGoal(user.id, id, validation.data);

    if (!updated) {
      return apiError(ErrorCodes.NOT_FOUND, "Goal tidak ditemukan", 404);
    }

    return apiSuccess(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memperbarui goal";
    return apiError(ErrorCodes.INVALID_INPUT, message, 400);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  const { id } = await ctx.params;

  try {
    const result = await GoalService.deleteGoal(user.id, id);

    if (!result.deleted) {
      return apiError(ErrorCodes.NOT_FOUND, "Goal tidak ditemukan", 404);
    }

    return apiSuccess({ deleted: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menghapus goal";
    return apiError(ErrorCodes.CONFLICT, message, 409);
  }
}

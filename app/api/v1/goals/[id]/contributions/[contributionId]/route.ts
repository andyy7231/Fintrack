import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { GoalService } from "@/services/goal.service";
import { updateContributionSchema } from "@/schemas/goal.schema";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/utils/api-response";

type RouteContext = { params: Promise<{ id: string; contributionId: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  const { id, contributionId } = await ctx.params;
  const contrib = await GoalService.getContribution(user.id, id, contributionId);

  if (!contrib) {
    return apiError(ErrorCodes.NOT_FOUND, "Kontribusi tidak ditemukan", 404);
  }

  return apiSuccess(contrib);
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  const { id, contributionId } = await ctx.params;

  try {
    const body = await req.json();
    const validation = updateContributionSchema.safeParse(body);

    if (!validation.success) {
      return apiError(
        ErrorCodes.VALIDATION_ERROR,
        validation.error.issues[0]?.message || "Input tidak valid",
        400
      );
    }

    const updated = await GoalService.updateContribution(
      user.id,
      id,
      contributionId,
      validation.data
    );

    return apiSuccess(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memperbarui kontribusi";
    if (message.includes("tidak ditemukan")) {
      return apiError(ErrorCodes.NOT_FOUND, message, 404);
    }
    return apiError(ErrorCodes.INVALID_INPUT, message, 400);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  const { id, contributionId } = await ctx.params;

  try {
    const result = await GoalService.deleteContribution(user.id, id, contributionId);

    if (!result.deleted) {
      return apiError(ErrorCodes.NOT_FOUND, "Kontribusi tidak ditemukan", 404);
    }

    return apiSuccess({ deleted: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menghapus kontribusi";
    return apiError(ErrorCodes.INVALID_INPUT, message, 400);
  }
}

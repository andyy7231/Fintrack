import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { GoalService } from "@/services/goal.service";
import { createContributionSchema } from "@/schemas/goal.schema";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/utils/api-response";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  const { id } = await ctx.params;

  try {
    const contributions = await GoalService.listContributions(user.id, id);
    return apiSuccess(contributions);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat kontribusi";
    return apiError(ErrorCodes.NOT_FOUND, message, 404);
  }
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  const { id } = await ctx.params;

  try {
    const body = await req.json();
    const validation = createContributionSchema.safeParse(body);

    if (!validation.success) {
      return apiError(
        ErrorCodes.VALIDATION_ERROR,
        validation.error.issues[0]?.message || "Input kontribusi tidak valid",
        400
      );
    }

    const created = await GoalService.createContribution(user.id, id, validation.data);
    return apiSuccess(created, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menambahkan kontribusi";
    // Check if error is access/not found or validation/target overflow
    if (message.includes("tidak ditemukan")) {
      return apiError(ErrorCodes.NOT_FOUND, message, 404);
    }
    return apiError(ErrorCodes.INVALID_INPUT, message, 400);
  }
}

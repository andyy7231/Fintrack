import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { BudgetService } from "@/services/budget.service";
import { updateBudgetSchema } from "@/schemas/budget.schema";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/utils/api-response";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  const { id } = await ctx.params;
  const budget = await BudgetService.getBudget(user.id, id);

  if (!budget) {
    return apiError(ErrorCodes.NOT_FOUND, "Budget tidak ditemukan", 404);
  }

  return apiSuccess(budget);
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  const { id } = await ctx.params;

  try {
    const body = await req.json();
    const validation = updateBudgetSchema.safeParse(body);

    if (!validation.success) {
      return apiError(
        ErrorCodes.VALIDATION_ERROR,
        validation.error.issues[0]?.message || "Input tidak valid",
        400
      );
    }

    const updated = await BudgetService.updateBudget(user.id, id, validation.data);

    if (!updated) {
      return apiError(ErrorCodes.NOT_FOUND, "Budget tidak ditemukan", 404);
    }

    return apiSuccess(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memperbarui budget";
    return apiError(ErrorCodes.INVALID_INPUT, message, 400);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  const { id } = await ctx.params;
  const deleted = await BudgetService.deleteBudget(user.id, id);

  if (!deleted) {
    return apiError(ErrorCodes.NOT_FOUND, "Budget tidak ditemukan", 404);
  }

  return apiSuccess({ deleted: true });
}

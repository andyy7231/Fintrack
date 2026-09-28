import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { BudgetService } from "@/services/budget.service";
import { createBudgetSchema } from "@/schemas/budget.schema";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/utils/api-response";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  try {
    const list = await BudgetService.listBudgets(user.id);
    return apiSuccess(list);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat daftar budget";
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
    const validation = createBudgetSchema.safeParse(body);

    if (!validation.success) {
      return apiError(
        ErrorCodes.VALIDATION_ERROR,
        validation.error.issues[0]?.message || "Input budget tidak valid",
        400
      );
    }

    const created = await BudgetService.createBudget(user.id, validation.data);
    return apiSuccess(created, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal membuat budget";
    return apiError(ErrorCodes.INVALID_INPUT, message, 400);
  }
}

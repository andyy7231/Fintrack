import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { CategoryService } from "@/services/category.service";
import { createCategorySchema } from "@/schemas/category.schema";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  const { searchParams } = new URL(req.url);
  const includeStats = searchParams.get("stats") === "true";

  if (includeStats) {
    const data = await CategoryService.getCategoriesWithStats(user.id);
    return apiSuccess(data);
  }

  const typeParam = searchParams.get("type");
  const type = typeParam === "INCOME" || typeParam === "EXPENSE" ? typeParam : undefined;

  const cats = await CategoryService.getCategories(user.id, type);
  return apiSuccess(cats);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  try {
    const body = await req.json();
    const validation = createCategorySchema.safeParse(body);

    if (!validation.success) {
      return apiError(
        ErrorCodes.VALIDATION_ERROR,
        validation.error.issues[0]?.message || "Input tidak valid",
        400
      );
    }

    const created = await CategoryService.createCustomCategory(user.id, validation.data);
    return apiSuccess(created, 201);
  } catch {
    return apiError(ErrorCodes.INTERNAL_ERROR, "Gagal membuat kategori", 500);
  }
}

import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { CategoryService } from "@/services/category.service";
import { updateCategorySchema } from "@/schemas/category.schema";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/utils/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const validation = updateCategorySchema.safeParse(body);

    if (!validation.success) {
      return apiError(
        ErrorCodes.VALIDATION_ERROR,
        validation.error.issues[0]?.message || "Input tidak valid",
        400
      );
    }

    const updated = await CategoryService.updateCategory(user.id, id, validation.data);
    if (!updated) {
      return apiError(
        ErrorCodes.FORBIDDEN,
        "Kategori tidak dapat diubah (kategori bawaan sistem atau bukan milik Anda)",
        403
      );
    }

    return apiSuccess(updated);
  } catch {
    return apiError(ErrorCodes.INTERNAL_ERROR, "Gagal memperbarui kategori", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  const { id } = await params;
  const deleted = await CategoryService.deleteCategory(user.id, id);

  if (!deleted) {
    return apiError(
      ErrorCodes.FORBIDDEN,
      "Kategori tidak dapat dihapus (kategori bawaan sistem atau bukan milik Anda)",
      403
    );
  }

  return apiSuccess({ message: "Kategori berhasil dihapus", category: deleted });
}

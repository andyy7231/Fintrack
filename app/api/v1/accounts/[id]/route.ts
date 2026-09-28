import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { AccountService } from "@/services/account.service";
import { updateAccountSchema } from "@/schemas/account.schema";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/utils/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  const { id } = await params;
  const account = await AccountService.getAccountById(user.id, id);

  if (!account) {
    return apiError(ErrorCodes.NOT_FOUND, "Akun keuangan tidak ditemukan", 404);
  }

  return apiSuccess(account);
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const validation = updateAccountSchema.safeParse(body);

    if (!validation.success) {
      return apiError(
        ErrorCodes.VALIDATION_ERROR,
        validation.error.issues[0]?.message || "Input tidak valid",
        400
      );
    }

    const updated = await AccountService.updateAccount(user.id, id, validation.data);
    if (!updated) {
      return apiError(ErrorCodes.NOT_FOUND, "Akun keuangan tidak ditemukan", 404);
    }

    return apiSuccess(updated);
  } catch {
    return apiError(ErrorCodes.INTERNAL_ERROR, "Gagal memperbarui akun keuangan", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  const { id } = await params;
  const deactivated = await AccountService.deactivateAccount(user.id, id);

  if (!deactivated) {
    return apiError(ErrorCodes.NOT_FOUND, "Akun keuangan tidak ditemukan", 404);
  }

  return apiSuccess({ message: "Akun keuangan berhasil dinonaktifkan", account: deactivated });
}

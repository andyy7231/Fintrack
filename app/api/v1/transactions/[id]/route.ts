import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { TransactionService } from "@/services/transaction.service";
import { updateTransactionSchema } from "@/schemas/transaction.schema";
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
  const transaction = await TransactionService.getTransactionById(user.id, id);

  if (!transaction) {
    return apiError(ErrorCodes.NOT_FOUND, "Transaksi tidak ditemukan", 404);
  }

  return apiSuccess(transaction);
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const validation = updateTransactionSchema.safeParse(body);

    if (!validation.success) {
      return apiError(
        ErrorCodes.VALIDATION_ERROR,
        validation.error.issues[0]?.message || "Input tidak valid",
        400
      );
    }

    const updated = await TransactionService.updateTransaction(user.id, id, validation.data);
    if (!updated) {
      return apiError(ErrorCodes.NOT_FOUND, "Transaksi tidak ditemukan", 404);
    }

    return apiSuccess(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memperbarui transaksi";
    return apiError(ErrorCodes.INVALID_INPUT, message, 400);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  const { id } = await params;
  const deleted = await TransactionService.deleteTransaction(user.id, id);

  if (!deleted) {
    return apiError(ErrorCodes.NOT_FOUND, "Transaksi tidak ditemukan", 404);
  }

  return apiSuccess({ message: "Transaksi berhasil dihapus", transaction: deleted });
}

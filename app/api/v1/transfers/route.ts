import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { TransferService } from "@/services/transfer.service";
import { createTransferSchema } from "@/schemas/transfer.schema";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/utils/api-response";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  const transfersList = await TransferService.getTransfers(user.id);
  return apiSuccess(transfersList);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  try {
    const body = await req.json();
    const validation = createTransferSchema.safeParse(body);

    if (!validation.success) {
      return apiError(
        ErrorCodes.VALIDATION_ERROR,
        validation.error.issues[0]?.message || "Input transfer tidak valid",
        400
      );
    }

    const transfer = await TransferService.createTransfer(user.id, validation.data);
    return apiSuccess(transfer, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal melakukan transfer";
    return apiError(ErrorCodes.INVALID_INPUT, message, 400);
  }
}

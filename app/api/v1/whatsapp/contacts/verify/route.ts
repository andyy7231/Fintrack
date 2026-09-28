import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { WhatsAppVerificationService } from "@/services/whatsapp/verification.service";
import { z } from "zod";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/utils/api-response";

const verifyCodeSchema = z.object({
  phoneNumber: z.string().trim().min(5),
  code: z.string().trim().length(6, "Kode verifikasi harus 6 digit"),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  try {
    const body = await req.json();
    const validation = verifyCodeSchema.safeParse(body);

    if (!validation.success) {
      return apiError(
        ErrorCodes.VALIDATION_ERROR,
        validation.error.issues[0]?.message || "Input tidak valid",
        400
      );
    }

    const result = await WhatsAppVerificationService.verifyCode(
      user.id,
      validation.data.phoneNumber,
      validation.data.code
    );

    if (!result.success) {
      return apiError(ErrorCodes.INVALID_INPUT, result.error || "Kode verifikasi salah", 400);
    }

    return apiSuccess({ verified: true });
  } catch {
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      "Gagal memverifikasi kode",
      500
    );
  }
}

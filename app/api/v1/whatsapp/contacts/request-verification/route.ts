import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { WhatsAppVerificationService } from "@/services/whatsapp/verification.service";
import { linkWhatsAppContactSchema } from "@/schemas/whatsapp.schema";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/utils/api-response";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  try {
    const body = await req.json();
    const validation = linkWhatsAppContactSchema.safeParse(body);

    if (!validation.success) {
      return apiError(
        ErrorCodes.VALIDATION_ERROR,
        validation.error.issues[0]?.message || "Input tidak valid",
        400
      );
    }

    const result = await WhatsAppVerificationService.requestVerification(
      user.id,
      validation.data.phoneNumber
    );

    if (!result.success) {
      return apiError(ErrorCodes.CONFLICT, result.error || "Gagal meminta verifikasi", 400);
    }

    return apiSuccess({
      expiresAt: result.expiresAt,
      challengeId: result.challengeId,
    });
  } catch {
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      "Gagal memproses permintaan verifikasi",
      500
    );
  }
}

import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { UserMappingService } from "@/services/whatsapp";
import { linkWhatsAppContactSchema } from "@/schemas/whatsapp.schema";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/utils/api-response";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  const contacts = await UserMappingService.getUserContacts(user.id);
  return apiSuccess(contacts);
}

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

    const contact = await UserMappingService.linkPhoneNumber(
      user.id,
      validation.data.phoneNumber
    );

    return apiSuccess(contact, 201);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal menghubungkan nomor WhatsApp";
    return apiError(ErrorCodes.CONFLICT, message, 400);
  }
}

export async function DELETE(req: NextRequest) {
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

    const unlinked = await UserMappingService.unlinkPhoneNumber(
      user.id,
      validation.data.phoneNumber
    );

    return apiSuccess({ success: unlinked });
  } catch {
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      "Gagal memutuskan nomor WhatsApp",
      500
    );
  }
}

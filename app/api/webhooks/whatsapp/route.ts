import { NextRequest, NextResponse } from "next/server";
import { WhatsAppWebhookService } from "@/services/whatsapp";
import { apiError, apiSuccess, ErrorCodes } from "@/lib/utils/api-response";
import { checkRateLimit } from "@/lib/utils/rate-limit";

/**
 * Meta WhatsApp Webhook Endpoint
 *
 * GET: Handles Meta Webhook verification handshake.
 * POST: Receives and processes real-time inbound events with rate limiting and HMAC validation.
 */

const WEBHOOK_RATE_LIMIT = 200; // 200 requests per minute
const WEBHOOK_WINDOW_MS = 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    const verification = WhatsAppWebhookService.verifyWebhook(mode, token, challenge);

    if (verification.isValid && verification.challenge) {
      // Must respond with the plain challenge string and HTTP 200
      return new NextResponse(verification.challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    return new NextResponse("Forbidden", { status: 403 });
  } catch (error) {
    console.error("[WhatsApp Webhook] Verification error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    const rateResult = checkRateLimit(`wa_webhook_${clientIp}`, WEBHOOK_RATE_LIMIT, WEBHOOK_WINDOW_MS);
    if (!rateResult.allowed) {
      return apiError(
        ErrorCodes.SERVICE_UNAVAILABLE,
        "Terlalu banyak permintaan. Silakan tunggu sebentar.",
        429
      );
    }

    const signature = request.headers.get("x-hub-signature-256");
    const rawBody = await request.text();

    const result = await WhatsAppWebhookService.handleWebhookPayload(
      rawBody,
      signature
    );

    if (!result.success) {
      return apiError(
        result.statusCode === 401 ? ErrorCodes.UNAUTHORIZED : ErrorCodes.INVALID_INPUT,
        result.error || "Webhook processing failed",
        result.statusCode
      );
    }

    return apiSuccess(
      {
        status: "received",
        processedCount: result.results?.length ?? 0,
      },
      200
    );
  } catch (error) {
    console.error("[WhatsApp Webhook] Error processing POST webhook:", error);
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      "An unexpected error occurred while processing the webhook",
      500
    );
  }
}

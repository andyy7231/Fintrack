import { getWhatsAppConfig } from "./config";
import { verifyWebhookSignature } from "./signature";
import { extractInboundMessages } from "./adapter";
import { WhatsAppMessageService } from "./message.service";
import { MetaWebhookPayload, ProcessedWhatsAppMessage } from "./types";
import { metaWebhookPayloadSchema } from "@/schemas/whatsapp.schema";
import { IWhatsAppClient, whatsAppClient } from "./client";

export class WhatsAppWebhookService {
  /**
   * Verify webhook challenge from Meta (GET /api/webhooks/whatsapp)
   */
  static verifyWebhook(
    mode: string | null,
    token: string | null,
    challenge: string | null
  ): { isValid: boolean; challenge?: string } {
    const config = getWhatsAppConfig();

    if (mode === "subscribe" && token && config.verifyToken && token === config.verifyToken) {
      return {
        isValid: true,
        challenge: challenge || "",
      };
    }

    return {
      isValid: false,
    };
  }

  /**
   * Handle incoming Meta webhook payload (POST /api/webhooks/whatsapp)
   */
  static async handleWebhookPayload(
    rawBody: string,
    signatureHeader: string | null,
    client: IWhatsAppClient = whatsAppClient
  ): Promise<{
    success: boolean;
    statusCode: number;
    error?: string;
    results?: ProcessedWhatsAppMessage[];
  }> {
    const config = getWhatsAppConfig();

    // Step 1: Validate HMAC SHA-256 signature
    const isSignatureValid = verifyWebhookSignature(
      rawBody,
      signatureHeader,
      config.appSecret
    );

    if (!isSignatureValid) {
      return {
        success: false,
        statusCode: 401,
        error: "Invalid webhook signature",
      };
    }

    // Step 2: Parse raw JSON safely
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      return {
        success: false,
        statusCode: 400,
        error: "Malformed JSON payload",
      };
    }

    // Step 3: Validate structure with Zod schema
    const parseResult = metaWebhookPayloadSchema.safeParse(parsedJson);
    if (!parseResult.success) {
      // Check if it's a non-whatsapp event or empty ping
      return {
        success: false,
        statusCode: 400,
        error: "Invalid webhook payload structure",
      };
    }

    const payload = parseResult.data as MetaWebhookPayload;

    // Step 4: Extract inbound messages via adapter
    const inboundMessages = extractInboundMessages(payload);

    // If payload contains no messages (e.g., delivery status pings), return 200 OK
    if (inboundMessages.length === 0) {
      return {
        success: true,
        statusCode: 200,
        results: [],
      };
    }

    // Step 5: Ingest each inbound message idempotently
    const results: ProcessedWhatsAppMessage[] = [];
    for (const msg of inboundMessages) {
      const res = await WhatsAppMessageService.processInboundMessage(msg, client);
      results.push(res);
    }

    return {
      success: true,
      statusCode: 200,
      results,
    };
  }
}

import { MetaWebhookPayload, WhatsAppInboundMessage } from "./types";
import { normalizePhoneNumber } from "./phone.utils";

/**
 * Meta Webhook Payload Adapter
 *
 * Extracts incoming messages from the Meta WhatsApp Cloud API webhook structure
 * and normalizes them into internal WhatsAppInboundMessage DTOs.
 * Isolates Meta webhook JSON specifics from downstream application services (and future Phase 5 parser).
 */
export function extractInboundMessages(
  payload: MetaWebhookPayload
): WhatsAppInboundMessage[] {
  const normalizedMessages: WhatsAppInboundMessage[] = [];

  if (payload.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) {
    return normalizedMessages;
  }

  for (const entry of payload.entry) {
    if (!Array.isArray(entry.changes)) continue;

    for (const change of entry.changes) {
      if (change.field !== "messages") continue;

      const value = change.value;
      if (!value || !Array.isArray(value.messages)) continue;

      // Map contacts by wa_id for profile names if present
      const contactMap = new Map<string, string>();
      if (Array.isArray(value.contacts)) {
        for (const contact of value.contacts) {
          if (contact.wa_id && contact.profile?.name) {
            contactMap.set(contact.wa_id, contact.profile.name);
          }
        }
      }

      for (const msg of value.messages) {
        if (!msg.id || !msg.from) continue;

        let normalizedPhone = "";
        try {
          normalizedPhone = normalizePhoneNumber(msg.from);
        } catch {
          // If phone normalization fails, fallback to keeping raw or prepend +
          normalizedPhone = msg.from.startsWith("+") ? msg.from : `+${msg.from}`;
        }

        const timestampSeconds = parseInt(msg.timestamp, 10);
        const receivedAt = !isNaN(timestampSeconds)
          ? new Date(timestampSeconds * 1000)
          : new Date();

        const messageText =
          msg.type === "text" && msg.text?.body ? msg.text.body.trim() : null;

        normalizedMessages.push({
          providerMessageId: msg.id,
          phoneNumber: msg.from,
          normalizedPhoneNumber: normalizedPhone,
          messageType: msg.type,
          text: messageText,
          receivedAt,
          senderName: contactMap.get(msg.from),
          rawPayload: msg,
        });
      }
    }
  }

  return normalizedMessages;
}

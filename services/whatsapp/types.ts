/**
 * WhatsApp Cloud API Types & DTOs
 */

// Normalized Inbound Message for application services (and future Phase 5 consumption)
export interface WhatsAppInboundMessage {
  providerMessageId: string;
  phoneNumber: string; // Raw sender phone number from Meta
  normalizedPhoneNumber: string; // Deterministic E.164 canonical format
  messageType: string; // "text" | "image" | "audio" | "document" | "interactive" | "button" | etc.
  text: string | null;
  receivedAt: Date;
  senderName?: string;
  rawPayload?: unknown;
}

// Result of processing an inbound WhatsApp message
export interface ProcessedWhatsAppMessage {
  id: string; // Internal message ID in database
  providerMessageId: string;
  userId: string | null;
  phoneNumber: string;
  status: "RECEIVED" | "PROCESSED" | "FAILED" | "IGNORED" | "UNSUPPORTED" | "DUPLICATE";
  responseSent?: string;
  isDuplicate: boolean;
}

// Meta Webhook Payload Types
export interface MetaWebhookTextMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: {
    body: string;
  };
  image?: unknown;
  audio?: unknown;
  document?: unknown;
  interactive?: unknown;
  button?: unknown;
}

export interface MetaWebhookContact {
  profile?: {
    name?: string;
  };
  wa_id: string;
}

export interface MetaWebhookChangeValue {
  messaging_product: string;
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  contacts?: MetaWebhookContact[];
  messages?: MetaWebhookTextMessage[];
  statuses?: unknown[];
}

export interface MetaWebhookChange {
  field: string;
  value: MetaWebhookChangeValue;
}

export interface MetaWebhookEntry {
  id: string;
  changes: MetaWebhookChange[];
}

export interface MetaWebhookPayload {
  object: string;
  entry: MetaWebhookEntry[];
}

// Outbound Message Request / Response
export interface SendTextMessageParams {
  to: string;
  text: string;
  previewUrl?: boolean;
}

export interface WhatsAppApiResponse {
  messaging_product: string;
  contacts?: Array<{ input: string; wa_id: string }>;
  messages?: Array<{ id: string }>;
  error?: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

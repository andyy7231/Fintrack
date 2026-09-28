import { z } from "zod";

/**
 * Zod schema for validating Meta WhatsApp Webhook payload
 */
export const metaWebhookMessageSchema = z.object({
  from: z.string().min(1),
  id: z.string().min(1),
  timestamp: z.string().min(1),
  type: z.string().min(1),
  text: z
    .object({
      body: z.string(),
    })
    .optional(),
  image: z.unknown().optional(),
  audio: z.unknown().optional(),
  document: z.unknown().optional(),
  interactive: z.unknown().optional(),
  button: z.unknown().optional(),
});

export const metaWebhookChangeValueSchema = z.object({
  messaging_product: z.literal("whatsapp").or(z.string()),
  metadata: z
    .object({
      display_phone_number: z.string().optional(),
      phone_number_id: z.string().optional(),
    })
    .optional(),
  contacts: z
    .array(
      z.object({
        profile: z
          .object({
            name: z.string().optional(),
          })
          .optional(),
        wa_id: z.string(),
      })
    )
    .optional(),
  messages: z.array(metaWebhookMessageSchema).optional(),
  statuses: z.array(z.unknown()).optional(),
});

export const metaWebhookChangeSchema = z.object({
  field: z.string(),
  value: metaWebhookChangeValueSchema,
});

export const metaWebhookEntrySchema = z.object({
  id: z.string(),
  changes: z.array(metaWebhookChangeSchema),
});

export const metaWebhookPayloadSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(metaWebhookEntrySchema),
});

export type MetaWebhookPayloadInput = z.infer<typeof metaWebhookPayloadSchema>;

/**
 * Schema for linking a phone number to an authenticated user
 */
export const linkWhatsAppContactSchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .min(5, "Nomor WhatsApp wajib diisi")
    .max(30, "Nomor WhatsApp terlalu panjang"),
});

export type LinkWhatsAppContactInput = z.infer<typeof linkWhatsAppContactSchema>;

/**
 * WhatsApp Cloud API Configuration
 * Reads configuration strictly from server-side environment variables.
 * Never exposes private credentials to client components.
 */

export interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  verifyToken: string;
  appSecret: string;
  apiVersion: string;
}

export function getWhatsAppConfig(): WhatsAppConfig {
  return {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "",
    appSecret: process.env.WHATSAPP_APP_SECRET || "",
    apiVersion: process.env.WHATSAPP_API_VERSION || "v22.0",
  };
}

export function getWhatsAppGraphApiUrl(
  phoneNumberId: string,
  apiVersion = "v22.0"
): string {
  return `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
}

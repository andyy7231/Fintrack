import { getWhatsAppConfig, getWhatsAppGraphApiUrl } from "./config";
import { SendTextMessageParams, WhatsAppApiResponse } from "./types";

export interface OutboundMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
  isRetryable?: boolean;
  statusCode?: number;
}

export interface IWhatsAppClient {
  sendTextMessage(params: SendTextMessageParams): Promise<OutboundMessageResult>;
}

export class WhatsAppClient implements IWhatsAppClient {
  private fetchFn: typeof fetch;
  private timeoutMs: number;

  constructor(fetchFn: typeof fetch = fetch, timeoutMs = 10000) {
    this.fetchFn = fetchFn;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Classify whether an HTTP status code or error is retryable.
   */
  static isRetryableError(statusCode?: number, errorName?: string): boolean {
    if (errorName === "AbortError" || errorName === "TimeoutError") {
      return true;
    }
    if (!statusCode) {
      return true; // Network or connection drop
    }
    // 429 (Rate Limit) and 5xx (Server Errors) are retryable.
    // 400 (Bad Request), 401 (Auth failed), 403 (Forbidden) are NOT retryable.
    if (statusCode === 429 || statusCode >= 500) {
      return true;
    }
    return false;
  }

  /**
   * Send a text message via WhatsApp Cloud API.
   * Automated tests must mock fetchFn to avoid hitting external Meta servers.
   */
  async sendTextMessage({
    to,
    text,
    previewUrl = false,
  }: SendTextMessageParams): Promise<OutboundMessageResult> {
    const config = getWhatsAppConfig();

    if (!config.accessToken || !config.phoneNumberId) {
      return {
        success: false,
        error: "WhatsApp Cloud API credentials are not configured",
        isRetryable: false,
      };
    }

    const url = getWhatsAppGraphApiUrl(config.phoneNumberId, config.apiVersion);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: {
          preview_url: previewUrl,
          body: text,
        },
      };

      const response = await this.fetchFn(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timer);

      const data = (await response.json()) as WhatsAppApiResponse;

      if (!response.ok || data.error) {
        const statusCode = response.status;
        const errorMsg =
          data.error?.message || `HTTP ${statusCode}: Failed to send message`;
        const retryable = WhatsAppClient.isRetryableError(statusCode);

        return {
          success: false,
          error: errorMsg,
          statusCode,
          isRetryable: retryable,
        };
      }

      const messageId = data.messages?.[0]?.id;
      return {
        success: true,
        messageId,
      };
    } catch (err: unknown) {
      clearTimeout(timer);
      const isAbort = err instanceof Error && err.name === "AbortError";
      const errorMsg = isAbort
        ? `Request timed out after ${this.timeoutMs}ms`
        : err instanceof Error
        ? err.message
        : "Unknown network error";

      return {
        success: false,
        error: errorMsg,
        isRetryable: true, // Network timeouts / errors are retryable
      };
    }
  }
}

// Default singleton instance
export const whatsAppClient = new WhatsAppClient();

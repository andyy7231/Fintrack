import crypto from "crypto";

/**
 * Validates Meta Webhook HMAC-SHA256 signature.
 * Header: `x-hub-signature-256: sha256=<signature_hash>`
 *
 * Must be computed from raw request body (NOT re-serialized JSON).
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string | null | undefined,
  appSecret: string
): boolean {
  if (!signatureHeader || !appSecret) {
    return false;
  }

  const parts = signatureHeader.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") {
    return false;
  }

  const receivedHash = parts[1];
  if (!receivedHash || receivedHash.length !== 64) {
    return false;
  }

  try {
    const hmac = crypto.createHmac("sha256", appSecret);
    hmac.update(rawBody);
    const expectedHash = hmac.digest("hex");

    const receivedBuffer = Buffer.from(receivedHash, "hex");
    const expectedBuffer = Buffer.from(expectedHash, "hex");

    if (receivedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * Helper to compute signature (useful for automated testing)
 */
export function generateWebhookSignature(
  rawBody: string | Buffer,
  appSecret: string
): string {
  const hmac = crypto.createHmac("sha256", appSecret);
  hmac.update(rawBody);
  return `sha256=${hmac.digest("hex")}`;
}

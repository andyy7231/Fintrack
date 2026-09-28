/**
 * Phone Number Normalization Utilities
 *
 * Normalizes user-supplied or provider-supplied phone numbers into canonical E.164 format.
 * Examples:
 *   "+62 812-3456-7890" -> "+6281234567890"
 *   "081234567890"      -> "+6281234567890"
 *   "6281234567890"     -> "+6281234567890"
 *   "+6281234567890"    -> "+6281234567890"
 *   "+1 (555) 123-4567" -> "+15551234567"
 */

export function normalizePhoneNumber(raw: string): string {
  if (!raw || typeof raw !== "string") {
    throw new Error("Phone number must be a non-empty string");
  }

  // Remove common formatting characters: spaces, hyphens, parentheses, dots
  let cleaned = raw.trim().replace(/[\s\-\(\)\.]/g, "");

  // If already starts with '+', validate the remaining digits
  if (cleaned.startsWith("+")) {
    const digits = cleaned.slice(1);
    if (!/^\d{7,15}$/.test(digits)) {
      throw new Error(`Invalid phone number format: "${raw}"`);
    }
    return `+${digits}`;
  }

  // If starts with Indonesian local prefix '0' (e.g. 0812...)
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1);
  }

  // If starts with country code (e.g. 62812...) without '+'
  if (/^\d{7,15}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  throw new Error(`Invalid phone number format: "${raw}"`);
}

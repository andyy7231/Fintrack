/**
 * Indonesian Rupiah Amount Parser & Normalizer
 *
 * Normalizes colloquial Indonesian monetary expressions into numeric values.
 *
 * Examples:
 *   "25 ribu"    -> 25000
 *   "25rb"       -> 25000
 *   "25 k"       -> 25000
 *   "25.000"     -> 25000
 *   "Rp25.000"   -> 25000
 *   "1,5 juta"   -> 1500000
 *   "1.5 juta"   -> 1500000
 *   "1,5jt"      -> 1500000
 *   "7,5 juta"   -> 7500000
 */

export function parseIndonesianAmount(raw: string | number): number | null {
  if (typeof raw === "number") {
    return isFinite(raw) && raw > 0 ? Math.round(raw * 100) / 100 : null;
  }

  if (!raw || typeof raw !== "string") {
    return null;
  }

  let text = raw.trim().toLowerCase();

  // Remove currency prefix and suffix words
  text = text.replace(/^(?:rp\.?|rupiah)\s*/i, "");
  text = text.replace(/\s*(?:rupiah|perak)$/i, "");
  text = text.trim();

  // Match expressions with multipliers: juta / jt, ribu / rb / k, miliar / m
  // Pattern: number (with possible decimal comma or dot) followed by unit
  const multiplierRegex = /^([0-9]+(?:[.,][0-9]+)*)\s*(juta|jt|miliar|m|ribu|rb|k)$/i;
  const match = text.match(multiplierRegex);

  if (match) {
    const numPartStr = match[1].replace(",", ".");
    const numPart = parseFloat(numPartStr);
    const unit = match[2].toLowerCase();

    if (isNaN(numPart) || numPart <= 0) {
      return null;
    }

    let multiplier = 1;
    if (unit === "juta" || unit === "jt") {
      multiplier = 1000000;
    } else if (unit === "ribu" || unit === "rb" || unit === "k") {
      multiplier = 1000;
    } else if (unit === "miliar" || unit === "m") {
      multiplier = 1000000000;
    }

    const calculated = Math.round(numPart * multiplier * 100) / 100;
    return isFinite(calculated) && calculated > 0 ? calculated : null;
  }

  // If text is purely numeric with thousand separators:
  // e.g. "25.000" or "25,000" or "25000"
  // Indonesian standard uses '.' as thousand separator, e.g. 25.000 or 1.500.000
  let cleaned = text.replace(/\s/g, "");

  // If formatted like 25.000 or 1.500.000 (all dots followed by exactly 3 digits)
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(cleaned)) {
    // English style with commas as thousands
    cleaned = cleaned.replace(/,/g, "");
  } else {
    // Plain digits or single decimal
    cleaned = cleaned.replace(/,/g, ".");
  }

  const parsed = parseFloat(cleaned);
  if (isNaN(parsed) || !isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed * 100) / 100;
}

/**
 * Format numeric amount into Indonesian Rupiah display string.
 * Example: 25000 -> "Rp25.000"
 */
export function formatRupiah(amount: number): string {
  return `Rp${Math.round(amount).toLocaleString("id-ID")}`;
}


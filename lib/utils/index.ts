/**
 * General-purpose utility functions.
 *
 * Keep this file lean — only add utilities that are:
 * - used in multiple places
 * - not specific to a single feature/domain
 */

/**
 * Format a number as Indonesian Rupiah currency.
 *
 * @example formatCurrency(25000) => "Rp25.000"
 * @example formatCurrency(7500000) => "Rp7.500.000"
 */
export function formatCurrency(amount: number, currency = "IDR"): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Generate a UUID v4 using the built-in crypto API.
 * No external package needed.
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Period calculation utilities using Asia/Jakarta timezone.
 * Consistent with dashboard.service.ts and budget.service.ts conventions.
 * 
 * Core Principles:
 * - All dates stored/queried as UTC in database
 * - Period boundaries calculated from Jakarta-local calendar dates
 * - Conversion: Jakarta local → UTC for queries, UTC → Jakarta for display
 */

import { PeriodType, PeriodRange } from "@/lib/types/period.types";

// Jakarta timezone offset: UTC+7
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Get current Jakarta local date at midnight (returned as UTC Date).
 * 
 * Example: If current time is 2024-01-15 10:30 Jakarta time,
 * returns UTC Date representing 2024-01-15 00:00:00 Jakarta (2024-01-14 17:00:00 UTC)
 * 
 * @returns UTC Date object representing Jakarta midnight
 */
export function getJakartaMidnightUtc(): Date {
  const now = new Date();
  const jakartaNow = new Date(now.getTime() + JAKARTA_OFFSET_MS);
  
  const year = jakartaNow.getUTCFullYear();
  const month = jakartaNow.getUTCMonth();
  const day = jakartaNow.getUTCDate();
  
  // Jakarta midnight as local time, convert to UTC
  const localMidnight = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  return new Date(localMidnight.getTime() - JAKARTA_OFFSET_MS);
}

/**
 * Get end of current Jakarta day (23:59:59.999) as UTC Date.
 * 
 * Returns the last millisecond of the current Jakarta day as UTC.
 * 
 * @returns UTC Date object representing Jakarta 23:59:59.999
 */
export function getJakartaDayEndUtc(): Date {
  const dayStart = getJakartaMidnightUtc();
  return new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
}

/**
 * Calculate Jakarta month boundaries [start, end).
 * 
 * Returns:
 * - start: First moment of the month (Jakarta midnight of day 1) as UTC
 * - end: First moment of NEXT month (exclusive boundary) as UTC
 * 
 * Example: jakartaMonthToUtcRange(2024, 1)
 * - start: 2024-01-01 00:00:00 Jakarta = 2023-12-31 17:00:00 UTC
 * - end: 2024-02-01 00:00:00 Jakarta = 2024-01-31 17:00:00 UTC
 * 
 * @param year - Calendar year (e.g., 2024)
 * @param month - Month number 1-12 (1 = January, 12 = December)
 * @returns Object with start (inclusive) and end (exclusive) UTC dates
 */
export function jakartaMonthToUtcRange(
  year: number, 
  month: number
): { start: Date; end: Date } {
  // Month boundaries in Jakarta local time
  const startLocal = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const start = new Date(startLocal.getTime() - JAKARTA_OFFSET_MS);
  
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endLocal = new Date(Date.UTC(nextYear, nextMonth - 1, 1, 0, 0, 0, 0));
  const end = new Date(endLocal.getTime() - JAKARTA_OFFSET_MS);
  
  return { start, end };
}

/**
 * Calculate date range for given period type.
 * 
 * Returns inclusive start and end boundaries as UTC dates.
 * All calculations are performed relative to Jakarta timezone.
 * 
 * Period Types:
 * - ALL: No date filters (returns empty range)
 * - TODAY: Current Jakarta day [midnight, 23:59:59.999]
 * - LAST_7_DAYS: Last 7 days including today
 * - LAST_30_DAYS: Last 30 days including today
 * - THIS_MONTH: Current calendar month in Jakarta
 * - LAST_MONTH: Previous calendar month in Jakarta
 * - CUSTOM: User-provided date range (requires customStart and customEnd)
 * 
 * @param type - Period type to calculate
 * @param customStart - Custom start date (required if type is CUSTOM)
 * @param customEnd - Custom end date (required if type is CUSTOM)
 * @returns PeriodRange with optional start and end dates (both inclusive)
 * @throws Error if CUSTOM type provided without required dates
 */
export function calculatePeriodRange(
  type: PeriodType,
  customStart?: Date,
  customEnd?: Date
): PeriodRange {
  const now = new Date();
  const jakartaNow = new Date(now.getTime() + JAKARTA_OFFSET_MS);
  const currentYear = jakartaNow.getUTCFullYear();
  const currentMonth = jakartaNow.getUTCMonth() + 1;
  
  switch (type) {
    case "ALL":
      // No date filters - return empty range
      return {};
      
    case "TODAY": {
      const start = getJakartaMidnightUtc();
      const end = getJakartaDayEndUtc();
      return { start, end };
    }
      
    case "LAST_7_DAYS": {
      // Last 7 days including today (7 days total)
      const todayMidnight = getJakartaMidnightUtc();
      const end = getJakartaDayEndUtc();
      // Go back 6 days from today (7 days including today)
      const start = new Date(todayMidnight.getTime() - 6 * 24 * 60 * 60 * 1000);
      return { start, end };
    }
      
    case "LAST_30_DAYS": {
      // Last 30 days including today (30 days total)
      const todayMidnight = getJakartaMidnightUtc();
      const end = getJakartaDayEndUtc();
      // Go back 29 days from today (30 days including today)
      const start = new Date(todayMidnight.getTime() - 29 * 24 * 60 * 60 * 1000);
      return { start, end };
    }
      
    case "THIS_MONTH": {
      const { start, end } = jakartaMonthToUtcRange(currentYear, currentMonth);
      // Convert exclusive end to inclusive (last millisecond of month)
      return { start, end: new Date(end.getTime() - 1) };
    }
      
    case "LAST_MONTH": {
      const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      const { start, end } = jakartaMonthToUtcRange(lastMonthYear, lastMonth);
      // Convert exclusive end to inclusive (last millisecond of month)
      return { start, end: new Date(end.getTime() - 1) };
    }
      
    case "CUSTOM": {
      if (!customStart || !customEnd) {
        throw new Error("Custom date range requires both start and end dates");
      }
      return { start: customStart, end: customEnd };
    }
      
    default:
      return {};
  }
}

/**
 * Format period label for display (Indonesian locale).
 * 
 * Generates human-readable date range labels appropriate for each period type.
 * Uses Indonesian date formatting (id-ID locale).
 * 
 * Examples:
 * - ALL: "Sejak pencatatan pertama"
 * - TODAY: "15 Jan 2024"
 * - LAST_7_DAYS: "9 Jan 2024 – 15 Jan 2024"
 * - THIS_MONTH: "Januari 2024"
 * - CUSTOM: "1 Jan 2024 – 31 Jan 2024"
 * 
 * @param type - Period type
 * @param range - Calculated period range (from calculatePeriodRange)
 * @returns Formatted Indonesian label string
 */
export function formatPeriodLabel(
  type: PeriodType,
  range: PeriodRange
): string {
  const dateFormatter = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
  
  switch (type) {
    case "ALL":
      return "Sejak pencatatan pertama";
      
    case "TODAY": {
      if (!range.start) return "Hari ini";
      return dateFormatter.format(range.start);
    }
      
    case "LAST_7_DAYS":
    case "LAST_30_DAYS":
    case "CUSTOM": {
      if (!range.start || !range.end) return "";
      const startStr = dateFormatter.format(range.start);
      const endStr = dateFormatter.format(range.end);
      return `${startStr} – ${endStr}`;
    }
      
    case "THIS_MONTH": {
      const now = new Date();
      const jakartaNow = new Date(now.getTime() + JAKARTA_OFFSET_MS);
      const monthName = new Intl.DateTimeFormat("id-ID", { 
        month: "long", 
        timeZone: "Asia/Jakarta" 
      }).format(jakartaNow);
      const year = jakartaNow.getUTCFullYear();
      return `${monthName} ${year}`;
    }
      
    case "LAST_MONTH": {
      const now = new Date();
      const jakartaNow = new Date(now.getTime() + JAKARTA_OFFSET_MS);
      const currentMonth = jakartaNow.getUTCMonth() + 1;
      const currentYear = jakartaNow.getUTCFullYear();
      
      const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      
      // Create a date in the last month for formatting
      const lastMonthDate = new Date(Date.UTC(lastMonthYear, lastMonth - 1, 15, 0, 0, 0, 0));
      const monthName = new Intl.DateTimeFormat("id-ID", { 
        month: "long", 
        timeZone: "Asia/Jakarta" 
      }).format(lastMonthDate);
      
      return `${monthName} ${lastMonthYear}`;
    }
      
    default:
      return "";
  }
}

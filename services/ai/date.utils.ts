/**
 * Jakarta Timezone Date Parsing Utilities
 *
 * Normalizes relative Indonesian date phrases against Asia/Jakarta (UTC+7).
 */

const JAKARTA_OFFSET_HOURS = 7;

/**
 * Returns current date components in Asia/Jakarta timezone.
 */
export function getJakartaNow(): Date {
  const now = new Date();
  // Return current Date
  return now;
}

/**
 * Get current Jakarta local date as YYYY-MM-DD string.
 */
export function getJakartaDateString(date: Date = new Date()): string {
  // Add 7 hours to UTC to get Jakarta local time
  const jakartaTime = new Date(date.getTime() + JAKARTA_OFFSET_HOURS * 3600 * 1000);
  const year = jakartaTime.getUTCFullYear();
  const month = String(jakartaTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jakartaTime.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Convert local Jakarta (year, month, day) into a UTC Date.
 * Midday 12:00 Jakarta is 05:00 UTC.
 */
export function jakartaDateToUtc(year: number, month: number, day: number, hour = 12): Date {
  return new Date(Date.UTC(year, month - 1, day, hour - JAKARTA_OFFSET_HOURS, 0, 0, 0));
}

/**
 * Parse colloquial Indonesian relative date expression into a UTC Date object.
 */
export function parseIndonesianDate(
  rawText?: string | null,
  referenceDate: Date = new Date()
): Date {
  if (!rawText) {
    return referenceDate;
  }

  const text = rawText.trim().toLowerCase();

  // If already an ISO string YYYY-MM-DD
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch && isoMatch[1] && isoMatch[2] && isoMatch[3]) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    return jakartaDateToUtc(y, m, d);
  }

  // Calculate current Jakarta day, month, year
  const jakartaNow = new Date(referenceDate.getTime() + JAKARTA_OFFSET_HOURS * 3600 * 1000);
  const curYear = jakartaNow.getUTCFullYear();
  const curMonth = jakartaNow.getUTCMonth() + 1;
  const curDay = jakartaNow.getUTCDate();

  // Check relative keywords
  if (
    text.includes("hari ini") ||
    text.includes("tadi pagi") ||
    text.includes("tadi siang") ||
    text.includes("tadi sore") ||
    text.includes("tadi malam") ||
    text === "tadi" ||
    text === "now" ||
    text === "sekarang"
  ) {
    return jakartaDateToUtc(curYear, curMonth, curDay);
  }

  if (text.includes("kemarin lusa")) {
    const d = new Date(jakartaDateToUtc(curYear, curMonth, curDay).getTime() - 2 * 86400 * 1000);
    return d;
  }

  if (text.includes("kemarin")) {
    const d = new Date(jakartaDateToUtc(curYear, curMonth, curDay).getTime() - 1 * 86400 * 1000);
    return d;
  }

  // DD/MM or DD/MM/YYYY format (e.g., "20/01" or "20/01/2024")
  // Check this BEFORE day names and tanggal pattern to prioritize explicit dates
  const slashDateMatch = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (slashDateMatch && slashDateMatch[1] && slashDateMatch[2]) {
    const day = parseInt(slashDateMatch[1], 10);
    const month = parseInt(slashDateMatch[2], 10);
    let year = curYear;
    
    if (slashDateMatch[3]) {
      year = parseInt(slashDateMatch[3], 10);
      // Convert 2-digit year to 4-digit (e.g., 24 → 2024)
      if (year < 100) {
        year += 2000;
      }
    }
    
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return jakartaDateToUtc(year, month, day);
    }
  }

  // Day names (e.g., "Senin", "Senin kemarin", "Selasa", dll)
  const dayMap: Record<string, number> = {
    minggu: 0,
    senin: 1,
    selasa: 2,
    rabu: 3,
    kamis: 4,
    jumat: 5,
    sabtu: 6,
  };

  for (const [dayName, targetDayOfWeek] of Object.entries(dayMap)) {
    if (text.includes(dayName)) {
      const curDayOfWeek = jakartaNow.getUTCDay();
      let diff = curDayOfWeek - targetDayOfWeek;
      if (diff <= 0) {
        diff += 7;
      }
      const targetDate = new Date(
        jakartaDateToUtc(curYear, curMonth, curDay).getTime() - diff * 86400 * 1000
      );
      return targetDate;
    }
  }

  // Specific date with month name, e.g. "20 September" or "tanggal 20 Januari"
  // More specific pattern to avoid matching amounts like "25rb"
  const dateWithMonthMatch = text.match(/(?:tanggal\s+)?(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|may|jun|jul|agu|ags|sep|okt|nov|des)/i);
  if (dateWithMonthMatch && dateWithMonthMatch[1] && dateWithMonthMatch[2]) {
    const day = parseInt(dateWithMonthMatch[1], 10);
    const monthName = dateWithMonthMatch[2].toLowerCase();

    const monthMap: Record<string, number> = {
      januari: 1, jan: 1,
      februari: 2, feb: 2,
      maret: 3, mar: 3,
      april: 4, apr: 4,
      mei: 5, may: 5,
      juni: 6, jun: 6,
      juli: 7, jul: 7,
      agustus: 8, agu: 8, ags: 8,
      september: 9, sep: 9,
      oktober: 10, okt: 10,
      november: 11, nov: 11,
      desember: 12, des: 12,
    };

    const targetMonth = monthMap[monthName];
    if (targetMonth && day >= 1 && day <= 31) {
      return jakartaDateToUtc(curYear, targetMonth, day);
    }
  }

  return jakartaDateToUtc(curYear, curMonth, curDay);
}

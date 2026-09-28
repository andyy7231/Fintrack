import { ReportPreset } from "@/schemas/report.schema";

export const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+07:00

export interface ResolvedReportPeriod {
  preset?: ReportPreset;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (inclusive calendar date selected)
  startUtc: Date; // inclusive UTC start instant
  endExclusiveUtc: Date; // exclusive UTC end instant
  granularity: "daily" | "monthly";
  timezone: string;
}

/**
 * Convert a Date object to year, month (1-indexed), day in Asia/Jakarta.
 */
export function getJakartaDateParts(date: Date): { year: number; month: number; day: number } {
  const jakartaTime = new Date(date.getTime() + JAKARTA_OFFSET_MS);
  return {
    year: jakartaTime.getUTCFullYear(),
    month: jakartaTime.getUTCMonth() + 1,
    day: jakartaTime.getUTCDate(),
  };
}

/**
 * Format Date as YYYY-MM-DD in Asia/Jakarta timezone.
 */
export function formatJakartaDate(date: Date): string {
  const { year, month, day } = getJakartaDateParts(date);
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

/**
 * Format Date as YYYY-MM-DD HH:mm:ss in Asia/Jakarta timezone.
 */
export function formatJakartaDateTime(date: Date): string {
  const jakartaTime = new Date(date.getTime() + JAKARTA_OFFSET_MS);
  const year = jakartaTime.getUTCFullYear();
  const month = String(jakartaTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jakartaTime.getUTCDate()).padStart(2, "0");
  const hours = String(jakartaTime.getUTCHours()).padStart(2, "0");
  const minutes = String(jakartaTime.getUTCMinutes()).padStart(2, "0");
  const seconds = String(jakartaTime.getUTCSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Convert a Jakarta calendar date string "YYYY-MM-DD" to UTC Date representing local midnight.
 */
export function jakartaDateStringToUtc(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const localMidnightUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  return new Date(localMidnightUtc.getTime() - JAKARTA_OFFSET_MS);
}

/**
 * Given an inclusive end date string "YYYY-MM-DD", compute the exclusive upper bound
 * (the next Jakarta calendar day at midnight converted to UTC).
 */
export function jakartaDateStringToExclusiveUtcEnd(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const nextDayMidnightUtc = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));
  return new Date(nextDayMidnightUtc.getTime() - JAKARTA_OFFSET_MS);
}

/**
 * Given year & month in Jakarta, return the last calendar day number of that month (taking leap year into account).
 */
export function getDaysInJakartaMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Resolves report filter presets or custom dates into exact UTC half-open intervals [startUtc, endExclusiveUtc).
 */
export function resolveReportPeriod(
  filter: {
    preset?: ReportPreset;
    startDate?: string;
    endDate?: string;
  },
  refDate = new Date()
): ResolvedReportPeriod {
  const { year: curYear, month: curMonth } = getJakartaDateParts(refDate);
  const preset = filter.preset || (filter.startDate && filter.endDate ? "custom" : "this_month");

  if (preset === "custom" && filter.startDate && filter.endDate) {
    const startUtc = jakartaDateStringToUtc(filter.startDate);
    const endExclusiveUtc = jakartaDateStringToExclusiveUtcEnd(filter.endDate);

    const diffDays = Math.round(
      (endExclusiveUtc.getTime() - startUtc.getTime()) / (24 * 60 * 60 * 1000)
    );
    const granularity = diffDays <= 35 ? "daily" : "monthly";

    return {
      preset: "custom",
      startDate: filter.startDate,
      endDate: filter.endDate,
      startUtc,
      endExclusiveUtc,
      granularity,
      timezone: "Asia/Jakarta",
    };
  }

  let startYear = curYear;
  let startMonth = curMonth;
  let endYear = curYear;
  let endMonth = curMonth;
  let granularity: "daily" | "monthly" = "daily";

  switch (preset) {
    case "last_month": {
      granularity = "daily";
      if (curMonth === 1) {
        startYear = curYear - 1;
        startMonth = 12;
        endYear = curYear;
        endMonth = 1;
      } else {
        startYear = curYear;
        startMonth = curMonth - 1;
        endYear = curYear;
        endMonth = curMonth;
      }
      break;
    }
    case "last_3_months": {
      granularity = "monthly";
      // e.g. current is month 9 -> start is month 7, end is month 10
      const sDate = new Date(Date.UTC(curYear, curMonth - 3, 1));
      startYear = sDate.getUTCFullYear();
      startMonth = sDate.getUTCMonth() + 1;

      const eDate = new Date(Date.UTC(curYear, curMonth, 1));
      endYear = eDate.getUTCFullYear();
      endMonth = eDate.getUTCMonth() + 1;
      break;
    }
    case "last_6_months": {
      granularity = "monthly";
      const sDate = new Date(Date.UTC(curYear, curMonth - 6, 1));
      startYear = sDate.getUTCFullYear();
      startMonth = sDate.getUTCMonth() + 1;

      const eDate = new Date(Date.UTC(curYear, curMonth, 1));
      endYear = eDate.getUTCFullYear();
      endMonth = eDate.getUTCMonth() + 1;
      break;
    }
    case "this_year": {
      granularity = "monthly";
      startYear = curYear;
      startMonth = 1;
      endYear = curYear + 1;
      endMonth = 1;
      break;
    }
    case "last_year": {
      granularity = "monthly";
      startYear = curYear - 1;
      startMonth = 1;
      endYear = curYear;
      endMonth = 1;
      break;
    }
    case "this_month":
    default: {
      granularity = "daily";
      startYear = curYear;
      startMonth = curMonth;
      if (curMonth === 12) {
        endYear = curYear + 1;
        endMonth = 1;
      } else {
        endYear = curYear;
        endMonth = curMonth + 1;
      }
      break;
    }
  }

  // startUtc: midnight of day 1 of startMonth in startYear (Jakarta) -> UTC
  const startLocal = new Date(Date.UTC(startYear, startMonth - 1, 1, 0, 0, 0, 0));
  const startUtc = new Date(startLocal.getTime() - JAKARTA_OFFSET_MS);

  // endExclusiveUtc: midnight of day 1 of endMonth in endYear (Jakarta) -> UTC
  const endExclusiveLocal = new Date(Date.UTC(endYear, endMonth - 1, 1, 0, 0, 0, 0));
  const endExclusiveUtc = new Date(endExclusiveLocal.getTime() - JAKARTA_OFFSET_MS);

  // Inclusive start date string (YYYY-MM-DD)
  const startDate = `${startYear}-${String(startMonth).padStart(2, "0")}-01`;

  // Inclusive end date string (last calendar day of the preceding month)
  const lastDayOfPeriod = new Date(endExclusiveLocal.getTime() - 24 * 60 * 60 * 1000);
  const pYear = lastDayOfPeriod.getUTCFullYear();
  const pMonth = String(lastDayOfPeriod.getUTCMonth() + 1).padStart(2, "0");
  const pDay = String(lastDayOfPeriod.getUTCDate()).padStart(2, "0");
  const endDate = `${pYear}-${pMonth}-${pDay}`;

  return {
    preset,
    startDate,
    endDate,
    startUtc,
    endExclusiveUtc,
    granularity,
    timezone: "Asia/Jakarta",
  };
}

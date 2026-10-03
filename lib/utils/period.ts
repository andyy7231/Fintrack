/**
 * Period utilities for the Dashboard period selector.
 *
 * All dates are expressed as "YYYY-MM-DD" strings in Jakarta (WIB, UTC+7) local time.
 * The API converts these to UTC boundaries before querying the database.
 */

export type PeriodPreset =
  | "all"
  | "today"
  | "7d"
  | "30d"
  | "this_month"
  | "last_month"
  | "custom";

export interface Period {
  preset: PeriodPreset;
  /** Jakarta-local YYYY-MM-DD, undefined means "since first transaction" */
  start?: string;
  /** Jakarta-local YYYY-MM-DD, undefined means today */
  end?: string;
}

export const PRESET_LABELS: Record<PeriodPreset, string> = {
  all:        "Sejak pencatatan pertama",
  today:      "Hari ini",
  "7d":       "7 hari terakhir",
  "30d":      "30 hari terakhir",
  this_month: "Bulan ini",
  last_month: "Bulan lalu",
  custom:     "Custom",
};

export const PRESET_ORDER: PeriodPreset[] = [
  "all",
  "today",
  "7d",
  "30d",
  "this_month",
  "last_month",
  "custom",
];

/** Returns current date as Jakarta "YYYY-MM-DD" */
export function jakartaToday(): string {
  const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
  return new Date(Date.now() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Compute start/end YYYY-MM-DD strings for a given preset.
 * Returns { start: "all", end: today } for "all" (sentinel handled by API).
 */
export function periodToDateRange(preset: PeriodPreset): {
  start: string;
  end: string;
} {
  const today = jakartaToday();
  const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

  switch (preset) {
    case "all":
      return { start: "all", end: today };

    case "today":
      return { start: today, end: today };

    case "7d": {
      const d = new Date(Date.now() + TZ_OFFSET_MS - 6 * 86_400_000);
      return { start: d.toISOString().slice(0, 10), end: today };
    }

    case "30d": {
      const d = new Date(Date.now() + TZ_OFFSET_MS - 29 * 86_400_000);
      return { start: d.toISOString().slice(0, 10), end: today };
    }

    case "this_month": {
      const now = new Date(Date.now() + TZ_OFFSET_MS);
      const y = now.getUTCFullYear();
      const m = String(now.getUTCMonth() + 1).padStart(2, "0");
      return { start: `${y}-${m}-01`, end: today };
    }

    case "last_month": {
      const now = new Date(Date.now() + TZ_OFFSET_MS);
      let y = now.getUTCFullYear();
      let mo = now.getUTCMonth(); // 0-indexed
      if (mo === 0) { mo = 12; y -= 1; }
      const m = String(mo).padStart(2, "0");
      const lastDay = new Date(Date.UTC(y, mo, 0)).getUTCDate();
      return {
        start: `${y}-${m}-01`,
        end:   `${y}-${m}-${String(lastDay).padStart(2, "0")}`,
      };
    }

    default:
      return { start: "all", end: today };
  }
}

/** Build query string for the KPIs API */
export function buildKpisUrl(preset: PeriodPreset, customStart?: string, customEnd?: string): string {
  if (preset === "custom") {
    const s = customStart || jakartaToday();
    const e = customEnd || jakartaToday();
    return `/api/v1/dashboard/kpis?start=${s}&end=${e}`;
  }
  const { start, end } = periodToDateRange(preset);
  return `/api/v1/dashboard/kpis?start=${start}&end=${end}`;
}

/**
 * Format a Jakarta YYYY-MM-DD date string for display.
 * E.g. "2026-09-27" → "27 Sep 2026"
 */
export function formatDateDisplay(isoDate: string): string {
  if (!isoDate || isoDate === "all") return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Display label for the current period (used inside KPI cards) */
export function periodDisplayLabel(
  preset: PeriodPreset,
  firstDateStr: string,
  customStart?: string,
  customEnd?: string
): { line1: string; line2: string } {
  const today = jakartaToday();

  if (preset === "all") {
    return {
      line1: "Sejak pencatatan pertama",
      line2: firstDateStr
        ? `${formatDateDisplay(firstDateStr)} – ${formatDateDisplay(today)}`
        : "",
    };
  }

  if (preset === "custom") {
    const s = customStart || today;
    const e = customEnd || today;
    return {
      line1: "Periode custom",
      line2: `${formatDateDisplay(s)} – ${formatDateDisplay(e)}`,
    };
  }

  const { start, end } = periodToDateRange(preset);
  const label = PRESET_LABELS[preset];
  return {
    line1: label,
    line2: start === end
      ? formatDateDisplay(start)
      : `${formatDateDisplay(start)} – ${formatDateDisplay(end)}`,
  };
}

"use client";

import { useState, useEffect, useCallback, useRef, startTransition } from "react";
import {
  PeriodPreset,
  PRESET_LABELS,
  PRESET_ORDER,
  buildKpisUrl,
  periodDisplayLabel,
  jakartaToday,
} from "@/lib/utils/period";
import type { PeriodKPIs } from "@/services/dashboard.service";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CardPeriodState {
  preset: PeriodPreset;
  customStart?: string;
  customEnd?: string;
}

interface KpiData extends PeriodKPIs {
  loading: boolean;
  error: boolean;
}

interface Props {
  /** The earliest transaction date as Jakarta "YYYY-MM-DD". Used for display. */
  firstDate: string;
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function formatRp(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
}

// ─── PeriodDropdown ───────────────────────────────────────────────────────────

function PeriodDropdown({
  value,
  customStart,
  customEnd,
  onPresetChange,
  onCustomChange,
  size = "sm",
}: {
  value: PeriodPreset;
  customStart?: string;
  customEnd?: string;
  onPresetChange: (p: PeriodPreset) => void;
  onCustomChange?: (start: string, end: string) => void;
  size?: "sm" | "base";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const today = jakartaToday();
  const textSize = size === "base" ? "text-sm" : "text-xs";
  const btnPad = size === "base" ? "px-3 py-2" : "px-2 py-1";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white ${btnPad} ${textSize} font-medium text-zinc-700 shadow-xs hover:bg-zinc-50 hover:border-zinc-300 transition-all dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <svg className="h-3.5 w-3.5 text-zinc-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <rect x="2" y="2" width="12" height="12" rx="2" />
          <path d="M5 2v12M11 2v12M2 6h12M2 10h12" strokeLinecap="round" />
        </svg>
        <span className="max-w-[160px] truncate">{PRESET_LABELS[value]}</span>
        <svg className={`h-3 w-3 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 12 12" fill="currentColor">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1.5 min-w-[200px] rounded-xl border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
          {PRESET_ORDER.map((preset) => (
            <button
              key={preset}
              onClick={() => {
                onPresetChange(preset);
                if (preset !== "custom") setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-700/60 ${
                value === preset
                  ? "text-blue-600 dark:text-blue-400 font-semibold"
                  : "text-zinc-700 dark:text-zinc-200"
              }`}
            >
              {value === preset && (
                <svg className="h-3 w-3 shrink-0" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {value !== preset && <span className="w-3 shrink-0" />}
              {PRESET_LABELS[preset]}
            </button>
          ))}

          {value === "custom" && onCustomChange && (
            <div className="border-t border-zinc-100 dark:border-zinc-700 mt-1 px-3.5 pt-2 pb-2.5 space-y-2">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Pilih rentang tanggal</p>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  max={today}
                  value={customStart || today}
                  onChange={(e) => onCustomChange(e.target.value, customEnd || today)}
                  className="flex-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-800 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-zinc-400 text-xs">→</span>
                <input
                  type="date"
                  max={today}
                  min={customStart}
                  value={customEnd || today}
                  onChange={(e) => onCustomChange(customStart || today, e.target.value)}
                  className="flex-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-800 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-full rounded-lg bg-blue-600 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                Terapkan
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  prefix,
  colorClass,
  period,
  count,
  firstDate,
  onPeriodChange,
}: {
  label: string;
  value: number;
  prefix?: string;
  colorClass?: string;
  period: CardPeriodState;
  count?: number;
  firstDate: string;
  onPeriodChange: (p: CardPeriodState) => void;
}) {
  const { line1, line2 } = periodDisplayLabel(
    period.preset,
    firstDate,
    period.customStart,
    period.customEnd
  );

  return (
    <div className="group relative flex flex-col gap-1 rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs transition-shadow hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Label */}
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </p>

      {/* Value */}
      <p className={`mt-1 text-2xl font-bold tabular-nums ${colorClass || "text-zinc-900 dark:text-zinc-100"}`}>
        {prefix}
        {formatRp(value)}
      </p>

      {/* Period info */}
      <div className="mt-1.5 space-y-0.5">
        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-snug">{line1}</p>
        {line2 && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-snug">{line2}</p>
        )}
        {count !== undefined && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            {count} transaksi
          </p>
        )}
      </div>

      {/* Period override dropdown */}
      <div className="mt-2">
        <PeriodDropdown
          value={period.preset}
          customStart={period.customStart}
          customEnd={period.customEnd}
          onPresetChange={(p) =>
            onPeriodChange({ preset: p, customStart: period.customStart, customEnd: period.customEnd })
          }
          onCustomChange={(s, e) =>
            onPeriodChange({ preset: "custom", customStart: s, customEnd: e })
          }
          size="sm"
        />
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 animate-pulse">
      <div className="h-3 w-28 rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="mt-3 h-7 w-36 rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="mt-2 h-3 w-44 rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="mt-1 h-3 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
    </div>
  );
}

// ─── Main KpiSectionClient ────────────────────────────────────────────────────

export function KpiSectionClient({ firstDate }: Props) {
  const today = jakartaToday();

  // Global period (drives all cards by default)
  const [globalPreset, setGlobalPreset] = useState<PeriodPreset>("all");
  const [globalCustomStart, setGlobalCustomStart] = useState<string>(today);
  const [globalCustomEnd, setGlobalCustomEnd] = useState<string>(today);

  // Per-card overrides (undefined = follow global)
  const [incomePeriod, setIncomePeriod] = useState<CardPeriodState | null>(null);
  const [expensePeriod, setExpensePeriod] = useState<CardPeriodState | null>(null);
  const [netPeriod, setNetPeriod] = useState<CardPeriodState | null>(null);
  const [ratePeriod, setRatePeriod] = useState<CardPeriodState | null>(null);

  // KPI data per section
  const [globalData, setGlobalData] = useState<KpiData | null>(null);
  const [incomeData, setIncomeData] = useState<KpiData | null>(null);
  const [expenseData, setExpenseData] = useState<KpiData | null>(null);
  const [netData, setNetData] = useState<KpiData | null>(null);
  const [rateData, setRateData] = useState<KpiData | null>(null);

  // Fetch helper
  const fetchKpis = useCallback(async (
    preset: PeriodPreset,
    customStart?: string,
    customEnd?: string
  ): Promise<PeriodKPIs> => {
    const url = buildKpisUrl(preset, customStart, customEnd);
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch failed");
    const json = await res.json();
    return json.data as PeriodKPIs;
  }, []);

  const loadKpis = useCallback(async (
    preset: PeriodPreset,
    customStart?: string,
    customEnd?: string,
    setter: (d: KpiData) => void = () => {}
  ) => {
    setter({ income: 0, expense: 0, net: 0, transactionCount: 0, periodStart: "", periodEnd: "", loading: true, error: false });
    try {
      const data = await fetchKpis(preset, customStart, customEnd);
      setter({ ...data, loading: false, error: false });
    } catch {
      setter({ income: 0, expense: 0, net: 0, transactionCount: 0, periodStart: "", periodEnd: "", loading: false, error: true });
    }
  }, [fetchKpis]);

  // Load global data whenever global period changes; reset card overrides
  useEffect(() => {
    loadKpis(globalPreset, globalCustomStart, globalCustomEnd, setGlobalData);
    // Defer resets with startTransition to avoid cascading synchronous renders
    startTransition(() => {
      setIncomePeriod(null);
      setExpensePeriod(null);
      setNetPeriod(null);
      setRatePeriod(null);
      setIncomeData(null);
      setExpenseData(null);
      setNetData(null);
      setRateData(null);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalPreset, globalCustomStart, globalCustomEnd]);

  // Per-card fetches
  useEffect(() => {
    if (incomePeriod) {
      loadKpis(incomePeriod.preset, incomePeriod.customStart, incomePeriod.customEnd, setIncomeData);
    }
  }, [incomePeriod, loadKpis]);

  useEffect(() => {
    if (expensePeriod) {
      loadKpis(expensePeriod.preset, expensePeriod.customStart, expensePeriod.customEnd, setExpenseData);
    }
  }, [expensePeriod, loadKpis]);

  useEffect(() => {
    if (netPeriod) {
      loadKpis(netPeriod.preset, netPeriod.customStart, netPeriod.customEnd, setNetData);
    }
  }, [netPeriod, loadKpis]);

  useEffect(() => {
    if (ratePeriod) {
      loadKpis(ratePeriod.preset, ratePeriod.customStart, ratePeriod.customEnd, setRateData);
    }
  }, [ratePeriod, loadKpis]);

  // Resolve actual data per card (override or global)
  const incomeKpi = incomeData ?? globalData;
  const expenseKpi = expenseData ?? globalData;
  const netKpi = netData ?? globalData;
  const rateKpi = rateData ?? globalData;

  // Saving rate
  const savingRate = rateKpi && rateKpi.income > 0
    ? (rateKpi.net / rateKpi.income) * 100
    : 0;
  const savingRateColor = savingRate >= 20
    ? "text-emerald-600 dark:text-emerald-400"
    : savingRate >= 0
    ? "text-amber-600 dark:text-amber-400"
    : "text-red-600 dark:text-red-400";
  const netSavingsColor = (netKpi?.net ?? 0) >= 0
    ? "text-blue-600 dark:text-blue-400"
    : "text-amber-600 dark:text-amber-400";

  const globalPeriodState: CardPeriodState = {
    preset: globalPreset,
    customStart: globalCustomStart,
    customEnd: globalCustomEnd,
  };

  const { line1: gl1, line2: gl2 } = periodDisplayLabel(
    globalPreset, firstDate, globalCustomStart, globalCustomEnd
  );

  return (
    <section className="mt-8">
      {/* Global period selector header */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Periode KPI</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {gl1}{gl2 ? ` · ${gl2}` : ""}
          </p>
        </div>
        <PeriodDropdown
          value={globalPreset}
          customStart={globalCustomStart}
          customEnd={globalCustomEnd}
          onPresetChange={(p) => {
            setGlobalPreset(p);
            if (p !== "custom") {
              setGlobalCustomStart(today);
              setGlobalCustomEnd(today);
            }
          }}
          onCustomChange={(s, e) => {
            setGlobalPreset("custom");
            setGlobalCustomStart(s);
            setGlobalCustomEnd(e);
          }}
          size="base"
        />
      </div>

      {/* KPI Cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Pemasukan */}
        {incomeKpi?.loading ? <KpiSkeleton /> : (
          <KpiCard
            label="Pemasukan"
            value={incomeKpi?.income ?? 0}
            prefix="+"
            colorClass="text-emerald-600 dark:text-emerald-400"
            period={incomePeriod ?? globalPeriodState}
            count={incomeKpi?.transactionCount}
            firstDate={firstDate}
            onPeriodChange={setIncomePeriod}
          />
        )}

        {/* Pengeluaran */}
        {expenseKpi?.loading ? <KpiSkeleton /> : (
          <KpiCard
            label="Pengeluaran"
            value={expenseKpi?.expense ?? 0}
            prefix="-"
            colorClass="text-red-600 dark:text-red-400"
            period={expensePeriod ?? globalPeriodState}
            count={expenseKpi?.transactionCount}
            firstDate={firstDate}
            onPeriodChange={setExpensePeriod}
          />
        )}

        {/* Tabungan Bersih */}
        {netKpi?.loading ? <KpiSkeleton /> : (
          <KpiCard
            label="Tabungan Bersih"
            value={Math.abs(netKpi?.net ?? 0)}
            prefix={(netKpi?.net ?? 0) >= 0 ? "+" : "-"}
            colorClass={netSavingsColor}
            period={netPeriod ?? globalPeriodState}
            firstDate={firstDate}
            onPeriodChange={setNetPeriod}
          />
        )}

        {/* Tingkat Tabungan */}
        {rateKpi?.loading ? <KpiSkeleton /> : (
          <div className="group relative flex flex-col gap-1 rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs transition-shadow hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Tingkat Tabungan
            </p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${savingRateColor}`}>
              {savingRate.toFixed(1)}%
            </p>
            <div className="mt-1.5 space-y-0.5">
              {(() => {
                const { line1, line2 } = periodDisplayLabel(
                  (ratePeriod ?? globalPeriodState).preset,
                  firstDate,
                  (ratePeriod ?? globalPeriodState).customStart,
                  (ratePeriod ?? globalPeriodState).customEnd
                );
                return (
                  <>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-snug">{line1}</p>
                    {line2 && <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-snug">{line2}</p>}
                  </>
                );
              })()}
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                {rateKpi?.income === 0 ? "Tidak ada pemasukan" : "Dari pemasukan"}
              </p>
            </div>
            <div className="mt-2">
              <PeriodDropdown
                value={(ratePeriod ?? globalPeriodState).preset}
                customStart={(ratePeriod ?? globalPeriodState).customStart}
                customEnd={(ratePeriod ?? globalPeriodState).customEnd}
                onPresetChange={(p) => setRatePeriod({ preset: p })}
                onCustomChange={(s, e) => setRatePeriod({ preset: "custom", customStart: s, customEnd: e })}
                size="sm"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

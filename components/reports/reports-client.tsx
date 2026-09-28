"use client";

import { useState, useTransition, useCallback } from "react";
import type { FinancialReportDTO } from "@/services/report.service";
import type { ReportPreset } from "@/schemas/report.schema";
import { ReportSummaryCards } from "./report-summary-cards";
import { ReportTimeSeriesChart } from "./report-time-series-chart";
import { ReportCategoryBreakdown } from "./report-category-breakdown";
import { ReportAccountBreakdown } from "./report-account-breakdown";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface FilterState {
  preset: ReportPreset;
  startDate: string;
  endDate: string;
}

// ─── Preset labels ─────────────────────────────────────────────────────────────

const PRESETS: { value: ReportPreset; label: string }[] = [
  { value: "this_month", label: "Bulan Ini" },
  { value: "last_month", label: "Bulan Lalu" },
  { value: "last_3_months", label: "3 Bulan Terakhir" },
  { value: "last_6_months", label: "6 Bulan Terakhir" },
  { value: "this_year", label: "Tahun Ini" },
  { value: "last_year", label: "Tahun Lalu" },
  { value: "custom", label: "Kustom" },
];

// ─── Component ─────────────────────────────────────────────────────────────────

interface Props {
  initialReport: FinancialReportDTO;
}

export function ReportsClient({ initialReport }: Props) {
  const [report, setReport] = useState<FinancialReportDTO>(initialReport);
  const [filter, setFilter] = useState<FilterState>({
    preset: "this_month",
    startDate: "",
    endDate: "",
  });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // ─── Fetch report ───────────────────────────────────────────────────────────

  const fetchReport = useCallback(
    async (nextFilter: FilterState) => {
      setError(null);
      startTransition(async () => {
        try {
          const params = new URLSearchParams();
          params.set("preset", nextFilter.preset);
          if (nextFilter.preset === "custom") {
            if (nextFilter.startDate) params.set("startDate", nextFilter.startDate);
            if (nextFilter.endDate) params.set("endDate", nextFilter.endDate);
          }

          const res = await fetch(`/api/v1/reports?${params.toString()}`);
          const json = await res.json();
          if (!res.ok) {
            setError(json?.error?.message || "Gagal memuat laporan.");
            return;
          }
          setReport(json.data);
        } catch {
          setError("Gagal terhubung ke server.");
        }
      });
    },
    []
  );

  // ─── Handle preset change ───────────────────────────────────────────────────

  const handlePresetChange = (preset: ReportPreset) => {
    const next = { ...filter, preset };
    setFilter(next);
    if (preset !== "custom") {
      fetchReport(next);
    }
  };

  // ─── Handle custom date apply ───────────────────────────────────────────────

  const handleApplyCustom = () => {
    if (!filter.startDate || !filter.endDate) {
      setError("Pilih tanggal mulai dan akhir.");
      return;
    }
    if (filter.startDate > filter.endDate) {
      setError("Tanggal mulai tidak boleh melebihi tanggal akhir.");
      return;
    }
    fetchReport(filter);
  };

  // ─── Export ─────────────────────────────────────────────────────────────────

  const handleExport = async (format: "csv" | "xlsx") => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("preset", filter.preset);
      params.set("format", format);
      if (filter.preset === "custom") {
        if (filter.startDate) params.set("startDate", filter.startDate);
        if (filter.endDate) params.set("endDate", filter.endDate);
      }

      const res = await fetch(`/api/v1/reports/export?${params.toString()}`);
      if (!res.ok) {
        setError("Gagal mengekspor laporan.");
        return;
      }

      const disposition = res.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] || `report.${format}`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Gagal mengekspor laporan.");
    } finally {
      setIsExporting(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  const period = report.period;
  const periodLabel =
    filter.preset === "custom"
      ? `${period.startDate} — ${period.endDate}`
      : (PRESETS.find((p) => p.value === filter.preset)?.label ?? "Bulan Ini");

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Laporan Keuangan</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Periode:{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-200">
              {period.startDate} — {period.endDate} (WIB)
            </span>
          </p>
        </div>

        {/* Export buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            id="export-csv-btn"
            onClick={() => handleExport("csv")}
            disabled={isExporting || isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 shadow-xs transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <span>⬇</span>
            CSV
          </button>
          <button
            id="export-xlsx-btn"
            onClick={() => handleExport("xlsx")}
            disabled={isExporting || isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 shadow-xs transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <span>⬇</span>
            Excel
          </button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        {/* Preset pills */}
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              id={`preset-${p.value}`}
              onClick={() => handlePresetChange(p.value)}
              disabled={isPending}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                filter.preset === p.value
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date pickers */}
        {filter.preset === "custom" && (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Tanggal Mulai
              </label>
              <input
                id="custom-start-date"
                type="date"
                value={filter.startDate}
                onChange={(e) => setFilter((f) => ({ ...f, startDate: e.target.value }))}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Tanggal Akhir
              </label>
              <input
                id="custom-end-date"
                type="date"
                value={filter.endDate}
                onChange={(e) => setFilter((f) => ({ ...f, endDate: e.target.value }))}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <button
              id="apply-custom-filter-btn"
              onClick={handleApplyCustom}
              disabled={isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Terapkan
            </button>
          </div>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ── Loading overlay hint ── */}
      {isPending && (
        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <svg
            className="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Memuat laporan...
        </div>
      )}

      {/* ── Summary Cards ── */}
      <ReportSummaryCards summary={report.summary} />

      {/* ── Time Series Chart ── */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Tren Pemasukan vs Pengeluaran
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {period.granularity === "daily" ? "Harian" : "Bulanan"} — {periodLabel}
          </p>
        </div>
        <ReportTimeSeriesChart data={report.timeSeries} />
      </div>

      {/* ── Category Breakdown ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ReportCategoryBreakdown
          title="Pengeluaran per Kategori"
          items={report.categoryBreakdown.expense}
          colorScheme="expense"
        />
        <ReportCategoryBreakdown
          title="Pemasukan per Kategori"
          items={report.categoryBreakdown.income}
          colorScheme="income"
        />
      </div>

      {/* ── Account Breakdown ── */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Ringkasan per Akun
          </h2>
        </div>
        <ReportAccountBreakdown accounts={report.accountBreakdown} />
      </div>
    </div>
  );
}

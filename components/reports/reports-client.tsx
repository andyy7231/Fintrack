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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2" data-purpose="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Laporan Keuangan
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Analisis arus kas & performa keuangan:{" "}
            <span className="font-semibold text-slate-700">
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
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Ekspor CSV</span>
          </button>
          <button
            id="export-xlsx-btn"
            onClick={() => handleExport("xlsx")}
            disabled={isExporting || isPending}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Ekspor Excel</span>
          </button>
        </div>
      </div>

      {/* ── Filter Bar (Stitch Style) ── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        {/* Preset pills */}
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              id={`preset-${p.value}`}
              onClick={() => handlePresetChange(p.value)}
              disabled={isPending}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer ${
                filter.preset === p.value
                  ? "bg-[#0a1612] text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date pickers */}
        {filter.preset === "custom" && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">
                Tanggal Mulai
              </label>
              <input
                id="custom-start-date"
                type="date"
                value={filter.startDate}
                onChange={(e) => setFilter((f) => ({ ...f, startDate: e.target.value }))}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">
                Tanggal Akhir
              </label>
              <input
                id="custom-end-date"
                type="date"
                value={filter.endDate}
                onChange={(e) => setFilter((f) => ({ ...f, endDate: e.target.value }))}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
            <button
              id="apply-custom-filter-btn"
              onClick={handleApplyCustom}
              disabled={isPending}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-emerald-500/20 hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
            >
              Terapkan
            </button>
          </div>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-xl px-4 py-3 text-xs" style={{background:'rgba(255,10,84,0.07)',border:'1px solid rgba(255,10,84,0.20)',color:'#c0003b'}}>
          {error}
        </div>
      )}

      {/* ── Loading indicator ── */}
      {isPending && (
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
          <svg
            className="h-3.5 w-3.5 animate-spin text-emerald-600"
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
          Memuat data laporan keuangan...
        </div>
      )}

      {/* ── Summary Cards ── */}
      <ReportSummaryCards summary={report.summary} />

      {/* ── Time Series Chart ── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        <div className="mb-4">
          <h2 className="text-sm font-bold text-slate-900">
            Tren Pemasukan vs Pengeluaran
          </h2>
          <p className="text-[11px] text-slate-400">
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
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="flex items-center border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-bold text-slate-900">
            Ringkasan per Akun
          </h2>
        </div>
        <ReportAccountBreakdown accounts={report.accountBreakdown} />
      </div>
    </div>
  );
}

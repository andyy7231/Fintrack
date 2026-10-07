/**
 * SummaryCards Component - Stitch Design System
 * Displays aggregated income, expense, and net totals for selected period with Stitch aesthetics.
 */

import { formatCurrency } from "@/lib/utils";

export interface SummaryCardsProps {
  income: number;
  expense: number;
  net: number;
  isLoading?: boolean;
}

export function SummaryCards({
  income,
  expense,
  net,
  isLoading = false,
}: SummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="h-32 animate-pulse rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm" />
        <div className="h-32 animate-pulse rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm" />
        <div className="h-32 animate-pulse rounded-2xl bg-[#091d16] p-5 shadow-sm" />
      </div>
    );
  }

  const isNetPositive = net >= 0;

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-5" data-purpose="kpi-summary-cards">
      {/* KPI 1: Total Pemasukan */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0c2018] to-[#123125] text-white p-4 sm:p-5 border border-emerald-900/40 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-800/40 text-emerald-400 flex items-center justify-center">
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M19 14l-7 7m0 0l-7-7m7 7V3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-slate-200">Total Pemasukan</span>
          </div>
          {/* Sparkline visualization bars */}
          <div className="flex items-end gap-1 h-6">
            <span className="w-1.5 h-3 bg-emerald-800 rounded-sm" />
            <span className="w-1.5 h-4 bg-emerald-700 rounded-sm" />
            <span className="w-1.5 h-2 bg-emerald-800 rounded-sm" />
            <span className="w-1.5 h-5 bg-emerald-500 rounded-sm" />
            <span className="w-1.5 h-6 bg-emerald-400 rounded-sm" />
          </div>
        </div>
        <div className="mt-4 min-w-0">
          <p
            title={formatCurrency(income)}
            className="text-xl sm:text-2xl font-bold text-emerald-400 tracking-tight whitespace-nowrap truncate"
          >
            {formatCurrency(income)}
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-300 bg-emerald-900/50 px-2 py-0.5 rounded-full border border-emerald-800/40">
              Pemasukan
            </span>
            <span className="text-[11px] text-slate-400">periode aktif</span>
          </div>
        </div>
      </div>

      {/* KPI 2: Total Pengeluaran */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0c2018] to-[#123125] text-white p-4 sm:p-5 border border-emerald-900/40 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{background:'rgba(255,10,84,0.15)',color:'#FF0A54'}}>
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M5 10l7-7m0 0l7 7m-7-7v18" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-slate-200">Total Pengeluaran</span>
          </div>
          {/* Sparkline visualization bars */}
          <div className="flex items-end gap-1 h-6">
            <span className="w-1.5 h-5 rounded-sm" style={{background:'rgba(255,10,84,0.25)'}} />
            <span className="w-1.5 h-3 rounded-sm" style={{background:'rgba(255,10,84,0.35)'}} />
            <span className="w-1.5 h-6 rounded-sm" style={{background:'rgba(255,10,84,0.60)'}} />
            <span className="w-1.5 h-4 rounded-sm" style={{background:'rgba(255,10,84,0.75)'}} />
            <span className="w-1.5 h-5 rounded-sm" style={{background:'#FF0A54'}} />
          </div>
        </div>
        <div className="mt-4 min-w-0">
          <p
            title={formatCurrency(expense)}
            className="text-xl sm:text-2xl font-bold tracking-tight whitespace-nowrap truncate"
            style={{color:'#FF0A54'}}
          >
            {formatCurrency(expense)}
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{color:'#FF5580',background:'rgba(255,10,84,0.12)',border:'1px solid rgba(255,10,84,0.25)'}}>
              Pengeluaran
            </span>
            <span className="text-[11px] text-slate-400">periode aktif</span>
          </div>
        </div>
      </div>

      {/* KPI 3: Selisih (Net Cash Flow) — Dark Card Stitch Style */}
      <div className="bg-gradient-to-br from-[#0B251B] to-[#051710] rounded-2xl p-4 sm:p-5 text-white shadow-md shadow-emerald-950/20 flex flex-col justify-between relative overflow-hidden transition-all hover:shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isNetPositive ? "bg-emerald-500/20 text-emerald-400" : ""}`} style={!isNetPositive ? {background:'rgba(255,10,84,0.15)',color:'#FF0A54'} : {}}>
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-emerald-200/80">Selisih (Net Cash Flow)</span>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isNetPositive ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : ""}`} style={!isNetPositive ? {background:'rgba(255,10,84,0.15)',color:'#FF5580',border:'1px solid rgba(255,10,84,0.30)'} : {}}>
            {isNetPositive ? "+ Surplus" : "- Defisit"}
          </span>
        </div>
        <div className="mt-4 min-w-0">
          <p
            title={formatCurrency(net)}
            className={`text-xl sm:text-2xl font-bold tracking-tight whitespace-nowrap truncate ${isNetPositive ? "text-emerald-400" : ""}`}
            style={!isNetPositive ? {color:'#FF0A54'} : {}}
          >
            {formatCurrency(net)}
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[11px] text-slate-300 truncate">
              {isNetPositive ? "Arus kas positif bulan berjalan" : "Pengeluaran melebihi pemasukan"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import type { ReportSummary } from "@/services/report.service";

interface Props {
  summary: ReportSummary;
}

function formatIDR(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface CardProps {
  label: string;
  value: string;
  sub?: string;
  colorClass?: string;
  prefix?: string;
  id?: string;
}

function SummaryCard({ label, value, sub, colorClass, prefix, id }: CardProps) {
  const fullValue = `${prefix || ""}${value}`;
  return (
    <div
      id={id}
      className="rounded-2xl border border-emerald-900/40 bg-gradient-to-br from-[#0c2018] to-[#123125] text-white p-3.5 sm:p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
    >
      <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-300 truncate">
        {label}
      </span>
      <div className="mt-2.5 sm:mt-3 min-w-0">
        <p
          title={fullValue}
          className={`text-base min-[380px]:text-lg sm:text-xl lg:text-2xl font-extrabold tracking-tight whitespace-nowrap truncate ${colorClass || "text-white"}`}
        >
          {fullValue}
        </p>
        {sub && (
          <p className="mt-1 text-[10px] sm:text-[11px] text-slate-400 truncate">{sub}</p>
        )}
      </div>
    </div>
  );
}

export function ReportSummaryCards({ summary }: Props) {
  const netColor =
    summary.netCashFlow >= 0
      ? "text-emerald-400"
      : "text-[#FF0A54]";

  const savingsColor =
    summary.savingsRate >= 20
      ? "text-emerald-400"
      : summary.savingsRate >= 0
      ? "text-amber-400"
      : "text-[#FF0A54]";

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-6">
      <SummaryCard
        id="report-total-income"
        label="Total Pemasukan"
        value={formatIDR(summary.totalIncome)}
        colorClass="text-emerald-400"
        prefix="+"
      />
      <SummaryCard
        id="report-total-expense"
        label="Total Pengeluaran"
        value={formatIDR(summary.totalExpense)}
        colorClass="text-[#FF0A54]"
        prefix="-"
      />
      <SummaryCard
        id="report-net-cashflow"
        label="Net Cash Flow"
        value={formatIDR(Math.abs(summary.netCashFlow))}
        colorClass={netColor}
        prefix={summary.netCashFlow >= 0 ? "+" : "-"}
        sub="Pemasukan − Pengeluaran"
      />
      <SummaryCard
        id="report-savings-rate"
        label="Savings Rate"
        value={`${summary.savingsRate.toFixed(1)}%`}
        colorClass={savingsColor}
        sub={summary.totalIncome === 0 ? "Tidak ada pemasukan" : "Dari pemasukan"}
      />
      <SummaryCard
        id="report-tx-count"
        label="Jml Transaksi"
        value={summary.transactionCount.toString()}
        sub="Transaksi CONFIRMED"
      />
      <SummaryCard
        id="report-transfers"
        label="Total Transfer"
        value={formatIDR(summary.totalTransfers)}
        sub={`${summary.transfersCount} kali transfer`}
      />
    </div>
  );
}

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
  return (
    <div
      id={id}
      className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
    >
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-bold ${colorClass || "text-zinc-900 dark:text-zinc-100"}`}
      >
        {prefix}
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{sub}</p>
      )}
    </div>
  );
}

export function ReportSummaryCards({ summary }: Props) {
  const netColor =
    summary.netCashFlow >= 0
      ? "text-blue-600 dark:text-blue-400"
      : "text-amber-600 dark:text-amber-400";

  const savingsColor =
    summary.savingsRate >= 20
      ? "text-emerald-600 dark:text-emerald-400"
      : summary.savingsRate >= 0
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      <SummaryCard
        id="report-total-income"
        label="Total Pemasukan"
        value={formatIDR(summary.totalIncome)}
        colorClass="text-emerald-600 dark:text-emerald-400"
        prefix="+"
      />
      <SummaryCard
        id="report-total-expense"
        label="Total Pengeluaran"
        value={formatIDR(summary.totalExpense)}
        colorClass="text-red-600 dark:text-red-400"
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
        sub={summary.totalIncome === 0 ? "Tidak ada pemasukan" : "Dari total pemasukan"}
      />
      <SummaryCard
        id="report-tx-count"
        label="Jml Transaksi"
        value={summary.transactionCount.toString()}
        sub="Hanya transaksi CONFIRMED"
      />
      <SummaryCard
        id="report-transfers"
        label="Total Transfer"
        value={formatIDR(summary.totalTransfers)}
        sub={`${summary.transfersCount} transfer`}
      />
    </div>
  );
}

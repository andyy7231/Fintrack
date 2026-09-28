"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { TimeSeriesPoint } from "@/services/report.service";

interface Props {
  data: TimeSeriesPoint[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;

  const fmt = (v: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 min-w-[180px]">
      <p className="mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">{label}</p>
      {payload.map((entry: { name: string; value: number; color: string }, i: number) => {
        const nameMap: Record<string, string> = {
          income: "Pemasukan",
          expense: "Pengeluaran",
          net: "Net",
        };
        return (
          <p key={i} className="text-sm font-medium" style={{ color: entry.color }}>
            {nameMap[entry.name] ?? entry.name}: {fmt(entry.value)}
          </p>
        );
      })}
    </div>
  );
}

export function ReportTimeSeriesChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
        Belum ada data transaksi untuk periode ini.
      </div>
    );
  }

  const tickFormatter = (v: number) => {
    if (v === 0) return "0";
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}jt`;
    return `${(v / 1_000).toFixed(0)}rb`;
  };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradNet" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="rgba(100,116,139,0.12)"
        />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={tickFormatter}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          width={54}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(100,116,139,0.15)" }} />
        <Legend
          formatter={(value) => {
            const m: Record<string, string> = {
              income: "Pemasukan",
              expense: "Pengeluaran",
              net: "Net",
            };
            return m[value] ?? value;
          }}
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
        />
        <Area
          type="monotone"
          dataKey="income"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#gradIncome)"
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Area
          type="monotone"
          dataKey="expense"
          stroke="#f43f5e"
          strokeWidth={2}
          fill="url(#gradExpense)"
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Area
          type="monotone"
          dataKey="net"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#gradNet)"
          dot={false}
          activeDot={{ r: 4 }}
          strokeDasharray="5 3"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DailyExpensePoint } from "@/services/dashboard.service";

interface Props {
  data: DailyExpensePoint[];
}

function formatIDR(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      <p className="mb-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="text-sm font-medium" style={{color:'#FF0A54'}}>
        Pengeluaran: {formatIDR(payload[0].value)}
      </p>
    </div>
  );
}

export function DailyExpenseChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
        Belum ada data pengeluaran bulan ini.
      </div>
    );
  }

  // Decide tick density: show every 5th day to avoid crowding
  const tickInterval = data.length > 15 ? 4 : 1;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart
        data={data}
        margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
      >
        <defs>
          <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#FF0A54" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#FF0A54" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="rgba(100,116,139,0.15)"
        />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          interval={tickInterval}
        />
        <YAxis
          tickFormatter={(v) =>
            v === 0
              ? "0"
              : v >= 1_000_000
              ? `${(v / 1_000_000).toFixed(1)}jt`
              : `${(v / 1_000).toFixed(0)}rb`
          }
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,10,84,0.3)", strokeWidth: 1 }} />
        <Area
          type="monotone"
          dataKey="expense"
          stroke="#FF0A54"
          strokeWidth={2}
          fill="url(#expenseGradient)"
          dot={false}
          activeDot={{ r: 4, fill: "#FF0A54" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

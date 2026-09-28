"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { CategoryBreakdownItem } from "@/services/dashboard.service";

interface Props {
  data: CategoryBreakdownItem[];
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
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload as CategoryBreakdownItem;
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
        {item.categoryName}
      </p>
      <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-300">
        {formatIDR(item.total)}
      </p>
      <p className="text-xs text-zinc-400">{item.percentage.toFixed(1)}%</p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomLegend({ payload }: any) {
  if (!payload) return null;
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1.5">
      {payload.map(
        (entry: { value: string; color: string }, i: number) => (
          <span key={i} className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-300">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            {entry.value}
          </span>
        )
      )}
    </div>
  );
}

export function ExpenseCategoryChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
        <span className="text-3xl">🎉</span>
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Belum ada pengeluaran bulan ini
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius="52%"
          outerRadius="78%"
          paddingAngle={2}
          dataKey="total"
          nameKey="categoryName"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.categoryColor} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          content={<CustomLegend />}
          formatter={(value) => value}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

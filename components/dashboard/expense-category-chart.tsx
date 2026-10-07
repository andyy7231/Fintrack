"use client";

import { useMemo } from "react";
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

const CANONICAL_CATEGORY_COLORS: Record<string, string> = {
  "makanan & minuman": "#EF4444",
  "transportasi": "#F97316",
  "tempat tinggal": "#F59E0B",
  "tagihan & utilitas": "#EAB308",
  "tagihan": "#EAB308",
  "belanja": "#EC4899",
  "kesehatan": "#14B8A6",
  "pendidikan": "#8B5CF6",
  "hiburan": "#A855F7",
  "lainnya": "#64748B",
  "pengeluaran lain": "#9CA3AF",
  "kos": "#F59E0B",
  "gaji": "#10B981",
  "bonus": "#059669",
  "freelance": "#0D9488",
  "bisnis": "#0284C7",
  "investasi": "#7C3AED",
  "hadiah": "#6366F1",
  "pemasukan lain": "#6B7280",
};

const DIVERSE_PALETTE = [
  "#EC4899", // Belanja (Pink/Magenta)
  "#EF4444", // Makanan & Minuman (Coral Red)
  "#EAB308", // Tagihan & Utilitas (Yellow/Gold)
  "#F97316", // Transportasi (Orange)
  "#14B8A6", // Kesehatan (Teal)
  "#8B5CF6", // Pendidikan (Purple)
  "#A855F7", // Hiburan (Violet)
  "#06B6D4", // Cyan
  "#10B981", // Emerald
  "#3B82F6", // Blue
  "#F43F5E", // Rose
  "#84CC16", // Lime
  "#6366F1", // Indigo
  "#D946EF", // Fuchsia
  "#64748B", // Slate
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload as CategoryBreakdownItem & { fill?: string };
  const color = item.fill || item.categoryColor || "#10B981";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          {item.categoryName}
        </p>
      </div>
      <p className="mt-1 text-sm font-bold text-zinc-900 dark:text-zinc-100">
        {formatIDR(item.total)}
      </p>
      <p className="text-xs text-zinc-400">{item.percentage.toFixed(1)}% dari total</p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomLegend({ payload }: any) {
  if (!payload) return null;
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-x-3.5 gap-y-2">
      {payload.map(
        (entry: { value: string; color: string; payload?: { fill?: string; categoryColor?: string } }, i: number) => {
          const itemColor = entry.payload?.fill || entry.payload?.categoryColor || entry.color;
          return (
            <span key={i} className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300 font-medium">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full shrink-0 shadow-xs"
                style={{ backgroundColor: itemColor }}
              />
              {entry.value}
            </span>
          );
        }
      )}
    </div>
  );
}

export function ExpenseCategoryChart({ data }: Props) {
  // Ensure every single category is guaranteed to have a DISTINCT, unique color
  const coloredData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const usedColors = new Set<string>();

    return data.map((item, index) => {
      const normalized = (item.categoryName || "").toLowerCase().trim();
      let color = item.categoryColor;

      // If missing or generic gray fallback (#94a3b8), resolve to canonical or palette
      if (!color || color === "#94a3b8" || color.trim() === "") {
        color = CANONICAL_CATEGORY_COLORS[normalized] || DIVERSE_PALETTE[index % DIVERSE_PALETTE.length];
      }

      // If duplicate color already used by another slice in this chart, pick next unused palette color
      if (usedColors.has(color.toLowerCase())) {
        const unused = DIVERSE_PALETTE.find((c) => !usedColors.has(c.toLowerCase()));
        if (unused) {
          color = unused;
        }
      }

      usedColors.add(color.toLowerCase());

      return {
        ...item,
        categoryColor: color,
        fill: color, // Recharts uses fill for both Cell and Legend
      };
    });
  }, [data]);

  if (coloredData.length === 0) {
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
          data={coloredData}
          cx="50%"
          cy="45%"
          innerRadius="52%"
          outerRadius="78%"
          paddingAngle={2}
          dataKey="total"
          nameKey="categoryName"
        >
          {coloredData.map((entry, index) => (
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

"use client";

import { useMemo } from "react";
import type { CategoryBreakdownItem } from "@/services/report.service";

interface Props {
  title: string;
  items: CategoryBreakdownItem[];
  colorScheme: "income" | "expense";
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

export function ReportCategoryBreakdown({ title, items, colorScheme }: Props) {
  const isEmpty = items.length === 0;

  // Resolve distinct colors with deduplication
  const coloredItems = useMemo(() => {
    if (!items || items.length === 0) return [];
    const usedColors = new Set<string>();

    return items.map((item, idx) => {
      const normalized = (item.categoryName || "").toLowerCase().trim();
      let color = item.categoryColor;

      if (!color || color === "#94a3b8" || color.trim() === "") {
        color = CANONICAL_CATEGORY_COLORS[normalized] || DIVERSE_PALETTE[idx % DIVERSE_PALETTE.length];
      }

      if (usedColors.has(color.toLowerCase())) {
        const unused = DIVERSE_PALETTE.find((c) => !usedColors.has(c.toLowerCase()));
        if (unused) {
          color = unused;
        }
      }

      usedColors.add(color.toLowerCase());
      return { ...item, resolvedColor: color };
    });
  }, [items]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
      </div>

      {isEmpty ? (
        <div className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Tidak ada data untuk periode ini.
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {coloredItems.map((item, idx) => {
            const color = item.resolvedColor;
            return (
              <div key={item.categoryId ?? idx} className="px-5 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="shrink-0 text-base"
                      role="img"
                      aria-label={item.categoryName}
                    >
                      {item.categoryIcon || "🏷️"}
                    </span>
                    <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      {item.categoryName}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatIDR(item.amount)}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {item.percentage.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(item.percentage, 100)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

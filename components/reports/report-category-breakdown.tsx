"use client";

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

// Generate a default color if category has no color
function defaultColor(idx: number, scheme: "income" | "expense"): string {
  const incomeColors = [
    "#10b981", "#34d399", "#6ee7b7", "#059669", "#047857",
    "#a7f3d0", "#064e3b", "#0d9488", "#2dd4bf", "#14b8a6",
  ];
  const expenseColors = [
    "#f43f5e", "#fb7185", "#fda4af", "#e11d48", "#be123c",
    "#f87171", "#ef4444", "#dc2626", "#fca5a5", "#fecaca",
  ];
  const palette = scheme === "income" ? incomeColors : expenseColors;
  return palette[idx % palette.length];
}

export function ReportCategoryBreakdown({ title, items, colorScheme }: Props) {
  const isEmpty = items.length === 0;

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
          {items.map((item, idx) => {
            const color = item.categoryColor || defaultColor(idx, colorScheme);
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

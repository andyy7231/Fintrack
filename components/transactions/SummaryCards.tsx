/**
 * SummaryCards Component
 *
 * Displays aggregated income, expense, and net totals for selected period.
 *
 * Requirements covered: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 8.1, 8.2, 10.1, 10.2
 */

import { formatCurrency } from "@/lib/utils";

export interface SummaryCardsProps {
  income: number; // Total income in selected period
  expense: number; // Total expense in selected period
  net: number; // income - expense
  isLoading?: boolean; // Show skeleton state during fetch
}

export function SummaryCards({
  income,
  expense,
  net,
  isLoading = false,
}: SummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Income Skeleton */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-zinc-200" />
            <div className="h-8 w-40 animate-pulse rounded bg-zinc-200" />
          </div>
        </div>

        {/* Expense Skeleton */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-zinc-200" />
            <div className="h-8 w-40 animate-pulse rounded bg-zinc-200" />
          </div>
        </div>

        {/* Net Skeleton */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
            <div className="h-8 w-40 animate-pulse rounded bg-zinc-200" />
          </div>
        </div>
      </div>
    );
  }

  // Determine net color based on value
  const netColor =
    net > 0
      ? "text-emerald-600"
      : net < 0
        ? "text-red-600"
        : "text-zinc-600";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {/* Income Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs transition-shadow hover:shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-600">Total Pemasukan</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-600">
              {formatCurrency(income)}
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
            <span className="text-2xl text-emerald-600">↑</span>
          </div>
        </div>
      </div>

      {/* Expense Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs transition-shadow hover:shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-600">Total Pengeluaran</p>
            <p className="mt-2 text-2xl font-semibold text-red-600">
              {formatCurrency(expense)}
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <span className="text-2xl text-red-600">↓</span>
          </div>
        </div>
      </div>

      {/* Net Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs transition-shadow hover:shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-600">Selisih</p>
            <p className={`mt-2 text-2xl font-semibold ${netColor}`}>
              {formatCurrency(net)}
            </p>
          </div>
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full ${
              net > 0
                ? "bg-emerald-50"
                : net < 0
                  ? "bg-red-50"
                  : "bg-zinc-50"
            }`}
          >
            <span className={`text-2xl ${netColor}`}>=</span>
          </div>
        </div>
      </div>
    </div>
  );
}

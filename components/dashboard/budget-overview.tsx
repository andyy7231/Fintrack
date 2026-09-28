"use client";

import type { BudgetProgressDTO } from "@/services/budget.service";
import { formatCurrency } from "@/lib/utils";

interface BudgetOverviewProps {
  budgets: BudgetProgressDTO[];
}

function BudgetBar({
  percentage,
  isOverBudget,
}: {
  percentage: number;
  isOverBudget: boolean;
}) {
  return (
    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
      <div
        className={`h-2 rounded-full transition-all duration-500 ${
          isOverBudget
            ? "bg-red-500"
            : percentage >= 80
            ? "bg-amber-500"
            : "bg-emerald-500"
        }`}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
  );
}

export function BudgetOverview({ budgets }: BudgetOverviewProps) {
  if (budgets.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Belum ada budget yang dibuat.
        </p>
        <a
          href="/budgets"
          className="mt-3 inline-block rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        >
          + Buat Budget
        </a>
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {budgets.map((b) => (
        <div key={b.id} className="px-5 py-4 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors">
          <div className="flex items-start justify-between gap-2">
            {/* Category */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {b.categoryIcon && (
                  <span className="text-base">{b.categoryIcon}</span>
                )}
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: b.categoryColor ?? "#94a3b8" }}
                />
                <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  {b.categoryName}
                </p>
              </div>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {b.periodType === "MONTHLY" ? "Bulanan" : "Kustom"}
              </p>
            </div>

            {/* Amounts */}
            <div className="shrink-0 text-right">
              <p
                className={`text-sm font-semibold ${
                  b.isOverBudget
                    ? "text-red-600 dark:text-red-400"
                    : "text-zinc-900 dark:text-zinc-100"
                }`}
              >
                {formatCurrency(b.spentAmount)}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                / {formatCurrency(b.limitAmount)}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <BudgetBar
            percentage={b.displayPercentage}
            isOverBudget={b.isOverBudget}
          />

          {/* Status label */}
          <div className="mt-1 flex items-center justify-between">
            <span
              className={`text-xs font-medium ${
                b.isOverBudget
                  ? "text-red-600 dark:text-red-400"
                  : b.usagePercentage >= 80
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {b.isOverBudget
                ? `⚠ Melebihi ${formatCurrency(Math.abs(b.remainingAmount))}`
                : `Sisa ${formatCurrency(b.remainingAmount)}`}
            </span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {b.usagePercentage.toFixed(0)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

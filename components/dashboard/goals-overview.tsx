"use client";

import type { GoalDTO } from "@/services/goal.service";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

interface GoalsOverviewProps {
  goals: GoalDTO[];
}

function GoalProgressBar({ percentage }: { percentage: number }) {
  return (
    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
      <div
        className={`h-2 rounded-full transition-all duration-500 ${
          percentage >= 100
            ? "bg-emerald-500"
            : percentage >= 50
            ? "bg-blue-600 dark:bg-blue-500"
            : "bg-indigo-500"
        }`}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
  );
}

export function GoalsOverview({ goals }: GoalsOverviewProps) {
  if (goals.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Belum ada target keuangan aktif.
        </p>
        <Link
          href="/goals"
          className="mt-3 inline-block rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        >
          + Buat Target Keuangan
        </Link>
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {goals.map((g) => {
        const targetDateFormatted = new Date(g.targetDate).toLocaleDateString("id-ID", {
          month: "short",
          year: "numeric",
          timeZone: "Asia/Jakarta",
        });

        return (
          <div
            key={g.id}
            className="px-5 py-4 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/goals/${g.id}`}
                  className="font-medium text-sm text-zinc-900 hover:text-blue-600 dark:text-zinc-100 dark:hover:text-blue-400 truncate block"
                >
                  {g.name}
                </Link>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>Target: {targetDateFormatted}</span>
                  {g.isOverdue ? (
                    <span className="font-medium text-red-600 dark:text-red-400">
                      • Terlewat deadline
                    </span>
                  ) : g.daysRemaining > 0 ? (
                    <span>• {g.daysRemaining} hari lagi</span>
                  ) : null}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(g.contributedAmount)}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  / {formatCurrency(g.targetAmount)}
                </p>
              </div>
            </div>

            <GoalProgressBar percentage={g.displayPercentage} />

            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-zinc-500 dark:text-zinc-400">
                {g.remainingAmount > 0
                  ? `Sisa ${formatCurrency(g.remainingAmount)}`
                  : "Target tercapai 🎉"}
              </span>
              <span className="font-medium text-blue-600 dark:text-blue-400">
                {g.progressPercentage.toFixed(0)}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

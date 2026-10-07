"use client";

import type { GoalDTO } from "@/services/goal.service";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

interface GoalsOverviewProps {
  goals: GoalDTO[];
}

export function GoalsOverview({ goals }: GoalsOverviewProps) {
  if (goals.length === 0) {
    return (
      <div className="py-8 text-center px-6">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </div>
        <p className="text-sm text-slate-500">Belum ada target keuangan aktif.</p>
        <Link
          href="/goals"
          className="mt-3 inline-block rounded-xl bg-[#00c076] px-4 py-2 text-xs font-bold text-[#071A14] hover:bg-[#00a866] transition-colors"
        >
          + Buat Target Keuangan
        </Link>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {goals.map((g) => {
        const targetDateFormatted = new Date(g.targetDate).toLocaleDateString("id-ID", {
          month: "short",
          year: "numeric",
          timeZone: "Asia/Jakarta",
        });

        return (
          <div key={g.id} className="px-5 py-4 hover:bg-slate-50/60 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/goals/${g.id}`}
                  className="font-semibold text-sm text-slate-800 hover:text-emerald-600 truncate block transition-colors"
                >
                  {g.name}
                </Link>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                  <span>Target: {targetDateFormatted}</span>
                  {g.isOverdue ? (
                    <span className="font-medium" style={{color:'#FF0A54'}}>• Terlewat deadline</span>
                  ) : g.daysRemaining > 0 ? (
                    <span>• {g.daysRemaining} hari lagi</span>
                  ) : null}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold text-slate-900">{formatCurrency(g.contributedAmount)}</p>
                <p className="text-xs text-slate-400">/ {formatCurrency(g.targetAmount)}</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  g.displayPercentage >= 100 ? "bg-[#00c076]" : g.displayPercentage >= 50 ? "bg-[#00c076]" : "bg-emerald-400"
                }`}
                style={{ width: `${Math.min(g.displayPercentage, 100)}%` }}
              />
            </div>

            <div className="mt-1.5 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                {g.remainingAmount > 0 ? `Sisa ${formatCurrency(g.remainingAmount)}` : "Target tercapai 🎉"}
              </span>
              <span className="font-semibold text-emerald-600">{g.progressPercentage.toFixed(0)}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

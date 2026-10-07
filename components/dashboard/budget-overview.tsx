"use client";

import type { BudgetProgressDTO } from "@/services/budget.service";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

interface BudgetOverviewProps {
  budgets: BudgetProgressDTO[];
}

function getPeriodTypeLabel(periodType: string): string {
  switch (periodType) {
    case "MONTHLY": return "Bulanan";
    case "ROLLING_30_DAYS": return "30 Hari";
    case "ROLLING_7_DAYS": return "7 Hari";
    case "ROLLING_90_DAYS": return "90 Hari";
    case "CUSTOM": return "Custom";
    default: return periodType;
  }
}

export function BudgetOverview({ budgets }: BudgetOverviewProps) {
  if (budgets.length === 0) {
    return (
      <div className="py-8 text-center px-6">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </div>
        <p className="text-sm text-slate-500">Belum ada budget yang dibuat.</p>
        <Link
          href="/budgets"
          className="mt-3 inline-block rounded-xl bg-[#00c076] px-4 py-2 text-xs font-bold text-[#071A14] hover:bg-[#00a866] transition-colors"
        >
          + Buat Budget
        </Link>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {budgets.map((b) => (
        <div key={b.id} className="px-5 py-4 hover:bg-slate-50/60 transition-colors">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {b.categoryIcon && <span className="text-base">{b.categoryIcon}</span>}
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: b.categoryColor ?? "#94a3b8" }}
                />
                <p className="truncate text-sm font-semibold text-slate-800">{b.categoryName}</p>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">{getPeriodTypeLabel(b.periodType)}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className={`text-sm font-bold ${b.isOverBudget ? "" : "text-slate-900"}`} style={b.isOverBudget ? {color:'#FF0A54'} : {}}>
                {formatCurrency(b.spentAmount)}
              </p>
              <p className="text-xs text-slate-400">/ {formatCurrency(b.limitAmount)}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${
                b.isOverBudget ? "" : b.usagePercentage >= 80 ? "bg-amber-500" : "bg-[#00c076]"
              }`}
              style={{ width: `${Math.min(b.displayPercentage, 100)}%`, ...(b.isOverBudget ? { background: '#FF0A54' } : {}) }}
            />
          </div>

          <div className="mt-1.5 flex items-center justify-between">
            <span className={`text-xs font-medium ${b.isOverBudget ? "" : b.usagePercentage >= 80 ? "text-amber-600" : "text-slate-500"}`} style={b.isOverBudget ? {color:'#FF0A54'} : {}}>
              {b.isOverBudget
                ? `⚠ Melebihi ${formatCurrency(Math.abs(b.remainingAmount))}`
                : `Sisa ${formatCurrency(b.remainingAmount)}`}
            </span>
            <span className="text-xs text-slate-400">{b.usagePercentage.toFixed(0)}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}
"use client";

import { useState, useTransition, useMemo } from "react";
import { formatCurrency } from "@/lib/utils";
import type { BudgetProgressDTO } from "@/services/budget.service";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  type: string;
}

interface BudgetsClientProps {
  initialBudgets: BudgetProgressDTO[];
  expenseCategories: Category[];
}

type PeriodType = "MONTHLY" | "ROLLING_7_DAYS" | "ROLLING_30_DAYS" | "ROLLING_90_DAYS" | "CUSTOM";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function now() {
  const d = new Date();
  return {
    year: parseInt(
      d.toLocaleDateString("en-US", { timeZone: "Asia/Jakarta", year: "numeric" })
    ),
    month: parseInt(
      d.toLocaleDateString("en-US", { timeZone: "Asia/Jakarta", month: "numeric" })
    ),
    date: d.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }), // YYYY-MM-DD
  };
}

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function getPeriodTypeLabel(periodType: string): string {
  switch (periodType) {
    case "MONTHLY": return "Budget Bulanan";
    case "ROLLING_30_DAYS": return "Budget 30 Hari";
    case "ROLLING_7_DAYS": return "Budget 7 Hari";
    case "ROLLING_90_DAYS": return "Budget 90 Hari";
    case "CUSTOM": return "Budget Custom";
    default: return periodType;
  }
}

function formatIndonesianDate(date: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const d = new Date(date);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function getRemainingDays(endDate: Date): number {
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
  return Math.max(0, days);
}

function calculateRollingPeriodPreview(startDate: string | null, durationDays: number): { start: string; end: string } {
  const start = startDate ? new Date(startDate + "T00:00:00") : new Date();
  const end = new Date(start.getTime() + durationDays * 24 * 60 * 60 * 1000);
  
  // FIX 1: Display last included date (end - 1 day) since backend uses exclusive upper bound
  const displayEnd = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  
  return {
    start: formatIndonesianDate(start),
    end: formatIndonesianDate(displayEnd),
  };
}

// ─── Progress bar ───────────────────────────────────────────────────────────────

function ProgressBar({ pct, over }: { pct: number; over: boolean }) {
  const color = over ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
      <div
        className={`h-2 rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

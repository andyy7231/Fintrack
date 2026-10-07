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

export interface AccountOption {
  id: string;
  name: string;
  type: string;
  currency: string;
  currentBalance: number;
}

interface BudgetsClientProps {
  initialBudgets: BudgetProgressDTO[];
  expenseCategories: Category[];
  accounts: AccountOption[];
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
    date: d.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }),
  };
}

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

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

function toSafeDate(date: Date | string): Date {
  return date instanceof Date ? date : new Date(date);
}

function formatIndonesianDate(date: Date | string): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const d = toSafeDate(date);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function getRemainingDays(endDate: Date | string): number {
  const end = toSafeDate(endDate);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
  return Math.max(0, days);
}

function calculateRollingPeriodPreview(startDate: string | null, durationDays: number): { start: string; end: string } {
  const start = startDate ? new Date(startDate + "T00:00:00") : new Date();
  const end = new Date(start.getTime() + durationDays * 24 * 60 * 60 * 1000);
  const displayEnd = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  
  return {
    start: formatIndonesianDate(start),
    end: formatIndonesianDate(displayEnd),
  };
}

function getDefaultAccountId(accounts: AccountOption[]): string {
  if (accounts.length === 0) return "";
  const cashAcc = accounts.find((a) => a.type === "CASH");
  if (cashAcc) return cashAcc.id;
  return accounts[0]?.id ?? "";
}

// ─── Progress bar ───────────────────────────────────────────────────────────────

function ProgressBar({ pct, over }: { pct: number; over: boolean }) {
  const color = over ? "" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-2 rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(pct, 100)}%`, ...(over ? { background: '#FF0A54' } : {}) }}
      />
    </div>
  );
}

// ─── Budget Card ────────────────────────────────────────────────────────────────

function BudgetCard({
  budget,
  accounts,
  onDelete,
}: {
  budget: BudgetProgressDTO;
  accounts?: AccountOption[];
  onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/v1/budgets/${budget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onDelete(budget.id);
      }
      setConfirming(false);
    });
  };

  const periodLabel = getPeriodTypeLabel(budget.periodType);
  const endDateObj = toSafeDate(budget.endDate);
  const displayEndDate = new Date(endDateObj.getTime() - 24 * 60 * 60 * 1000);
  const periodRange = `${formatIndonesianDate(budget.startDate)} - ${formatIndonesianDate(displayEndDate)}`;
  const remainingDays = getRemainingDays(budget.endDate);
  const fundingAccount = accounts?.find((a) => a.id === (budget as { accountId?: string | null }).accountId);

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-md transition-all">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
              style={{
                backgroundColor: budget.categoryColor ? `${budget.categoryColor}15` : "#e8fdf3",
                color: budget.categoryColor || "#10B981",
              }}
            >
              {budget.categoryIcon || "🏷️"}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 truncate">
                {budget.categoryName}
              </h3>
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                  {periodLabel}
                </span>
                {fundingAccount && (
                  <span className="text-[10px] text-slate-400">
                    • {fundingAccount.name}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className={`cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              confirming
                ? "bg-[#FF0A54] text-white hover:bg-[#d50040]"
                : "text-slate-400 hover:text-[#FF0A54] hover:bg-[rgba(255,10,84,0.08)]"
            }`}
          >
            {isPending ? "..." : confirming ? "Konfirmasi Hapus" : "Hapus"}
          </button>
        </div>

        {/* Period Range & Days Left */}
        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100 pt-2.5">
          <span>{periodRange}</span>
          <span className={`font-semibold ${remainingDays <= 3 ? "text-amber-600" : "text-slate-500"}`}>
            {remainingDays > 0 ? `${remainingDays} hari tersisa` : "Berakhir"}
          </span>
        </div>

        {/* Amounts */}
        <div className="mt-4 flex items-baseline justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Terpakai</span>
            <p className={`text-xl font-bold tracking-tight ${budget.isOverBudget ? "" : "text-slate-900"}`} style={budget.isOverBudget ? {color:'#FF0A54'} : {}}>
              {formatCurrency(budget.spentAmount)}
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Batas</span>
            <p className="text-sm font-semibold text-slate-600">
              {formatCurrency(budget.limitAmount)}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <ProgressBar pct={budget.displayPercentage} over={budget.isOverBudget} />
      </div>

      {/* Status Footer */}
      <div className="mt-3.5 flex items-center justify-between text-xs pt-2.5 border-t border-slate-100">
        <span
          className={`font-semibold text-[11px] ${
            budget.isOverBudget
              ? ""
              : budget.usagePercentage >= 80
              ? "text-amber-600"
              : "text-emerald-600"
          }`}
          style={budget.isOverBudget ? {color:'#FF0A54'} : {}}
        >
          {budget.isOverBudget
            ? `⚠ Melebihi ${formatCurrency(Math.abs(budget.remainingAmount))}`
            : `Sisa ${formatCurrency(budget.remainingAmount)}`}
        </span>
        <span className="font-bold text-slate-500 text-[11px]">
          {budget.usagePercentage.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

// ─── Create Budget Form Modal ───────────────────────────────────────────────────

function CreateBudgetModal({
  categories,
  accounts,
  onClose,
  onCreated,
}: {
  categories: Category[];
  accounts: AccountOption[];
  onClose: () => void;
  onCreated: (budget: BudgetProgressDTO) => void;
}) {
  const { year: thisYear, month: thisMonth, date: today } = now();

  const [periodType, setPeriodType] = useState<PeriodType>("ROLLING_30_DAYS");
  const [accountId, setAccountId] = useState(() => getDefaultAccountId(accounts));
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [year, setYear] = useState(thisYear);
  const [month, setMonth] = useState(thisMonth);
  const [startDate, setStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const periodPreview = useMemo(() => {
    if (periodType === "ROLLING_7_DAYS") {
      return calculateRollingPeriodPreview(startDate || null, 7);
    } else if (periodType === "ROLLING_30_DAYS") {
      return calculateRollingPeriodPreview(startDate || null, 30);
    } else if (periodType === "ROLLING_90_DAYS") {
      return calculateRollingPeriodPreview(startDate || null, 90);
    }
    return null;
  }, [periodType, startDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!accountId) {
      setError("Pilih akun sumber dana terlebih dahulu");
      return;
    }

    type RequestBody = 
      | { periodType: "MONTHLY"; accountId: string; categoryId: string; amount: number; year: number; month: number }
      | { periodType: "CUSTOM"; accountId: string; categoryId: string; amount: number; startDate: string; endDate: string }
      | { periodType: "ROLLING_7_DAYS" | "ROLLING_30_DAYS" | "ROLLING_90_DAYS"; accountId: string; categoryId: string; amount: number; startDate?: string };
    
    let body: RequestBody;
    
    if (periodType === "MONTHLY") {
      body = { periodType, accountId, categoryId, amount: parseFloat(amount), year, month };
    } else if (periodType === "CUSTOM") {
      if (!startDate || !customEndDate) {
        setError("Tanggal mulai dan tanggal akhir wajib diisi");
        return;
      }
      body = { periodType, accountId, categoryId, amount: parseFloat(amount), startDate, endDate: customEndDate };
    } else {
      body = {
        periodType,
        accountId,
        categoryId,
        amount: parseFloat(amount),
        ...(startDate ? { startDate } : {}),
      };
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/budgets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error?.message ?? "Gagal membuat budget");
          return;
        }

        onCreated(data.data);
        onClose();
      } catch {
        setError("Terjadi kesalahan jaringan");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">
            Buat Budget Baru
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Period Type Selection Pills */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Tipe Periode Budget
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 rounded-xl bg-slate-100 p-1">
              {(
                [
                  "ROLLING_30_DAYS",
                  "MONTHLY",
                  "ROLLING_7_DAYS",
                  "ROLLING_90_DAYS",
                  "CUSTOM",
                ] as PeriodType[]
              ).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPeriodType(t)}
                  className={`rounded-lg py-1.5 text-[11px] font-bold transition-all ${
                    periodType === t
                      ? "bg-white text-emerald-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {t === "ROLLING_30_DAYS" && "30 Hari"}
                  {t === "MONTHLY" && "Bulanan"}
                  {t === "ROLLING_7_DAYS" && "7 Hari"}
                  {t === "ROLLING_90_DAYS" && "90 Hari"}
                  {t === "CUSTOM" && "Custom"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Funding Account */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Akun Sumber Dana
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} • {formatCurrency(acc.currentBalance, acc.currency)}
                  </option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kategori Pengeluaran
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon ? `${c.icon} ` : ""}{c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Period-specific fields */}
            {periodType === "MONTHLY" ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Bulan
                  </label>
                  <select
                    value={month}
                    onChange={(e) => setMonth(parseInt(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    {MONTH_NAMES.map((name, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tahun
                  </label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value))}
                    min={2020}
                    max={2100}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </>
            ) : periodType === "CUSTOM" ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Akhir
                  </label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </>
            ) : (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tanggal Mulai (Opsional)
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder={today}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Kosongkan untuk mulai hari ini
                </p>
              </div>
            )}

            {/* Amount */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Batas Budget (IDR)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={1}
                required
                placeholder="Contoh: 1500000"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Period Preview */}
          {periodPreview && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200/80 px-3 py-2 text-xs text-emerald-800">
              <strong>Preview Periode:</strong> {periodPreview.start} – {periodPreview.end}
              {periodType === "ROLLING_7_DAYS" && " (7 hari)"}
              {periodType === "ROLLING_30_DAYS" && " (30 hari)"}
              {periodType === "ROLLING_90_DAYS" && " (90 hari)"}
            </div>
          )}

          {error && (
            <p className="rounded-xl px-3 py-2 text-xs" style={{background:'rgba(255,10,84,0.07)',border:'1px solid rgba(255,10,84,0.20)',color:'#c0003b'}}>
              {error}
            </p>
          )}

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending || categories.length === 0 || accounts.length === 0}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-sm shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
            >
              {isPending ? "Menyimpan…" : "Simpan Budget"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Client Component ──────────────────────────────────────────────────────

export function BudgetsClient({ initialBudgets, expenseCategories, accounts }: BudgetsClientProps) {
  const [budgets, setBudgets] = useState<BudgetProgressDTO[]>(initialBudgets);
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "SAFE" | "NEAR" | "OVER">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"PERCENT_DESC" | "AMOUNT_DESC" | "REMAINING_ASC" | "NAME">("PERCENT_DESC");

  const handleCreated = (budget: BudgetProgressDTO) => {
    setBudgets((prev) => [budget, ...prev]);
  };

  const handleDeleted = (id: string) => {
    setBudgets((prev) => prev.filter((b) => b.id !== id));
  };

  // Calculations for KPI Cards
  const totalBudget = useMemo(() => budgets.reduce((acc, b) => acc + b.limitAmount, 0), [budgets]);
  const totalSpent = useMemo(() => budgets.reduce((acc, b) => acc + b.spentAmount, 0), [budgets]);
  const totalRemaining = totalBudget - totalSpent;
  const totalPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  // Account balances & Free cash
  const totalAccountBalance = useMemo(
    () => accounts.reduce((acc, a) => acc + a.currentBalance, 0),
    [accounts]
  );
  const freeCash = Math.max(0, totalAccountBalance - totalBudget);

  const overBudgetCount = budgets.filter((b) => b.isOverBudget).length;
  const nearLimitCount = budgets.filter((b) => !b.isOverBudget && b.usagePercentage >= 80).length;
  const safeCount = budgets.filter((b) => !b.isOverBudget && b.usagePercentage < 80).length;

  // Filtering & Sorting
  const filteredBudgets = useMemo(() => {
    return budgets
      .filter((b) => {
        if (statusFilter === "SAFE" && (b.isOverBudget || b.usagePercentage >= 80)) return false;
        if (statusFilter === "NEAR" && (b.isOverBudget || b.usagePercentage < 80)) return false;
        if (statusFilter === "OVER" && !b.isOverBudget) return false;
        if (searchQuery.trim() && !b.categoryName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "PERCENT_DESC") return b.usagePercentage - a.usagePercentage;
        if (sortBy === "AMOUNT_DESC") return b.limitAmount - a.limitAmount;
        if (sortBy === "REMAINING_ASC") return a.remainingAmount - b.remainingAmount;
        if (sortBy === "NAME") return a.categoryName.localeCompare(b.categoryName);
        return 0;
      });
  }, [budgets, statusFilter, searchQuery, sortBy]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-2" data-purpose="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Manajemen Budget
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Alokasikan batas belanja per kategori & pantau realisasi keuangan
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-emerald-500/20 transition cursor-pointer"
        >
          <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>+ Buat Budget</span>
        </button>
      </header>

      {/* Top KPI Cards (Stitch Style) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5" data-purpose="kpi-summary-grid">
        {/* 1. Total Budget Card */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 truncate">Total Budget</span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <div className="mt-3 min-w-0">
            <div
              title={formatCurrency(totalBudget)}
              className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight whitespace-nowrap truncate"
            >
              {formatCurrency(totalBudget)}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-slate-400 text-[11px] truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">{budgets.length} Budget Aktif</span>
            </div>
          </div>
        </div>

        {/* 2. Terpakai (Spent) Card */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 truncate">Terpakai (Realisasi)</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <div className="mt-3 min-w-0">
            <div className="flex items-baseline gap-2 min-w-0">
              <span
                title={formatCurrency(totalSpent)}
                className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight whitespace-nowrap truncate"
              >
                {formatCurrency(totalSpent)}
              </span>
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/70 shrink-0">
                {totalPercentage.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-slate-400 text-[11px] truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              <span className="truncate">Total realisasi belanja</span>
            </div>
          </div>
        </div>

        {/* 3. Sisa Budget (Remaining) Card */}
        <div className="bg-emerald-50/50 rounded-2xl p-4 sm:p-5 border border-emerald-200/70 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800 truncate">Sisa Budget Tersedia</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <div className="mt-3 min-w-0">
            <div className="flex items-baseline gap-2 min-w-0">
              <span
                title={formatCurrency(totalRemaining)}
                className={`text-xl sm:text-2xl font-bold tracking-tight whitespace-nowrap truncate ${totalRemaining >= 0 ? "text-emerald-700" : ""}`}
                style={totalRemaining < 0 ? {color:'#FF0A54'} : {}}
              >
                {totalRemaining >= 0 ? "+ " : ""}{formatCurrency(totalRemaining)}
              </span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                {(100 - Math.min(totalPercentage, 100)).toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-emerald-700/80 text-[11px] truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">Kapasitas belanja aman</span>
            </div>
          </div>
        </div>
      </section>

      {/* FreeCashContextCallout (Dark Banner Stitch Style) */}
      <section className="bg-gradient-to-r from-[#10221c] to-[#0a1612] text-white rounded-2xl p-5 border border-[#1b382d] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-sm" data-purpose="accounting-context-callout">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
              Prinsip Alokasi Kas & Komitmen FinTrack
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-2xl">
              Pengeluaran riil memotong budget kategori & saldo riil, sementara alokasi budget menjaga ketersediaan <span className="text-white font-semibold">Free Cash</span> tanpa pemotongan saldo ganda.
            </p>
          </div>
        </div>
        {/* Live Metric Pills */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <div className="bg-[#162b24] px-3.5 py-2 rounded-xl border border-[#214337] text-left">
            <div className="text-[10px] text-slate-400 font-medium">Saldo Akun</div>
            <div className="text-xs font-bold text-white">{formatCurrency(totalAccountBalance)}</div>
          </div>
          <div className="bg-[#162b24] px-3.5 py-2 rounded-xl border border-[#214337] text-left">
            <div className="text-[10px] text-slate-400 font-medium">Komitmen Budget</div>
            <div className="text-xs font-bold text-amber-300">{formatCurrency(totalBudget)}</div>
          </div>
          <div className="bg-[#162b24] px-3.5 py-2 rounded-xl border border-[#214337] text-left">
            <div className="text-[10px] text-slate-400 font-medium">Free Cash Tersedia</div>
            <div className="text-xs font-bold text-emerald-400">{formatCurrency(freeCash)}</div>
          </div>
        </div>
      </section>

      {/* ControlsToolbar (Filter, Search, Sort) */}
      <section className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search category input */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <input
              type="text"
              placeholder="Cari budget kategori..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl pl-8 pr-3 py-2 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
            <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                statusFilter === "ALL"
                  ? "bg-[#0a1612] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Semua ({budgets.length})
            </button>
            <button
              onClick={() => setStatusFilter("SAFE")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                statusFilter === "SAFE"
                  ? "bg-emerald-600 text-white font-bold"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              Aman ({safeCount})
            </button>
            <button
              onClick={() => setStatusFilter("NEAR")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                statusFilter === "NEAR"
                  ? "bg-amber-600 text-white font-bold"
                  : "bg-amber-50 text-amber-700 hover:bg-amber-100"
              }`}
            >
              Mendekati Batas ({nearLimitCount})
            </button>
            <button
              onClick={() => setStatusFilter("OVER")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                statusFilter === "OVER"
                  ? "text-white font-bold"
                  : "text-xs font-medium"
              }`}
              style={statusFilter === "OVER"
                ? {background:'#FF0A54'}
                : {background:'rgba(255,10,84,0.08)',color:'#FF0A54'}}
            >
              Melebihi ({overBudgetCount})
            </button>
          </div>
        </div>

        {/* Sorting selector */}
        <div className="flex items-center gap-2 justify-end">
          <label className="text-xs text-slate-500 font-medium whitespace-nowrap">Urutkan:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          >
            <option value="PERCENT_DESC">Persentase Tertinggi</option>
            <option value="AMOUNT_DESC">Nominal Terbesar</option>
            <option value="REMAINING_ASC">Sisa Paling Sedikit</option>
            <option value="NAME">Nama (A - Z)</option>
          </select>
        </div>
      </section>

      {/* Empty State or Grid */}
      {accounts.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-xs text-slate-500">
            Belum ada akun keuangan. Buat akun terlebih dahulu untuk mengalokasikan budget.
          </p>
          <a
            href="/accounts"
            className="mt-3 inline-block rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
          >
            Kelola Akun
          </a>
        </div>
      ) : expenseCategories.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-xs text-slate-500">
            Belum ada kategori Expense. Buat kategori terlebih dahulu.
          </p>
          <a
            href="/categories"
            className="mt-3 inline-block rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
          >
            Kelola Kategori
          </a>
        </div>
      ) : filteredBudgets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-12 text-center">
          <p className="text-xs font-semibold text-slate-600">
            Tidak ada budget yang sesuai filter.
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Klik tombol &quot;+ Buat Budget&quot; untuk menambahkan rencana pengeluaran.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredBudgets.map((b) => (
            <BudgetCard key={b.id} budget={b} accounts={accounts} onDelete={handleDeleted} />
          ))}
        </div>
      )}

      {/* Modal Buat Budget */}
      {showModal && (
        <CreateBudgetModal
          categories={expenseCategories}
          accounts={accounts}
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
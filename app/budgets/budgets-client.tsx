"use client";

import { useState, useTransition } from "react";
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
  };
}

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

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

// ─── Budget Card ────────────────────────────────────────────────────────────────

function BudgetCard({
  budget,
  onDelete,
}: {
  budget: BudgetProgressDTO;
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

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {budget.categoryIcon && <span className="text-xl">{budget.categoryIcon}</span>}
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: budget.categoryColor ?? "#94a3b8" }}
          />
          <div className="min-w-0">
            <p className="truncate font-semibold text-zinc-900 dark:text-zinc-100">
              {budget.categoryName}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {budget.periodType === "MONTHLY" ? "Budget Bulanan" : "Budget Kustom"}
            </p>
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
            confirming
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          }`}
        >
          {isPending ? "..." : confirming ? "Konfirmasi Hapus" : "Hapus"}
        </button>
      </div>

      {/* Amounts */}
      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Terpakai</p>
          <p
            className={`text-xl font-bold ${
              budget.isOverBudget
                ? "text-red-600 dark:text-red-400"
                : "text-zinc-900 dark:text-zinc-100"
            }`}
          >
            {formatCurrency(budget.spentAmount)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Batas</p>
          <p className="text-base font-semibold text-zinc-700 dark:text-zinc-300">
            {formatCurrency(budget.limitAmount)}
          </p>
        </div>
      </div>

      {/* Progress */}
      <ProgressBar pct={budget.displayPercentage} over={budget.isOverBudget} />

      {/* Status */}
      <div className="mt-2 flex items-center justify-between text-xs">
        <span
          className={
            budget.isOverBudget
              ? "font-medium text-red-600 dark:text-red-400"
              : budget.usagePercentage >= 80
              ? "font-medium text-amber-600 dark:text-amber-400"
              : "text-zinc-500 dark:text-zinc-400"
          }
        >
          {budget.isOverBudget
            ? `⚠ Melebihi ${formatCurrency(Math.abs(budget.remainingAmount))}`
            : `Sisa ${formatCurrency(budget.remainingAmount)}`}
        </span>
        <span className="text-zinc-400 dark:text-zinc-500">
          {budget.usagePercentage.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

// ─── Create Budget Form ─────────────────────────────────────────────────────────

function CreateBudgetForm({
  categories,
  onCreated,
}: {
  categories: Category[];
  onCreated: (budget: BudgetProgressDTO) => void;
}) {
  const { year: thisYear, month: thisMonth } = now();

  const [periodType, setPeriodType] = useState<"MONTHLY" | "CUSTOM">("MONTHLY");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [year, setYear] = useState(thisYear);
  const [month, setMonth] = useState(thisMonth);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const body =
      periodType === "MONTHLY"
        ? { periodType, categoryId, amount: parseFloat(amount), year, month }
        : { periodType, categoryId, amount: parseFloat(amount), startDate, endDate };

    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/budgets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();

        if (!res.ok || !json.success) {
          setError(json.error?.message ?? "Gagal membuat budget");
          return;
        }

        onCreated(json.data);
        setAmount("");
        setStartDate("");
        setEndDate("");
      } catch {
        setError("Terjadi kesalahan jaringan");
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
        + Buat Budget Baru
      </h2>

      {/* Period type toggle */}
      <div className="mb-4 flex gap-2">
        {(["MONTHLY", "CUSTOM"] as const).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setPeriodType(t)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              periodType === t
                ? "bg-blue-600 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {t === "MONTHLY" ? "Bulanan" : "Kustom"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Category */}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Kategori Pengeluaran
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ""}{c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Period fields */}
        {periodType === "MONTHLY" ? (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Bulan
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Tahun
              </label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                min={2020}
                max={2100}
                required
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Tanggal Mulai
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Tanggal Akhir
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </>
        )}

        {/* Amount */}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Batas Budget (IDR)
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={1}
            required
            placeholder="Contoh: 1500000"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || categories.length === 0}
        className="mt-4 w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? "Menyimpan…" : "Simpan Budget"}
      </button>
    </form>
  );
}

// ─── Main Client Component ──────────────────────────────────────────────────────

export function BudgetsClient({ initialBudgets, expenseCategories }: BudgetsClientProps) {
  const [budgets, setBudgets] = useState<BudgetProgressDTO[]>(initialBudgets);

  const handleCreated = (budget: BudgetProgressDTO) => {
    setBudgets((prev) => [budget, ...prev]);
  };

  const handleDeleted = (id: string) => {
    setBudgets((prev) => prev.filter((b) => b.id !== id));
  };

  const overBudgetCount = budgets.filter((b) => b.isOverBudget).length;
  const nearLimitCount = budgets.filter(
    (b) => !b.isOverBudget && b.usagePercentage >= 80
  ).length;

  return (
    <div className="space-y-6">
      {/* Summary banner */}
      {budgets.length > 0 && (overBudgetCount > 0 || nearLimitCount > 0) && (
        <div
          className={`rounded-2xl p-4 text-sm font-medium ${
            overBudgetCount > 0
              ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
              : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
          }`}
        >
          {overBudgetCount > 0
            ? `⚠ ${overBudgetCount} budget melebihi batas pengeluaran`
            : `⚡ ${nearLimitCount} budget mendekati batas (≥80%)`}
        </div>
      )}

      {/* Create form */}
      {expenseCategories.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Belum ada kategori Expense. Buat kategori terlebih dahulu.
          </p>
          <a
            href="/categories"
            className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
          >
            Kelola Kategori
          </a>
        </div>
      ) : (
        <CreateBudgetForm categories={expenseCategories} onCreated={handleCreated} />
      )}

      {/* Budget list */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Budget Aktif ({budgets.length})
        </h2>
        {budgets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-transparent p-8 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Belum ada budget. Buat budget pertama Anda di atas.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {budgets.map((b) => (
              <BudgetCard key={b.id} budget={b} onDelete={handleDeleted} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

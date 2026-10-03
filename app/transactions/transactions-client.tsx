"use client";

import { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "@/lib/utils";
import { PeriodType, PeriodRange } from "@/lib/types/period.types";
import { calculatePeriodRange, formatPeriodLabel } from "@/lib/utils/period.utils";
import PeriodFilter from "@/components/transactions/PeriodFilter";
import { SummaryCards } from "@/components/transactions/SummaryCards";

interface TransactionItem {
  id: string;
  userId: string;
  accountId: string;
  accountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  type: string;
  amount: string;
  description: string;
  transactionDate: Date | string;
  source: string;
  status: string;
  createdAt: Date | string;
}

interface AccountOption {
  id: string;
  name: string;
  currency: string;
}

interface CategoryOption {
  id: string;
  name: string;
  type: string;
}

interface TransactionsClientProps {
  initialTransactions: TransactionItem[];
  accounts: AccountOption[];
  categories: CategoryOption[];
}

export function TransactionsClient({
  initialTransactions,
  accounts,
  categories,
}: TransactionsClientProps) {
  const [list, setList] = useState<TransactionItem[]>(initialTransactions);
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [accountFilter, setAccountFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  // Period filter state
  const [periodType, setPeriodType] = useState<PeriodType>("ALL");
  const [periodStartDate, setPeriodStartDate] = useState<Date | undefined>();
  const [periodEndDate, setPeriodEndDate] = useState<Date | undefined>();
  const [periodLabel, setPeriodLabel] = useState<string>("Sejak pencatatan pertama");

  // Summary state
  const [summary, setSummary] = useState({
    income: 0,
    expense: 0,
    net: 0,
  });

  // Loading state for summary
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Create Modal State
  const [showModal, setShowModal] = useState(false);
  const [type, setType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dynamic category filtering based on selected transaction type
  const availableCategories = categories.filter((c) => c.type === type);

  // Fetch transactions with all filters including period
  const fetchTransactions = useCallback(async () => {
    setSummaryLoading(true);
    
    const params = new URLSearchParams();

    // Existing filters
    if (typeFilter !== "ALL") params.set("type", typeFilter);
    if (accountFilter !== "ALL") params.set("accountId", accountFilter);
    if (categoryFilter !== "ALL") params.set("categoryId", categoryFilter);
    if (search) params.set("search", search);

    // Period filters
    if (periodStartDate) params.set("startDate", periodStartDate.toISOString());
    if (periodEndDate) params.set("endDate", periodEndDate.toISOString());

    try {
      const res = await fetch(`/api/v1/transactions?${params}`);
      const json = await res.json();

      if (json.success) {
        setList(json.data.transactions || json.data);
        // Update summary if present in response
        if (json.data.summary) {
          setSummary(json.data.summary);
        }
      }
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setSummaryLoading(false);
    }
  }, [typeFilter, accountFilter, categoryFilter, search, periodStartDate, periodEndDate]);

  // Handle period change from PeriodFilter
  const handlePeriodChange = (type: PeriodType, start?: Date, end?: Date) => {
    setPeriodType(type);

    if (type === "CUSTOM") {
      // For CUSTOM period, use provided dates
      setPeriodStartDate(start);
      setPeriodEndDate(end);
      
      // Format label for custom range
      if (start && end) {
        const range: PeriodRange = { start, end };
        setPeriodLabel(formatPeriodLabel("CUSTOM", range));
      } else {
        // Placeholder label when dates not yet selected
        setPeriodLabel("Pilih tanggal custom");
      }
    } else {
      // For preset periods, calculate range
      const range = calculatePeriodRange(type);
      setPeriodStartDate(range.start);
      setPeriodEndDate(range.end);
      
      // Format label
      setPeriodLabel(formatPeriodLabel(type, range));
    }
  };

  // Refetch when filters change (including period)
useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Filtered transactions (client-side filtering already handled by API)
  const filteredList = list;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/v1/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          categoryId: categoryId || undefined,
          type,
          amount,
          description,
          transactionDate: new Date(date).toISOString(),
        }),
      });

      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || "Gagal mencatat transaksi.");
      } else {
        // Refetch transactions after successful creation
        await fetchTransactions();
        setShowModal(false);
        setAmount("");
        setDescription("");
      }
    } catch {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, desc: string) => {
    if (!confirm(`Hapus transaksi "${desc}"?`)) return;

    try {
      const res = await fetch(`/api/v1/transactions/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        // Refetch transactions after successful deletion
        await fetchTransactions();
      } else {
        alert(json.error?.message || "Gagal menghapus transaksi.");
      }
    } catch {
      alert("Gagal menghapus transaksi.");
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Riwayat Transaksi
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Catat dan pantau seluruh arus kas pengeluaran dan pemasukan Anda
          </p>
        </div>
        <button
          onClick={() => {
            setShowModal(true);
            setCategoryId(availableCategories[0]?.id || "");
          }}
          className="cursor-pointer self-start sm:self-auto rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          + Catat Transaksi
        </button>
      </div>

      {/* Period Filter */}
      <div className="mt-6">
        <PeriodFilter
          periodType={periodType}
          onPeriodChange={handlePeriodChange}
          startDate={periodStartDate}
          endDate={periodEndDate}
          periodLabel={periodLabel}
        />
      </div>

      {/* Summary Cards */}
      <div className="mt-6">
        <SummaryCards
          income={summary.income}
          expense={summary.expense}
          net={summary.net}
          isLoading={summaryLoading}
        />
      </div>

      {/* Filter Bar */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
        {/* Search */}
        <div>
          <input
            type="text"
            placeholder="Cari deskripsi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        {/* Type Filter */}
        <div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="ALL">Semua Jenis (Income & Expense)</option>
            <option value="EXPENSE">Hanya Pengeluaran (Expense)</option>
            <option value="INCOME">Hanya Pemasukan (Income)</option>
          </select>
        </div>

        {/* Account Filter */}
        <div>
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="ALL">Semua Akun</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
        </div>

        {/* Category Filter */}
        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="ALL">Semua Kategori</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} ({cat.type})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-850 text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Tanggal</th>
                <th className="px-4 py-3 font-semibold">Deskripsi</th>
                <th className="px-4 py-3 font-semibold">Kategori</th>
                <th className="px-4 py-3 font-semibold">Akun</th>
                <th className="px-4 py-3 font-semibold">Tipe</th>
                <th className="px-4 py-3 font-semibold text-right">Nominal</th>
                <th className="px-4 py-3 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                    Tidak ada transaksi yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                filteredList.map((tx) => (
                  <tr key={tx.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                    <td className="px-4 py-3.5 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                      {new Date(tx.transactionDate).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-zinc-900 dark:text-zinc-100">
                      {tx.description}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {tx.categoryName || "Umum"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                      {tx.accountName || "Akun"}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          tx.type === "INCOME"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                            : "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400"
                        }`}
                      >
                        {tx.type}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3.5 whitespace-nowrap text-right font-semibold ${
                        tx.type === "INCOME"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-zinc-900 dark:text-zinc-100"
                      }`}
                    >
                      {tx.type === "INCOME" ? "+" : "-"}
                      {formatCurrency(parseFloat(tx.amount))}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleDelete(tx.id, tx.description)}
                        className="cursor-pointer text-red-600 hover:text-red-700 font-medium"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add Transaction */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Catat Transaksi Baru
            </h2>

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setType("EXPENSE");
                    const newCats = categories.filter((c) => c.type === "EXPENSE");
                    setCategoryId(newCats[0]?.id || "");
                  }}
                  className={`cursor-pointer rounded-lg py-2 text-xs font-semibold transition-colors ${
                    type === "EXPENSE"
                      ? "bg-white text-red-600 shadow-xs dark:bg-zinc-900 dark:text-red-400"
                      : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  Pengeluaran (Expense)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setType("INCOME");
                    const newCats = categories.filter((c) => c.type === "INCOME");
                    setCategoryId(newCats[0]?.id || "");
                  }}
                  className={`cursor-pointer rounded-lg py-2 text-xs font-semibold transition-colors ${
                    type === "INCOME"
                      ? "bg-white text-emerald-600 shadow-xs dark:bg-zinc-900 dark:text-emerald-400"
                      : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  Pemasukan (Income)
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Nominal (Rp)
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  placeholder="Contoh: 25000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Akun Keuangan
                </label>
                <select
                  required
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Kategori ({type === "EXPENSE" ? "Pengeluaran" : "Pemasukan"})
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="">-- Tanpa Kategori --</option>
                  {availableCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Deskripsi Transaksi
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Makan siang, Gaji bulanan, Bensin"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Tanggal
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div className="mt-6 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="cursor-pointer rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "Menyimpan..." : "Simpan Transaksi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

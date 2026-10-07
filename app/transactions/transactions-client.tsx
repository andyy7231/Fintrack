"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
  categoryIcon: string | null;
  type: string;
  amount: string;
  description: string;
  transactionDate: Date;
  source: string | null;
  status: string | null;
  createdAt: Date | string | null;
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

interface TransactionSummary {
  income: number;
  expense: number;
  net: number;
}

interface TransactionsClientProps {
  initialTransactions: TransactionItem[];
  initialSummary: TransactionSummary;
  accounts: AccountOption[];
  categories: CategoryOption[];
}

export function TransactionsClient({
  initialTransactions,
  initialSummary,
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

  // Summary state (initialized from SSR)
  const [summary, setSummary] = useState<TransactionSummary>(initialSummary);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

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

  const searchParams = useSearchParams();
  const router = useRouter();

  const closeModal = useCallback(() => {
    setShowModal(false);
    setError(null);
    if (searchParams.get("new") === "1") {
      router.replace("/transactions", { scroll: false });
    }
  }, [searchParams, router]);

  // Open modal automatically when ?new=1 is present in URL
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setShowModal(true);
      const defaultCat = categories.find((c) => c.type === "EXPENSE");
      if (defaultCat) setCategoryId(defaultCat.id);
    }
  }, [searchParams, categories]);

  // Open modal immediately when custom event is fired (e.g. from mobile header or bottom nav)
  useEffect(() => {
    const handleOpen = () => {
      setShowModal(true);
      const defaultCat = categories.find((c) => c.type === "EXPENSE");
      if (defaultCat) setCategoryId(defaultCat.id);
    };
    window.addEventListener("open-new-transaction", handleOpen);
    return () => window.removeEventListener("open-new-transaction", handleOpen);
  }, [categories]);

  // Fetch transactions with all filters including period
  const fetchTransactions = useCallback(async () => {
    setSummaryLoading(true);
    
    const params = new URLSearchParams();
    if (typeFilter !== "ALL") params.set("type", typeFilter);
    if (accountFilter !== "ALL") params.set("accountId", accountFilter);
    if (categoryFilter !== "ALL") params.set("categoryId", categoryFilter);
    if (search) params.set("search", search);

    if (periodStartDate) params.set("startDate", periodStartDate.toISOString());
    if (periodEndDate) params.set("endDate", periodEndDate.toISOString());

    try {
      const res = await fetch(`/api/v1/transactions?${params}`);
      const json = await res.json();

      if (json.success) {
        setList(json.data.transactions || json.data);
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
      setPeriodStartDate(start);
      setPeriodEndDate(end);
      if (start && end) {
        const range: PeriodRange = { start, end };
        setPeriodLabel(formatPeriodLabel("CUSTOM", range));
      } else {
        setPeriodLabel("Pilih tanggal custom");
      }
    } else {
      const range = calculatePeriodRange(type);
      setPeriodStartDate(range.start);
      setPeriodEndDate(range.end);
      setPeriodLabel(formatPeriodLabel(type, range));
    }
  };

  useEffect(() => {
    if (isInitialLoad) {
      setIsInitialLoad(false);
      return;
    }
    fetchTransactions();
  }, [fetchTransactions, isInitialLoad]);

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
        await fetchTransactions();
        closeModal();
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
        await fetchTransactions();
      } else {
        alert(json.error?.message || "Gagal menghapus transaksi.");
      }
    } catch {
      alert("Gagal menghapus transaksi.");
    }
  };

  // CSV Export utility
  const handleExportCSV = () => {
    if (list.length === 0) {
      alert("Tidak ada transaksi untuk diekspor.");
      return;
    }
    const headers = ["Tanggal", "Deskripsi", "Kategori", "Akun", "Tipe", "Nominal"];
    const rows = list.map((tx) => [
      new Date(tx.transactionDate).toISOString().split("T")[0],
      `"${(tx.description || "").replace(/"/g, '""')}"`,
      `"${(tx.categoryName || "Umum").replace(/"/g, '""')}"`,
      `"${(tx.accountName || "Akun").replace(/"/g, '""')}"`,
      tx.type,
      tx.amount,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `fintrack-transaksi-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-2" data-purpose="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Riwayat Transaksi
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Catat dan pantau seluruh arus kas pengeluaran dan pemasukan Anda
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition shadow-sm cursor-pointer"
            title="Unduh data transaksi ke CSV"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Unduh CSV</span>
          </button>
          <button
            onClick={() => {
              setShowModal(true);
              setCategoryId(availableCategories[0]?.id || "");
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm shadow-emerald-500/20 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>+ Catat Transaksi</span>
          </button>
        </div>
      </header>

      {/* KPI Summary Cards */}
      <SummaryCards
        income={summary.income}
        expense={summary.expense}
        net={summary.net}
        isLoading={summaryLoading}
      />

      {/* Period Filter Component */}
      <PeriodFilter
        periodType={periodType}
        onPeriodChange={handlePeriodChange}
        startDate={periodStartDate}
        endDate={periodEndDate}
        periodLabel={periodLabel}
      />

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        {/* Search */}
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Cari deskripsi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        {/* Type Filter */}
        <div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          >
            <option value="ALL">Semua Jenis Arus Kas</option>
            <option value="EXPENSE">Hanya Pengeluaran (Expense)</option>
            <option value="INCOME">Hanya Pemasukan (Income)</option>
          </select>
        </div>

        {/* Account Filter */}
        <div>
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          >
            <option value="ALL">Semua Akun / Dompet</option>
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
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          >
            <option value="ALL">Semua Kategori</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} ({cat.type === "EXPENSE" ? "Pengeluaran" : "Pemasukan"})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
            <thead className="bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Tanggal</th>
                <th className="px-5 py-3.5">Deskripsi</th>
                <th className="px-5 py-3.5">Kategori</th>
                <th className="px-5 py-3.5">Akun</th>
                <th className="px-5 py-3.5">Tipe</th>
                <th className="px-5 py-3.5 text-right">Nominal</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {list.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <p className="text-xs font-semibold text-slate-600">Tidak ada transaksi ditemukan</p>
                      <p className="text-[11px] text-slate-400">Coba ubah filter atau catat transaksi baru</p>
                    </div>
                  </td>
                </tr>
              ) : (
                list.map((tx) => {
                  const isIncome = tx.type === "INCOME";
                  const dateObj = new Date(tx.transactionDate);
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5 whitespace-nowrap text-slate-500 font-medium">
                        {dateObj.toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-5 py-3.5 text-slate-900 font-semibold max-w-xs truncate">
                        {tx.description}
                        {tx.source === "WHATSAPP" && (
                          <span className="ml-1.5 text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold border border-emerald-200">
                            WA
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-700 px-2.5 py-1 text-[11px] font-semibold border border-slate-200/60">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: tx.categoryColor || "#10B981" }}
                          />
                          {tx.categoryName || "Umum"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-slate-600">
                        <span className="inline-flex items-center gap-1 bg-slate-50 text-slate-600 px-2 py-0.5 rounded-md text-[11px] border border-slate-200/50">
                          {tx.accountName || "Akun"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            isIncome
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                              : ""
                          }`}
                          style={!isIncome ? {background:'rgba(255,10,84,0.08)',color:'#FF0A54',border:'1px solid rgba(255,10,84,0.20)'} : {}}
                        >
                          {isIncome ? "Pemasukan" : "Pengeluaran"}
                        </span>
                      </td>
                      <td
                        className={`px-5 py-3.5 whitespace-nowrap text-right font-bold ${
                          isIncome ? "text-emerald-600" : ""
                        }`}
                        style={!isIncome ? {color:'#FF0A54'} : {}}
                      >
                        {isIncome ? "+" : "-"} {formatCurrency(parseFloat(tx.amount))}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleDelete(tx.id, tx.description)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#FF0A54] hover:bg-[rgba(255,10,84,0.08)] transition cursor-pointer"
                          title="Hapus transaksi"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add Transaction (Stitch Style) */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                Catat Transaksi Baru
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mt-3 rounded-xl p-3 text-xs" style={{background:'rgba(255,10,84,0.07)',border:'1px solid rgba(255,10,84,0.20)',color:'#c0003b'}}>
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setType("EXPENSE");
                    const newCats = categories.filter((c) => c.type === "EXPENSE");
                    setCategoryId(newCats[0]?.id || "");
                  }}
                  className={`cursor-pointer rounded-lg py-2 text-xs font-bold transition-all ${
                    type === "EXPENSE"
                      ? "bg-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  style={type === "EXPENSE" ? {color:'#FF0A54'} : {}}
                >
                  Pengeluaran
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setType("INCOME");
                    const newCats = categories.filter((c) => c.type === "INCOME");
                    setCategoryId(newCats[0]?.id || "");
                  }}
                  className={`cursor-pointer rounded-lg py-2 text-xs font-bold transition-all ${
                    type === "INCOME"
                      ? "bg-white text-emerald-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Pemasukan
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nominal (Rp)
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  placeholder="Contoh: 50000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Akun Keuangan
                </label>
                <select
                  required
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kategori ({type === "EXPENSE" ? "Pengeluaran" : "Pemasukan"})
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deskripsi Transaksi
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Makan siang, Gaji bulanan, Kopi"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tanggal Transaksi
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-sm shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
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

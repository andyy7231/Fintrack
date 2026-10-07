"use client";

import { useState, useMemo } from "react";
import { formatCurrency } from "@/lib/utils";
import type {
  CategoryWithStats,
  CategoriesSummaryStats,
} from "@/services/category.service";

interface CategoriesClientProps {
  initialCategories: CategoryWithStats[];
  initialSummary: CategoriesSummaryStats;
}

// Preset finance icons/emojis
const EMOJI_PRESETS = [
  { emoji: "🍔", label: "Makanan" },
  { emoji: "☕", label: "Kopi & Minuman" },
  { emoji: "🚗", label: "Transportasi" },
  { emoji: "⛽", label: "Bahan Bakar" },
  { emoji: "⚡", label: "Tagihan & Listrik" },
  { emoji: "🛍️", label: "Belanja" },
  { emoji: "💊", label: "Kesehatan" },
  { emoji: "🎓", label: "Pendidikan" },
  { emoji: "🎬", label: "Hiburan" },
  { emoji: "🏠", label: "Tempat Tinggal" },
  { emoji: "📦", label: "Lainnya" },
  { emoji: "💼", label: "Gaji & Karir" },
  { emoji: "📈", label: "Investasi" },
  { emoji: "🏪", label: "Bisnis & Toko" },
  { emoji: "🎁", label: "Hadiah & Bonus" },
  { emoji: "💻", label: "Freelance" },
  { emoji: "👨‍👩‍👧", label: "Keluarga" },
  { emoji: "🤲", label: "Donasi & Zakat" },
];

// Curated hex color options matching FinTrack aesthetic
const COLOR_PRESETS = [
  "#10B981", // Emerald
  "#059669", // Dark Emerald
  "#0284C7", // Sky Blue
  "#3B82F6", // Blue
  "#6366F1", // Indigo
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#EF4444", // Rose
  "#F97316", // Orange
  "#F59E0B", // Amber
  "#14B8A6", // Teal
  "#6B7280", // Slate
];

function resolveCategoryEmoji(name: string, type: string, icon?: string | null): string {
  if (icon && !/^[a-z-]+$/.test(icon)) {
    return icon;
  }
  const lower = name.toLowerCase();
  if (lower.includes("makan") || lower.includes("minum") || lower.includes("kuliner") || lower.includes("coffee") || icon === "coffee") return "🍔";
  if (lower.includes("transport") || lower.includes("bensin") || lower.includes("ojek") || lower.includes("parkir") || icon === "truck") return "🚗";
  if (lower.includes("tagihan") || lower.includes("utilitas") || lower.includes("listrik") || lower.includes("air") || icon === "zap") return "⚡";
  if (lower.includes("belanja") || lower.includes("shopping") || icon === "shopping-bag") return "🛍️";
  if (lower.includes("sehat") || lower.includes("obat") || lower.includes("dokter") || icon === "activity") return "💊";
  if (lower.includes("didik") || lower.includes("kuliah") || lower.includes("sekolah") || icon === "book") return "🎓";
  if (lower.includes("hiburan") || lower.includes("film") || lower.includes("game") || icon === "film") return "🎬";
  if (lower.includes("tinggal") || lower.includes("rumah") || lower.includes("kost") || icon === "home") return "🏠";
  if (lower.includes("gaji") || lower.includes("salary") || icon === "briefcase") return "💼";
  if (lower.includes("invest") || lower.includes("saham") || icon === "bar-chart-2") return "📈";
  if (lower.includes("bisnis") || lower.includes("usaha") || icon === "trending-up") return "🏪";
  if (lower.includes("hadiah") || lower.includes("bonus") || lower.includes("cashback") || icon === "gift") return "🎁";
  if (lower.includes("freelance") || lower.includes("laptop") || icon === "laptop") return "💻";
  if (lower.includes("keluarga") || lower.includes("anak")) return "👨‍👩‍👧";
  if (lower.includes("donasi") || lower.includes("zakat")) return "🤲";
  if (type === "INCOME") return "💰";
  return "📦";
}

export function CategoriesClient({
  initialCategories,
  initialSummary,
}: CategoriesClientProps) {
  const [categoriesList, setCategoriesList] = useState<CategoryWithStats[]>(initialCategories);
  const [summary, setSummary] = useState<CategoriesSummaryStats>(initialSummary);

  const [activeTab, setActiveTab] = useState<"ALL" | "EXPENSE" | "INCOME">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"NOMINAL_DESC" | "NAME_ASC" | "TX_DESC" | "DEFAULT">("NOMINAL_DESC");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"CREATE" | "EDIT">("CREATE");
  const [activeEditId, setActiveEditId] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [formEmoji, setFormEmoji] = useState("🍔");
  const [formColor, setFormColor] = useState("#10B981");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Dropdown option menu state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<CategoryWithStats | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Refresh data from API
  const refreshCategories = async () => {
    try {
      const res = await fetch("/api/v1/categories?stats=true");
      const json = await res.json();
      if (json.success && json.data) {
        setCategoriesList(json.data.categories);
        setSummary(json.data.summary);
      }
    } catch {
      // silently ignore background refresh error
    }
  };

  // Open Create Modal with optional preselected type
  const openCreateModal = (type: "EXPENSE" | "INCOME" = "EXPENSE") => {
    setModalMode("CREATE");
    setActiveEditId(null);
    setFormName("");
    setFormType(type);
    setFormEmoji(type === "EXPENSE" ? "🍔" : "💼");
    setFormColor(type === "EXPENSE" ? "#EF4444" : "#10B981");
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (cat: CategoryWithStats) => {
    setModalMode("EDIT");
    setActiveEditId(cat.id);
    setFormName(cat.name);
    setFormType(cat.type as "EXPENSE" | "INCOME");
    setFormEmoji(resolveCategoryEmoji(cat.name, cat.type, cat.icon));
    setFormColor(cat.color || (cat.type === "EXPENSE" ? "#EF4444" : "#10B981"));
    setFormError(null);
    setOpenMenuId(null);
    setIsModalOpen(true);
  };

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError("Nama kategori tidak boleh kosong.");
      return;
    }

    setLoading(true);
    try {
      if (modalMode === "CREATE") {
        const res = await fetch("/api/v1/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            type: formType,
            icon: formEmoji,
            color: formColor,
          }),
        });
        const json = await res.json();
        if (!json.success) {
          setFormError(json.error?.message || "Gagal membuat kategori.");
          return;
        }
      } else if (activeEditId) {
        const res = await fetch(`/api/v1/categories/${activeEditId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            icon: formEmoji,
            color: formColor,
          }),
        });
        const json = await res.json();
        if (!json.success) {
          setFormError(json.error?.message || "Gagal memperbarui kategori.");
          return;
        }
      }

      await refreshCategories();
      setIsModalOpen(false);
    } catch {
      setFormError("Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false);
    }
  };

  // Handle Delete
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);

    try {
      const res = await fetch(`/api/v1/categories/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error?.message || "Gagal menghapus kategori.");
      } else {
        await refreshCategories();
        setDeleteTarget(null);
      }
    } catch {
      alert("Terjadi kesalahan saat menghapus kategori.");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Filtered & Sorted categories
  const filteredCategories = useMemo(() => {
    return categoriesList.filter((cat) => {
      // Tab filter
      if (activeTab !== "ALL" && cat.type !== activeTab) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          cat.name.toLowerCase().includes(q) ||
          cat.type.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [categoriesList, activeTab, searchQuery]);

  const sortedCategories = useMemo(() => {
    const list = [...filteredCategories];
    switch (sortBy) {
      case "NOMINAL_DESC":
        return list.sort((a, b) => b.monthlyTotal - a.monthlyTotal);
      case "NAME_ASC":
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case "TX_DESC":
        return list.sort((a, b) => b.transactionCount - a.transactionCount);
      default:
        return list;
    }
  }, [filteredCategories, sortBy]);

  const expenseCategories = useMemo(
    () => sortedCategories.filter((c) => c.type === "EXPENSE"),
    [sortedCategories]
  );

  const incomeCategories = useMemo(
    () => sortedCategories.filter((c) => c.type === "INCOME"),
    [sortedCategories]
  );

  // Close menus on click outside
  const toggleMenu = (id: string) => {
    setOpenMenuId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6 pb-12" onClick={() => openMenuId && setOpenMenuId(null)}>
      {/* ── Top Header ─────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight dark:text-zinc-100">
            Kategori
          </h1>
          <p className="text-sm text-slate-500 mt-1 dark:text-zinc-400">
            Kelola kategori transaksi dan alokasi keuangan Anda
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => openCreateModal("EXPENSE")}
            className="cursor-pointer inline-flex items-center gap-2 bg-[#00c076] hover:bg-[#00ab68] active:scale-[0.98] text-[#0a1612] font-bold px-4 py-2.5 rounded-xl shadow-xs hover:shadow-md transition-all text-sm"
          >
            <svg
              className="w-4 h-4 stroke-[2.5]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>+ Tambah Kategori</span>
          </button>
        </div>
      </header>

      {/* ── 3 Summary KPI Cards (FinTrack Stitch Layout) ───────── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {/* Card 1: Total Kategori */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-500 tracking-wider uppercase dark:text-zinc-400">
                Total Kategori
              </p>
              <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1 tracking-tight whitespace-nowrap truncate dark:text-zinc-100" title={`${summary.totalCategories} Kategori`}>
                {summary.totalCategories} Kategori
              </h3>
              <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5 dark:text-zinc-400">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                <span className="truncate">Aktif digunakan bulan ini</span>
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 dark:bg-zinc-800 dark:text-zinc-300">
              <svg
                className="w-5 h-5 text-slate-700 dark:text-zinc-300"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-600 font-medium min-w-0 dark:border-zinc-800 dark:text-zinc-400">
            <span className="shrink-0">Rincian Jenis:</span>
            <span className="text-slate-800 font-semibold truncate text-right dark:text-zinc-200" title={`${summary.expenseCategoriesCount} Pengeluaran • ${summary.incomeCategoriesCount} Pemasukan`}>
              {summary.expenseCategoriesCount} Pengeluaran • {summary.incomeCategoriesCount} Pemasukan
            </span>
          </div>
        </div>

        {/* Card 2: Kategori Pengeluaran */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-slate-500 tracking-wider uppercase dark:text-zinc-400">
                  Kategori Pengeluaran
                </p>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{background:'rgba(255,10,84,0.08)',color:'#FF0A54'}}>
                  Expense
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1 tracking-tight whitespace-nowrap truncate dark:text-zinc-100" title={`${summary.expenseCategoriesCount} Kategori`}>
                {summary.expenseCategoriesCount} Kategori
              </h3>
              <p className="text-xs font-semibold mt-2 flex items-center gap-1 min-w-0" style={{color:'#FF0A54'}}>
                <span className="truncate" title={formatCurrency(summary.totalExpenseMonth)}>{formatCurrency(summary.totalExpenseMonth)}</span>
                <span className="text-slate-500 font-normal shrink-0 dark:text-zinc-400">total tercatat</span>
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{background:'rgba(255,10,84,0.08)',color:'#FF0A54'}}>
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <polyline points="19 12 12 19 5 12"></polyline>
              </svg>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-600 font-medium min-w-0 dark:border-zinc-800 dark:text-zinc-400">
            <span className="shrink-0">Aktivitas Transaksi:</span>
            <span className="text-slate-800 font-semibold truncate text-right dark:text-zinc-200" title={`${summary.expenseTxCount} Pengeluaran bulan ini`}>
              {summary.expenseTxCount} Pengeluaran bulan ini
            </span>
          </div>
        </div>

        {/* Card 3: Kategori Pemasukan */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-slate-500 tracking-wider uppercase dark:text-zinc-400">
                  Kategori Pemasukan
                </p>
                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded shrink-0 dark:bg-emerald-950/60 dark:text-emerald-400">
                  Income
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1 tracking-tight whitespace-nowrap truncate dark:text-zinc-100" title={`${summary.incomeCategoriesCount} Kategori`}>
                {summary.incomeCategoriesCount} Kategori
              </h3>
              <p className="text-xs text-emerald-600 font-semibold mt-2 flex items-center gap-1 min-w-0 dark:text-emerald-400">
                <span className="truncate" title={formatCurrency(summary.totalIncomeMonth)}>{formatCurrency(summary.totalIncomeMonth)}</span>
                <span className="text-slate-500 font-normal shrink-0 dark:text-zinc-400">total tercatat</span>
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 dark:bg-emerald-950/40 dark:text-emerald-400">
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="19" x2="12" y2="5"></line>
                <polyline points="5 12 12 5 19 12"></polyline>
              </svg>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-600 font-medium min-w-0 dark:border-zinc-800 dark:text-zinc-400">
            <span className="shrink-0">Aktivitas Transaksi:</span>
            <span className="text-slate-800 font-semibold truncate text-right dark:text-zinc-200" title={`${summary.incomeTxCount} Pemasukan bulan ini`}>
              {summary.incomeTxCount} Pemasukan bulan ini
            </span>
          </div>
        </div>
      </section>

      {/* ── Toolbar: Search & Filter (Stitch) ──────────────────── */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Cari nama kategori..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 text-xs text-slate-800 placeholder-slate-400 rounded-xl pl-9 pr-8 py-2.5 border border-slate-200 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 dark:placeholder-zinc-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs dark:hover:text-zinc-300"
              >
                ✕
              </button>
            )}
          </div>

          {/* Type Filter Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600 w-full sm:w-auto dark:bg-zinc-800 dark:text-zinc-300">
            <button
              onClick={() => setActiveTab("ALL")}
              className={`cursor-pointer px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "ALL"
                  ? "bg-white text-slate-900 shadow-xs font-bold dark:bg-zinc-700 dark:text-white"
                  : "hover:text-slate-900 text-slate-600 dark:hover:text-white"
              }`}
            >
              Semua ({summary.totalCategories})
            </button>
            <button
              onClick={() => setActiveTab("EXPENSE")}
              className={`cursor-pointer px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "EXPENSE"
                  ? "bg-white text-slate-900 shadow-xs font-bold dark:bg-zinc-700 dark:text-white"
                  : "hover:text-slate-900 text-slate-600 dark:hover:text-white"
              }`}
            >
              Pengeluaran ({summary.expenseCategoriesCount})
            </button>
            <button
              onClick={() => setActiveTab("INCOME")}
              className={`cursor-pointer px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "INCOME"
                  ? "bg-white text-slate-900 shadow-xs font-bold dark:bg-zinc-700 dark:text-white"
                  : "hover:text-slate-900 text-slate-600 dark:hover:text-white"
              }`}
            >
              Pemasukan ({summary.incomeCategoriesCount})
            </button>
          </div>
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <div className="relative w-full sm:w-auto">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="w-full sm:w-auto appearance-none bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 py-2.5 pl-3.5 pr-8 rounded-xl focus:outline-none focus:border-emerald-500 cursor-pointer dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
            >
              <option value="NOMINAL_DESC">Urutkan: Nominal Terbanyak</option>
              <option value="NAME_ASC">Urutkan: Nama (A-Z)</option>
              <option value="TX_DESC">Urutkan: Jumlah Transaksi</option>
            </select>
            <svg
              className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </div>
      </section>

      {/* ── SECTION 1: KATEGORI PENGELUARAN ─────────────────────── */}
      {(activeTab === "ALL" || activeTab === "EXPENSE") && (
        <section className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full" style={{backgroundColor:'#FF0A54'}}></div>
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight dark:text-zinc-100">
                Kategori Pengeluaran
              </h2>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full dark:bg-zinc-800 dark:text-zinc-400">
                {expenseCategories.length} Kategori
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium dark:text-zinc-400">
              Total tercatat bulan ini:{" "}
              <span className="font-bold text-slate-800 dark:text-zinc-200">
                {formatCurrency(summary.totalExpenseMonth)}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {expenseCategories.map((cat) => {
              const emoji = resolveCategoryEmoji(cat.name, cat.type, cat.icon);
              const cardColor = cat.color || "#EF4444";
              const isMenuOpen = openMenuId === cat.id;

              return (
                <div
                  key={cat.id}
                  className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all group flex flex-col justify-between dark:bg-zinc-900 dark:border-zinc-800 relative"
                >
                  <div>
                    {/* Header: Icon, Name, Options */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-xs border transition-transform group-hover:scale-105"
                          style={{
                            backgroundColor: `${cardColor}15`,
                            borderColor: `${cardColor}35`,
                          }}
                        >
                          {emoji}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors dark:text-zinc-100 dark:group-hover:text-emerald-400 line-clamp-1">
                            {cat.name}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500">
                              {cat.transactionCount} Transaksi
                            </span>
                            <span className="text-slate-300 dark:text-zinc-700">•</span>
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.2 rounded ${
                                cat.isDefault
                                  ? "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"
                                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                              }`}
                            >
                              {cat.isDefault ? "Bawaan" : "Kustom"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Options Button */}
                      {!cat.isDefault && (
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMenu(cat.id);
                            }}
                            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-50 transition-colors dark:hover:text-zinc-200 dark:hover:bg-zinc-800"
                            title="Opsi Kategori"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="1"></circle>
                              <circle cx="12" cy="5" r="1"></circle>
                              <circle cx="12" cy="19" r="1"></circle>
                            </svg>
                          </button>

                          {/* Dropdown Menu */}
                          {isMenuOpen && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-8 z-30 w-36 rounded-xl bg-white p-1.5 shadow-lg border border-slate-200 text-xs font-semibold dark:bg-zinc-800 dark:border-zinc-700 animate-in fade-in zoom-in-95 duration-100"
                            >
                              <button
                                onClick={() => openEditModal(cat)}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-2 dark:text-zinc-200 dark:hover:bg-zinc-700"
                              >
                                ✏️ <span>Edit</span>
                              </button>
                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setDeleteTarget(cat);
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-2 dark:hover:bg-rose-950/50"
                              >
                                🗑️ <span>Hapus</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Middle: Total Nominal */}
                    <div className="mt-4 flex items-baseline justify-between gap-2 min-w-0">
                      <span className="text-xs text-slate-500 font-medium shrink-0 dark:text-zinc-400">
                        Total Pengeluaran
                      </span>
                      <span className="text-sm font-extrabold truncate" style={{color:'#FF0A54'}} title={formatCurrency(cat.monthlyTotal)}>
                        {formatCurrency(cat.monthlyTotal)}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden dark:bg-zinc-800">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(cat.portion, 100)}%`,
                          backgroundColor: cardColor,
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Footer: Proportion */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium dark:border-zinc-800 dark:text-zinc-400">
                    <span>Porsi Pengeluaran</span>
                    <span className="font-bold text-slate-700 dark:text-zinc-300">
                      {cat.portion.toFixed(1)}% dari total
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Dotted Quick Add Expense Card */}
            <div
              onClick={() => openCreateModal("EXPENSE")}
              className="cursor-pointer border-2 border-dashed border-slate-200 hover:border-emerald-400 rounded-2xl p-5 flex flex-col items-center justify-center text-center hover:bg-emerald-50/20 transition-all group min-h-[160px] dark:border-zinc-800 dark:hover:border-emerald-500"
            >
              <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-emerald-100 text-slate-500 group-hover:text-emerald-600 flex items-center justify-center transition-colors dark:bg-zinc-800 dark:text-zinc-400 dark:group-hover:bg-emerald-950 dark:group-hover:text-emerald-400">
                <svg className="w-5 h-5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </div>
              <p className="text-xs font-bold text-slate-700 mt-2.5 group-hover:text-emerald-800 dark:text-zinc-300 dark:group-hover:text-emerald-400">
                Tambah Kategori Pengeluaran
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 dark:text-zinc-500">
                Atur nama, ikon, dan warna kategori
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── SECTION 2: KATEGORI PEMASUKAN ──────────────────────── */}
      {(activeTab === "ALL" || activeTab === "INCOME") && (
        <section className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight dark:text-zinc-100">
                Kategori Pemasukan
              </h2>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full dark:bg-zinc-800 dark:text-zinc-400">
                {incomeCategories.length} Kategori
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium dark:text-zinc-400">
              Total tercatat bulan ini:{" "}
              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                {formatCurrency(summary.totalIncomeMonth)}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {incomeCategories.map((cat) => {
              const emoji = resolveCategoryEmoji(cat.name, cat.type, cat.icon);
              const cardColor = cat.color || "#10B981";
              const isMenuOpen = openMenuId === cat.id;

              return (
                <div
                  key={cat.id}
                  className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all group flex flex-col justify-between dark:bg-zinc-900 dark:border-zinc-800 relative"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-xs border transition-transform group-hover:scale-105"
                          style={{
                            backgroundColor: `${cardColor}15`,
                            borderColor: `${cardColor}35`,
                          }}
                        >
                          {emoji}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors dark:text-zinc-100 dark:group-hover:text-emerald-400 line-clamp-1">
                            {cat.name}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500">
                              {cat.transactionCount} Transaksi
                            </span>
                            <span className="text-slate-300 dark:text-zinc-700">•</span>
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.2 rounded ${
                                cat.isDefault
                                  ? "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"
                                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                              }`}
                            >
                              {cat.isDefault ? "Bawaan" : "Kustom"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Options Button */}
                      {!cat.isDefault && (
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMenu(cat.id);
                            }}
                            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-50 transition-colors dark:hover:text-zinc-200 dark:hover:bg-zinc-800"
                            title="Opsi Kategori"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="1"></circle>
                              <circle cx="12" cy="5" r="1"></circle>
                              <circle cx="12" cy="19" r="1"></circle>
                            </svg>
                          </button>

                          {isMenuOpen && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-8 z-30 w-36 rounded-xl bg-white p-1.5 shadow-lg border border-slate-200 text-xs font-semibold dark:bg-zinc-800 dark:border-zinc-700 animate-in fade-in zoom-in-95 duration-100"
                            >
                              <button
                                onClick={() => openEditModal(cat)}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-2 dark:text-zinc-200 dark:hover:bg-zinc-700"
                              >
                                ✏️ <span>Edit</span>
                              </button>
                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setDeleteTarget(cat);
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-2 dark:hover:bg-rose-950/50"
                              >
                                🗑️ <span>Hapus</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Middle: Total Nominal */}
                    <div className="mt-4 flex items-baseline justify-between gap-2 min-w-0">
                      <span className="text-xs text-slate-500 font-medium shrink-0 dark:text-zinc-400">
                        Total Pemasukan
                      </span>
                      <span className="text-sm font-extrabold text-emerald-600 truncate dark:text-emerald-400" title={formatCurrency(cat.monthlyTotal)}>
                        {formatCurrency(cat.monthlyTotal)}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden dark:bg-zinc-800">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(cat.portion, 100)}%`,
                          backgroundColor: cardColor,
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium dark:border-zinc-800 dark:text-zinc-400">
                    <span>Porsi Pemasukan</span>
                    <span className="font-bold text-slate-700 dark:text-zinc-300">
                      {cat.portion.toFixed(1)}% dari total
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Dotted Quick Add Income Card */}
            <div
              onClick={() => openCreateModal("INCOME")}
              className="cursor-pointer border-2 border-dashed border-slate-200 hover:border-emerald-400 rounded-2xl p-5 flex flex-col items-center justify-center text-center hover:bg-emerald-50/20 transition-all group min-h-[160px] dark:border-zinc-800 dark:hover:border-emerald-500"
            >
              <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-emerald-100 text-slate-500 group-hover:text-emerald-600 flex items-center justify-center transition-colors dark:bg-zinc-800 dark:text-zinc-400 dark:group-hover:bg-emerald-950 dark:group-hover:text-emerald-400">
                <svg className="w-5 h-5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </div>
              <p className="text-xs font-bold text-slate-700 mt-2.5 group-hover:text-emerald-800 dark:text-zinc-300 dark:group-hover:text-emerald-400">
                Tambah Kategori Pemasukan
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 dark:text-zinc-500">
                Atur sumber penghasilan atau passive income
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── CREATE / EDIT CATEGORY MODAL (Stitch Design) ────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg dark:bg-emerald-950/60 dark:text-emerald-400">
                  {formEmoji}
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 tracking-tight dark:text-zinc-100">
                    {modalMode === "CREATE" ? "Tambah Kategori Baru" : "Edit Kategori"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Sesuaikan detail kategori untuk pelacakan transaksi
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-xl text-xs font-medium" style={{background:'rgba(255,10,84,0.07)',border:'1px solid rgba(255,10,84,0.20)',color:'#c0003b'}}>
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {/* Type Switcher (only for Create mode) */}
              {modalMode === "CREATE" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 dark:text-zinc-300">
                    Tipe Kategori
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl text-xs font-bold dark:bg-zinc-800">
                    <button
                      type="button"
                      onClick={() => {
                        setFormType("EXPENSE");
                        if (formColor === "#10B981") setFormColor("#FF0A54");
                      }}
                      className={`py-2 rounded-lg transition-all flex items-center justify-center gap-2 ${
                        formType === "EXPENSE"
                          ? "bg-white shadow-xs dark:bg-zinc-700"
                          : "text-slate-500 hover:text-slate-900 dark:text-zinc-400"
                      }`}
                      style={formType === "EXPENSE" ? {color:'#FF0A54'} : {}}
                    >
                      <span className="w-2 h-2 rounded-full" style={{backgroundColor:'#FF0A54'}}></span>
                      Pengeluaran
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormType("INCOME");
                        if (formColor === "#FF0A54" || formColor === "#EF4444") setFormColor("#10B981");
                      }}
                      className={`py-2 rounded-lg transition-all flex items-center justify-center gap-2 ${
                        formType === "INCOME"
                          ? "bg-white text-emerald-600 shadow-xs dark:bg-zinc-700 dark:text-emerald-400"
                          : "text-slate-500 hover:text-slate-900 dark:text-zinc-400"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Pemasukan
                    </button>
                  </div>
                </div>
              )}

              {/* Name Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 dark:text-zinc-300">
                  Nama Kategori
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Belanja Bulanan, Kopi & Snack, Side Project"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                />
              </div>

              {/* Emoji Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 dark:text-zinc-300">
                  Pilih Ikon / Emoji
                </label>
                <div className="grid grid-cols-6 sm:grid-cols-9 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl dark:bg-zinc-800/60 dark:border-zinc-700">
                  {EMOJI_PRESETS.map((item) => (
                    <button
                      type="button"
                      key={item.emoji}
                      onClick={() => setFormEmoji(item.emoji)}
                      title={item.label}
                      className={`w-9 h-9 text-lg rounded-lg flex items-center justify-center transition-all ${
                        formEmoji === item.emoji
                          ? "bg-emerald-500 text-white shadow-xs scale-110"
                          : "hover:bg-white dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300"
                      }`}
                    >
                      {item.emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 dark:text-zinc-300">
                  Pilih Warna Tema
                </label>
                <div className="flex flex-wrap gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl dark:bg-zinc-800/60 dark:border-zinc-700">
                  {COLOR_PRESETS.map((hex) => (
                    <button
                      type="button"
                      key={hex}
                      onClick={() => setFormColor(hex)}
                      className={`w-7 h-7 rounded-full transition-transform flex items-center justify-center ${
                        formColor.toLowerCase() === hex.toLowerCase()
                          ? "scale-115 ring-2 ring-offset-2 ring-emerald-500 shadow-xs"
                          : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: hex }}
                    >
                      {formColor.toLowerCase() === hex.toLowerCase() && (
                        <span className="text-white text-xs font-bold">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 text-xs font-bold bg-[#00c076] hover:bg-[#00ab68] text-[#0a1612] rounded-xl shadow-xs hover:shadow-md transition-all disabled:opacity-50"
                >
                  {loading ? "Menyimpan..." : "Simpan Kategori"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ──────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 text-xl dark:bg-rose-950/60 dark:text-rose-400">
              ⚠️
            </div>
            <h3 className="text-center text-base font-extrabold text-slate-900 dark:text-zinc-100">
              Hapus Kategori?
            </h3>
            <p className="text-center text-xs text-slate-500 mt-1 dark:text-zinc-400">
              Apakah Anda yakin ingin menghapus kategori{" "}
              <strong className="text-slate-800 dark:text-zinc-200">
                &ldquo;{deleteTarget.name}&rdquo;
              </strong>
              ? Transaksi yang menggunakan kategori ini akan tetap tersimpan tanpa kategori.
            </p>

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
                className="flex-1 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors dark:text-zinc-400 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className="flex-1 py-2.5 text-xs font-bold text-white rounded-xl shadow-xs transition-colors disabled:opacity-50"
                style={{backgroundColor:'#FF0A54'}}
              >
                {deleteLoading ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

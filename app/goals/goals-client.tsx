"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import type { GoalDTO } from "@/services/goal.service";
import type { GoalStatus } from "@/schemas/goal.schema";

interface GoalsClientProps {
  initialGoals: GoalDTO[];
}

export function GoalsClient({ initialGoals }: GoalsClientProps) {
  const [goals, setGoals] = useState<GoalDTO[]>(initialGoals);
  const [selectedTab, setSelectedTab] = useState<"ALL" | GoalStatus>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"DEADLINE" | "PROGRESS_DESC" | "AMOUNT_DESC">("DEADLINE");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [isSubmitting, startTransition] = useTransition();

  const activeCount = goals.filter((g) => g.status === "ACTIVE").length;
  const completedCount = goals.filter((g) => g.status === "COMPLETED").length;
  const pausedCount = goals.filter((g) => g.status === "PAUSED").length;

  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalContributed = goals.reduce((sum, g) => sum + g.contributedAmount, 0);
  const totalRemainingNeeded = Math.max(0, totalTarget - totalContributed);
  const overallPercentage = totalTarget > 0 ? (totalContributed / totalTarget) * 100 : 0;

  // Filtered & Sorted Goals
  const filteredGoals = useMemo(() => {
    return goals
      .filter((g) => {
        if (selectedTab !== "ALL" && g.status !== selectedTab) return false;
        if (searchQuery.trim() && !g.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "PROGRESS_DESC") return b.progressPercentage - a.progressPercentage;
        if (sortBy === "AMOUNT_DESC") return b.targetAmount - a.targetAmount;
        if (sortBy === "DEADLINE") return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
        return 0;
      });
  }, [goals, selectedTab, searchQuery, sortBy]);

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage("Nama target tidak boleh kosong");
      return;
    }
    const amountNum = parseFloat(targetAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setErrorMessage("Target nominal harus lebih dari 0");
      return;
    }
    if (!targetDate) {
      setErrorMessage("Target tanggal deadline harus diisi");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
            targetAmount: targetAmount.trim(),
            targetDate,
            currency: "IDR",
          }),
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          setErrorMessage(json.error?.message || "Gagal membuat target keuangan");
          return;
        }

        setGoals((prev) => [json.data, ...prev]);
        setShowCreateModal(false);
        setName("");
        setDescription("");
        setTargetAmount("");
        setTargetDate("");
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : "Terjadi kesalahan jaringan");
      }
    });
  };

  const handleStatusChange = async (goalId: string, newStatus: GoalStatus) => {
    try {
      const res = await fetch(`/api/v1/goals/${goalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setGoals((prev) => prev.map((g) => (g.id === goalId ? json.data : g)));
      } else {
        alert(json.error?.message || "Gagal mengubah status goal");
      }
    } catch {
      alert("Terjadi kesalahan jaringan");
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus target keuangan ini?")) return;

    try {
      const res = await fetch(`/api/v1/goals/${goalId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setGoals((prev) => prev.filter((g) => g.id !== goalId));
      } else {
        alert(json.error?.message || "Gagal menghapus target keuangan");
      }
    } catch {
      alert("Terjadi kesalahan jaringan");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-2" data-purpose="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Goals
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Wujudkan tujuan keuangan Anda secara terencana dan terukur
          </p>
        </div>
        <button
          onClick={() => {
            setErrorMessage(null);
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-emerald-500/20 transition cursor-pointer"
        >
          <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>+ Tambah Goal</span>
        </button>
      </header>

      {/* Goals KPI Cards (Stitch Style) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {/* KPI 1: Total Goals */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Goals</span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <div className="mt-3 min-w-0">
            <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight whitespace-nowrap truncate" title={`${goals.length} Goals`}>
              {goals.length} Goals
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-slate-400 text-[11px] truncate" title={`${activeCount} Aktif • ${completedCount} Selesai • ${pausedCount} Dijeda`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">{activeCount} Aktif • {completedCount} Selesai • {pausedCount} Dijeda</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Total Terkumpul */}
        <div className="bg-emerald-50/50 rounded-2xl p-4 sm:p-5 border border-emerald-200/70 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800">Total Terkumpul</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <div className="mt-3 min-w-0">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-xl sm:text-2xl font-bold text-emerald-700 tracking-tight whitespace-nowrap truncate" title={formatCurrency(totalContributed)}>
                {formatCurrency(totalContributed)}
              </span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                {overallPercentage.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-emerald-700/80 text-[11px] truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">Akumulasi tabungan dari seluruh target</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Target Keseluruhan */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Target Keseluruhan</span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <div className="mt-3 min-w-0">
            <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight whitespace-nowrap truncate" title={formatCurrency(totalTarget)}>
              {formatCurrency(totalTarget)}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-slate-400 text-[11px] truncate" title={`Sisa yang dibutuhkan: ${formatCurrency(totalRemainingNeeded)}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              <span className="truncate">Sisa yang dibutuhkan: {formatCurrency(totalRemainingNeeded)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* SavingAllocationInsight (Dark Banner Stitch Style) */}
      <section className="bg-gradient-to-r from-[#10221c] to-[#0a1612] text-white rounded-2xl p-5 border border-[#1b382d] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-sm" data-purpose="saving-allocation-insight">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
              Progres Akumulasi Dana Goals & Distribusi Alokasi Tabungan
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-2xl">
              Akumulasi <span className="text-white font-semibold">{formatCurrency(totalContributed)}</span> dari target komitmen {formatCurrency(totalTarget)}. Menabung rutin secara konsisten mempercepat pencapaian tujuan.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <div className="bg-[#162b24] px-3.5 py-2 rounded-xl border border-[#214337] text-left">
            <div className="text-[10px] text-slate-400 font-medium">Progres Akumulasi</div>
            <div className="text-xs font-bold text-emerald-400">{overallPercentage.toFixed(1)}% Tercapai</div>
          </div>
          <div className="bg-[#162b24] px-3.5 py-2 rounded-xl border border-[#214337] text-left">
            <div className="text-[10px] text-slate-400 font-medium">Target Aktif</div>
            <div className="text-xs font-bold text-white">{activeCount} Target Berjalan</div>
          </div>
        </div>
      </section>

      {/* ControlsToolbar (Search, Filter Tabs, Sort) */}
      <section className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search goal */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <input
              type="text"
              placeholder="Cari tujuan keuangan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl pl-8 pr-3 py-2 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
            <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setSelectedTab("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                selectedTab === "ALL"
                  ? "bg-[#0a1612] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Semua ({goals.length})
            </button>
            <button
              onClick={() => setSelectedTab("ACTIVE")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                selectedTab === "ACTIVE"
                  ? "bg-emerald-600 text-white font-bold"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              Aktif ({activeCount})
            </button>
            <button
              onClick={() => setSelectedTab("COMPLETED")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                selectedTab === "COMPLETED"
                  ? "bg-slate-800 text-white font-bold"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Selesai ({completedCount})
            </button>
            <button
              onClick={() => setSelectedTab("PAUSED")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                selectedTab === "PAUSED"
                  ? "bg-amber-600 text-white font-bold"
                  : "bg-amber-50 text-amber-700 hover:bg-amber-100"
              }`}
            >
              Dijeda ({pausedCount})
            </button>
          </div>
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-2 justify-end">
          <label className="text-xs text-slate-500 font-medium whitespace-nowrap">Urutkan:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          >
            <option value="DEADLINE">Tenggat Waktu Terdekat</option>
            <option value="PROGRESS_DESC">Persentase Tertinggi</option>
            <option value="AMOUNT_DESC">Nominal Terbesar</option>
          </select>
        </div>
      </section>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredGoals.map((goal) => {
          const targetDateObj = new Date(goal.targetDate);
          const targetDateStr = targetDateObj.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });

          // Calculate remaining days or months
          const diffMs = targetDateObj.getTime() - new Date().getTime();
          const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          const monthsLeft = Math.ceil(daysLeft / 30);

          return (
            <article
              key={goal.id}
              className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.02)] hover:border-emerald-300 transition-all flex flex-col justify-between relative overflow-hidden group"
            >
              {/* Top Accent Line */}
              <div
                className={`absolute top-0 left-0 right-0 h-1 ${
                  goal.status === "COMPLETED"
                    ? "bg-emerald-500"
                    : goal.status === "PAUSED"
                    ? "bg-amber-400"
                    : "bg-[#00c076]"
                }`}
              />

              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg flex-shrink-0">
                      🎯
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/goals/${goal.id}`}
                        className="text-sm font-bold text-slate-900 hover:text-emerald-600 transition truncate block"
                      >
                        {goal.name}
                      </Link>
                      {goal.description ? (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {goal.description}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-400 mt-0.5">Target Finansial</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="text-slate-300 hover:text-[#FF0A54] p-1 rounded-lg transition"
                      title="Hapus Goal"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Status Pill & Percentage */}
                <div className="mt-4 flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                      goal.status === "COMPLETED"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : goal.status === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : goal.status === "PAUSED"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-slate-50 text-slate-600 border-slate-200"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        goal.status === "COMPLETED"
                          ? "bg-emerald-600"
                          : goal.status === "ACTIVE"
                          ? "bg-[#00c076]"
                          : goal.status === "PAUSED"
                          ? "bg-amber-500"
                          : "bg-slate-400"
                      }`}
                    />
                    {goal.status === "COMPLETED"
                      ? "Selesai"
                      : goal.status === "ACTIVE"
                      ? "Aktif"
                      : goal.status === "PAUSED"
                      ? "Dijeda"
                      : "Diarsipkan"}
                  </span>
                  <span className="text-xs font-bold text-slate-800">
                    {goal.progressPercentage.toFixed(1)}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-100 rounded-full h-2 mt-2.5 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      goal.status === "COMPLETED"
                        ? "bg-emerald-500"
                        : goal.status === "PAUSED"
                        ? "bg-amber-400"
                        : "bg-[#00c076]"
                    }`}
                    style={{ width: `${goal.displayPercentage}%` }}
                  />
                </div>

                {/* Amounts */}
                <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                  <div className="min-w-0">
                    <span className="text-slate-400 block text-[11px]">Terkumpul</span>
                    <span className="font-bold text-slate-900 block whitespace-nowrap truncate" title={formatCurrency(goal.contributedAmount)}>
                      {formatCurrency(goal.contributedAmount)}
                    </span>
                  </div>
                  <div className="text-right min-w-0">
                    <span className="text-slate-400 block text-[11px]">Target</span>
                    <span className="font-semibold text-slate-600 block whitespace-nowrap truncate" title={formatCurrency(goal.targetAmount)}>
                      {formatCurrency(goal.targetAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer / Action */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-700 block">{targetDateStr}</span>
                  {daysLeft > 0 ? `${monthsLeft} bulan lagi` : "Batas waktu lewat"}
                </div>
                <Link
                  href={`/goals/${goal.id}`}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm shadow-emerald-500/20"
                >
                  + Nabung
                </Link>
              </div>
            </article>
          );
        })}

        {/* Dashed Add Goal Card (Stitch Style) */}
        <div
          onClick={() => {
            setErrorMessage(null);
            setShowCreateModal(true);
          }}
          className="border-2 border-dashed border-slate-200 rounded-2xl p-6 hover:border-[#00c076] hover:bg-emerald-50/20 transition cursor-pointer flex flex-col items-center justify-center text-center min-h-[220px] group"
        >
          <div className="w-12 h-12 rounded-2xl bg-slate-100 group-hover:bg-[#00c076]/20 text-slate-400 group-hover:text-[#00c076] flex items-center justify-center transition">
            <svg className="w-6 h-6 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-slate-700 group-hover:text-slate-900 mt-3">
            + Tambah Tujuan Keuangan Baru
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
            Tentukan nominal impian, deadline, dan alokasi tabungan
          </p>
        </div>
      </div>

      {/* Modal Buat Target Baru (Stitch Style) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                Buat Target Keuangan Baru
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {errorMessage && (
              <div className="mt-3 rounded-xl p-3 text-xs" style={{background:'rgba(255,10,84,0.07)',border:'1px solid rgba(255,10,84,0.20)',color:'#c0003b'}}>
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleCreateGoal} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Target *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Umrah Orang Tua, Dana Darurat"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deskripsi (Opsional)
                </label>
                <textarea
                  placeholder="Catatan tambahan untuk target ini..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Nominal (Rp) *
                </label>
                <input
                  type="number"
                  placeholder="Contoh: 30000000"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Tanggal Deadline *
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-sm shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Target"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

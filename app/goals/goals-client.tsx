"use client";

import { useState, useTransition } from "react";
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [isSubmitting, startTransition] = useTransition();

  const filteredGoals = goals.filter((g) => {
    if (selectedTab === "ALL") return true;
    return g.status === selectedTab;
  });

  const activeCount = goals.filter((g) => g.status === "ACTIVE").length;
  const completedCount = goals.filter((g) => g.status === "COMPLETED").length;
  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalContributed = goals.reduce((sum, g) => sum + g.contributedAmount, 0);

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
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Target Keuangan
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Rencanakan dan pantau pencapaian tujuan finansial Anda secara terarah
          </p>
        </div>
        <button
          onClick={() => {
            setErrorMessage(null);
            setShowCreateModal(true);
          }}
          className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          + Tambah Target Baru
        </button>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Target</p>
          <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {goals.length} Target
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Aktif Berjalan</p>
          <p className="mt-1 text-xl font-bold text-blue-600 dark:text-blue-400">
            {activeCount} Target
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Tercapai</p>
          <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {completedCount} Target
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Dana Terkumpul</p>
          <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {formatCurrency(totalContributed)}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">
            dari total target {formatCurrency(totalTarget)}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 mb-6 gap-2">
        {(
          [
            { key: "ALL", label: "Semua" },
            { key: "ACTIVE", label: `Aktif (${activeCount})` },
            { key: "COMPLETED", label: `Selesai (${completedCount})` },
            { key: "PAUSED", label: "Dijeda" },
            { key: "ARCHIVED", label: "Diarsipkan" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelectedTab(tab.key)}
            className={`pb-3 px-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              selectedTab === tab.key
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Goal Cards Grid */}
      {filteredGoals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 p-12 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Tidak ada target keuangan pada kategori ini.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            + Buat Target Sekarang
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredGoals.map((goal) => {
            const targetDateStr = new Date(goal.targetDate).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
              timeZone: "Asia/Jakarta",
            });

            return (
              <div
                key={goal.id}
                className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 transition-shadow hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <Link
                        href={`/goals/${goal.id}`}
                        className="text-lg font-bold text-zinc-900 hover:text-blue-600 dark:text-zinc-100 dark:hover:text-blue-400"
                      >
                        {goal.name}
                      </Link>
                      {goal.description && (
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                          {goal.description}
                        </p>
                      )}
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        goal.status === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400"
                          : goal.status === "ACTIVE"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400"
                          : goal.status === "PAUSED"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400"
                          : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {goal.status === "COMPLETED"
                        ? "Selesai"
                        : goal.status === "ACTIVE"
                        ? "Aktif"
                        : goal.status === "PAUSED"
                        ? "Dijeda"
                        : "Diarsipkan"}
                    </span>
                  </div>

                  {/* Amounts */}
                  <div className="mt-4 flex items-baseline justify-between">
                    <div>
                      <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(goal.contributedAmount)}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        dari target {formatCurrency(goal.targetAmount)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {goal.progressPercentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-500 ${
                        goal.status === "COMPLETED"
                          ? "bg-emerald-500"
                          : goal.progressPercentage >= 50
                          ? "bg-blue-600 dark:bg-blue-500"
                          : "bg-indigo-500"
                      }`}
                      style={{ width: `${goal.displayPercentage}%` }}
                    />
                  </div>

                  {/* Metrics Footer */}
                  <div className="mt-3 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                    <span>
                      {goal.remainingAmount > 0
                        ? `Sisa ${formatCurrency(goal.remainingAmount)}`
                        : "Target tercapai 🎉"}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span>Target: {targetDateStr}</span>
                      {goal.isOverdue && (
                        <span className="font-semibold text-red-600 dark:text-red-400">
                          (Lewat deadline)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <Link
                    href={`/goals/${goal.id}`}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400"
                  >
                    Detail & Tambah Kontribusi →
                  </Link>

                  <div className="flex items-center gap-2">
                    {goal.status === "ACTIVE" && (
                      <button
                        onClick={() => handleStatusChange(goal.id, "PAUSED")}
                        className="rounded-lg px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                      >
                        Jeda
                      </button>
                    )}
                    {goal.status === "PAUSED" && (
                      <button
                        onClick={() => handleStatusChange(goal.id, "ACTIVE")}
                        className="rounded-lg px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                      >
                        Lanjutkan
                      </button>
                    )}
                    {goal.status !== "ARCHIVED" && (
                      <button
                        onClick={() => handleStatusChange(goal.id, "ARCHIVED")}
                        className="rounded-lg px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                      >
                        Arsipkan
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Buat Target Baru */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Buat Target Keuangan Baru
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            {errorMessage && (
              <div className="mb-4 rounded-xl bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/60 dark:text-red-300">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Nama Target *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Umrah Orang Tua, Dana Darurat"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 focus:border-blue-600 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Deskripsi (Opsional)
                </label>
                <textarea
                  placeholder="Catatan tambahan untuk target ini..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 focus:border-blue-600 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Target Nominal (Rp) *
                </label>
                <input
                  type="number"
                  placeholder="Contoh: 30000000"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 focus:border-blue-600 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Target Tanggal Deadline *
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 focus:border-blue-600 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  required
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
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

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import type { GoalDTO, ContributionDTO } from "@/services/goal.service";
import type { GoalStatus } from "@/schemas/goal.schema";

interface TransactionOption {
  id: string;
  description: string;
  amount: number;
  type: string;
  date: Date;
}

interface GoalDetailClientProps {
  initialGoal: GoalDTO;
  initialContributions: ContributionDTO[];
  userTransactions: TransactionOption[];
}

export function GoalDetailClient({
  initialGoal,
  initialContributions,
  userTransactions,
}: GoalDetailClientProps) {
  const router = useRouter();
  const [goal, setGoal] = useState<GoalDTO>(initialGoal);
  const [contributions, setContributions] = useState<ContributionDTO[]>(initialContributions);

  // Modals
  const [showAddContribModal, setShowAddContribModal] = useState(false);
  const [showEditGoalModal, setShowEditGoalModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Add Contribution form
  const [contribAmount, setContribAmount] = useState("");
  const [contribDate, setContribDate] = useState(
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })
  );
  const [contribDesc, setContribDesc] = useState("");
  const [selectedTxId, setSelectedTxId] = useState<string>("");

  // Edit Goal form
  const [editName, setEditName] = useState(goal.name);
  const [editDesc, setEditDesc] = useState(goal.description || "");
  const [editTarget, setEditTarget] = useState(String(goal.targetAmount));
  const [editDate, setEditDate] = useState(
    new Date(goal.targetDate).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })
  );

  const [isSubmitting, startTransition] = useTransition();

  const refreshGoalData = async () => {
    try {
      const [goalRes, contribRes] = await Promise.all([
        fetch(`/api/v1/goals/${goal.id}`),
        fetch(`/api/v1/goals/${goal.id}/contributions`),
      ]);
      const goalJson = await goalRes.json();
      const contribJson = await contribRes.json();
      if (goalJson.success) setGoal(goalJson.data);
      if (contribJson.success) setContributions(contribJson.data);
    } catch {
      // silently handle refresh failure
    }
  };

  const handleAddContribution = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const amountNum = parseFloat(contribAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setErrorMessage("Nominal kontribusi harus lebih dari 0");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/goals/${goal.id}/contributions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: contribAmount.trim(),
            contributionDate: contribDate || undefined,
            description: contribDesc.trim() || undefined,
            transactionId: selectedTxId || undefined,
          }),
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          setErrorMessage(json.error?.message || "Gagal menambahkan kontribusi");
          return;
        }

        setShowAddContribModal(false);
        setContribAmount("");
        setContribDesc("");
        setSelectedTxId("");
        await refreshGoalData();
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : "Terjadi kesalahan jaringan");
      }
    });
  };

  const handleDeleteContribution = async (contribId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus kontribusi ini?")) return;

    try {
      const res = await fetch(`/api/v1/goals/${goal.id}/contributions/${contribId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        await refreshGoalData();
      } else {
        alert(json.error?.message || "Gagal menghapus kontribusi");
      }
    } catch {
      alert("Terjadi kesalahan jaringan");
    }
  };

  const handleEditGoal = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!editName.trim()) {
      setErrorMessage("Nama target tidak boleh kosong");
      return;
    }
    const targetNum = parseFloat(editTarget);
    if (isNaN(targetNum) || targetNum <= 0) {
      setErrorMessage("Target nominal harus lebih dari 0");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/goals/${goal.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editName.trim(),
            description: editDesc.trim() || undefined,
            targetAmount: editTarget.trim(),
            targetDate: editDate,
          }),
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          setErrorMessage(json.error?.message || "Gagal memperbarui target keuangan");
          return;
        }

        setGoal(json.data);
        setShowEditGoalModal(false);
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : "Terjadi kesalahan jaringan");
      }
    });
  };

  const handleStatusChange = async (newStatus: GoalStatus) => {
    try {
      const res = await fetch(`/api/v1/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setGoal(json.data);
      } else {
        alert(json.error?.message || "Gagal mengubah status");
      }
    } catch {
      alert("Terjadi kesalahan jaringan");
    }
  };

  const handleDeleteGoal = async () => {
    if (!confirm("Hapus target keuangan ini?")) return;

    try {
      const res = await fetch(`/api/v1/goals/${goal.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        router.push("/goals");
      } else {
        alert(json.error?.message || "Gagal menghapus target keuangan");
      }
    } catch {
      alert("Terjadi kesalahan jaringan");
    }
  };

  const targetDateStr = new Date(goal.targetDate).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });

  return (
    <div>
      {/* Top Navigation Back Link */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/goals"
          className="text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          ← Kembali ke Semua Target
        </Link>
        <div className="flex items-center gap-2">
          {goal.status === "ACTIVE" && (
            <button
              onClick={() => handleStatusChange("PAUSED")}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Jeda Target
            </button>
          )}
          {goal.status === "PAUSED" && (
            <button
              onClick={() => handleStatusChange("ACTIVE")}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Lanjutkan Target
            </button>
          )}
          {goal.status !== "ARCHIVED" && (
            <button
              onClick={() => handleStatusChange("ARCHIVED")}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Arsipkan
            </button>
          )}
          <button
            onClick={() => {
              setErrorMessage(null);
              setShowEditGoalModal(true);
            }}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Ubah
          </button>
          <button
            onClick={handleDeleteGoal}
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400"
          >
            Hapus
          </button>
        </div>
      </div>

      {/* Main Goal Hero Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {goal.name}
              </h1>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
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
            {goal.description && (
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-xl">
                {goal.description}
              </p>
            )}
          </div>

          <button
            onClick={() => {
              setErrorMessage(null);
              setShowAddContribModal(true);
            }}
            disabled={goal.status === "ARCHIVED"}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
          >
            + Tambah Kontribusi
          </button>
        </div>

        {/* Progress Bar & Amounts */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6 border-y border-zinc-100 dark:border-zinc-800 py-6">
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Terkumpul</p>
            <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {formatCurrency(goal.contributedAmount)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Target Nominal</p>
            <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {formatCurrency(goal.targetAmount)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Sisa Kebutuhan</p>
            <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">
              {goal.remainingAmount > 0
                ? formatCurrency(goal.remainingAmount)
                : "Target Tercapai 🎉"}
            </p>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              Progres Pencapaian
            </span>
            <span className="font-bold text-blue-600 dark:text-blue-400">
              {goal.progressPercentage.toFixed(1)}%
            </span>
          </div>
          <div className="h-3.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className={`h-3.5 rounded-full transition-all duration-500 ${
                goal.status === "COMPLETED"
                  ? "bg-emerald-500"
                  : goal.progressPercentage >= 50
                  ? "bg-blue-600 dark:bg-blue-500"
                  : "bg-indigo-500"
              }`}
              style={{ width: `${goal.displayPercentage}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>Deadline: {targetDateStr}</span>
            {goal.isOverdue ? (
              <span className="font-semibold text-red-600 dark:text-red-400">
                ⚠ Waktu telah melewati deadline
              </span>
            ) : (
              <span>{goal.daysRemaining} hari tersisa</span>
            )}
          </div>
        </div>
      </div>

      {/* Contributions Section */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Riwayat Alokasi & Kontribusi
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Daftar kontribusi dana yang dialokasikan untuk target ini
            </p>
          </div>
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            {contributions.length} Catatan
          </span>
        </div>

        {contributions.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Belum ada kontribusi yang dicatat untuk target ini.
            </p>
            <button
              onClick={() => {
                setErrorMessage(null);
                setShowAddContribModal(true);
              }}
              className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              + Catat Kontribusi Pertama
            </button>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {contributions.map((c) => {
              const cDateStr = new Date(c.contributionDate).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "Asia/Jakarta",
              });

              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between px-6 py-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(c.amount)}
                      </p>
                      {c.transactionId && (
                        <span className="rounded-md bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                          Terkait Transaksi
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {cDateStr}
                      {c.description ? ` • ${c.description}` : ""}
                      {c.transactionDescription ? ` (Ref: ${c.transactionDescription})` : ""}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDeleteContribution(c.id)}
                    className="ml-4 rounded-lg px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    Hapus
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Tambah Kontribusi */}
      {showAddContribModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Tambah Kontribusi Target
              </h2>
              <button
                onClick={() => setShowAddContribModal(false)}
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

            <form onSubmit={handleAddContribution} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Nominal Kontribusi (Rp) *
                </label>
                <input
                  type="number"
                  placeholder="Contoh: 1000000"
                  value={contribAmount}
                  onChange={(e) => setContribAmount(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 focus:border-blue-600 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  required
                />
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Maksimal yang dapat ditambahkan: {formatCurrency(goal.remainingAmount)}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Tanggal Kontribusi
                </label>
                <input
                  type="date"
                  value={contribDate}
                  onChange={(e) => setContribDate(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 focus:border-blue-600 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Keterangan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Tabungan gaji bulan ini"
                  value={contribDesc}
                  onChange={(e) => setContribDesc(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 focus:border-blue-600 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Hubungkan dengan Transaksi (Opsional)
                </label>
                <select
                  value={selectedTxId}
                  onChange={(e) => {
                    const txId = e.target.value;
                    setSelectedTxId(txId);
                    if (txId) {
                      const found = userTransactions.find((t) => t.id === txId);
                      if (found && !contribAmount) {
                        setContribAmount(String(found.amount));
                      }
                    }
                  }}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 focus:border-blue-600 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="">-- Tanpa Hubungan Transaksi --</option>
                  {userTransactions.map((tx) => (
                    <option key={tx.id} value={tx.id}>
                      {tx.description} ({formatCurrency(tx.amount)})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Hanya sebagai referensi alokasi, tidak mengubah saldo akun atau memotong uang dua kali.
                </p>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddContribModal(false)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Kontribusi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ubah Goal */}
      {showEditGoalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Ubah Target Keuangan
              </h2>
              <button
                onClick={() => setShowEditGoalModal(false)}
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

            <form onSubmit={handleEditGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Nama Target *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 focus:border-blue-600 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Deskripsi
                </label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
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
                  value={editTarget}
                  onChange={(e) => setEditTarget(e.target.value)}
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
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 focus:border-blue-600 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  required
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditGoalModal(false)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

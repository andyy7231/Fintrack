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
    if (!confirm("Hapus catatan kontribusi ini?")) return;

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
          setErrorMessage(json.error?.message || "Gagal mengubah target");
          return;
        }

        setShowEditGoalModal(false);
        setGoal(json.data);
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
        alert(json.error?.message || "Gagal mengubah status goal");
      }
    } catch {
      alert("Terjadi kesalahan jaringan");
    }
  };

  const handleDeleteGoal = async () => {
    if (!confirm(`Hapus permanen target "${goal.name}" beserta riwayat kontribusinya?`)) return;

    try {
      const res = await fetch(`/api/v1/goals/${goal.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        router.push("/goals");
      } else {
        alert(json.error?.message || "Gagal menghapus target");
      }
    } catch {
      alert("Terjadi kesalahan jaringan");
    }
  };

  const targetDateStr = new Date(goal.targetDate).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Top Navigation Back Link & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
        <Link
          href="/goals"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-600 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M19 12H5m7 7l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Kembali ke Semua Target
        </Link>
        <div className="flex items-center gap-2">
          {goal.status === "ACTIVE" && (
            <button
              onClick={() => handleStatusChange("PAUSED")}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
            >
              Jeda Target
            </button>
          )}
          {goal.status === "PAUSED" && (
            <button
              onClick={() => handleStatusChange("ACTIVE")}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
            >
              Lanjutkan Target
            </button>
          )}
          {goal.status !== "ARCHIVED" && (
            <button
              onClick={() => handleStatusChange("ARCHIVED")}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
            >
              Arsipkan
            </button>
          )}
          <button
            onClick={() => {
              setErrorMessage(null);
              setShowEditGoalModal(true);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            Ubah
          </button>
          <button
            onClick={handleDeleteGoal}
            className="rounded-xl px-3 py-1.5 text-xs font-semibold transition"
            style={{background:'rgba(255,10,84,0.08)',color:'#FF0A54',border:'1px solid rgba(255,10,84,0.20)'}}
          >
            Hapus
          </button>
        </div>
      </div>

      {/* Main Goal Hero Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl flex-shrink-0">
                🎯
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {goal.name}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                      goal.status === "COMPLETED"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : goal.status === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : goal.status === "PAUSED"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-slate-100 text-slate-700 border-slate-200"
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
              </div>
            </div>
            {goal.description && (
              <p className="mt-3 text-xs text-slate-500 max-w-xl">
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
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm shadow-emerald-500/20 hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
          >
            + Tambah Kontribusi (Nabung)
          </button>
        </div>

        {/* Progress Bar & Amounts */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6 border-y border-slate-100 py-6">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Terkumpul</span>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {formatCurrency(goal.contributedAmount)}
            </p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Nominal</span>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {formatCurrency(goal.targetAmount)}
            </p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sisa Kebutuhan</span>
            <p className="mt-1 text-2xl font-bold text-emerald-600">
              {goal.remainingAmount > 0
                ? formatCurrency(goal.remainingAmount)
                : "Target Tercapai 🎉"}
            </p>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-slate-700">
              Progres Pencapaian
            </span>
            <span className="font-bold text-emerald-600">
              {goal.progressPercentage.toFixed(1)}%
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-3 rounded-full transition-all duration-500 bg-emerald-500"
              style={{ width: `${goal.displayPercentage}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <span>Deadline: {targetDateStr}</span>
            {goal.isOverdue ? (
              <span className="font-semibold" style={{color:'#FF0A54'}}>
                ⚠ Waktu telah melewati deadline
              </span>
            ) : (
              <span>{goal.daysRemaining} hari tersisa</span>
            )}
          </div>
        </div>
      </div>

      {/* Contributions Section */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Aktivitas Setoran Terakhir (Mutasi Goals)
            </h2>
            <p className="text-xs text-slate-500">
              Riwayat setoran tabungan rutin ke tujuan finansial ini
            </p>
          </div>
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
            {contributions.length} Transaksi
          </span>
        </div>

        {contributions.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-xs text-slate-400">
              Belum ada kontribusi yang dicatat untuk target ini.
            </p>
            <button
              onClick={() => {
                setErrorMessage(null);
                setShowAddContribModal(true);
              }}
              className="mt-3 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition cursor-pointer"
            >
              + Catat Kontribusi Pertama
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-5">Tanggal</th>
                  <th className="py-3 px-5">Keterangan</th>
                  <th className="py-3 px-5">Nominal Setoran</th>
                  <th className="py-3 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contributions.map((c) => {
                  const cDateStr = new Date(c.contributionDate).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-5 text-slate-500 whitespace-nowrap">
                        {cDateStr}
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-slate-800">
                        {c.description || "Setoran Tabungan"}
                        {c.transactionDescription && (
                          <span className="block text-[11px] text-slate-400 font-normal">
                            Ref: {c.transactionDescription}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 font-bold text-emerald-600 whitespace-nowrap">
                        + {formatCurrency(c.amount)}
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleDeleteContribution(c.id)}
                          className="text-slate-400 hover:text-[#FF0A54] p-1 rounded-lg transition"
                          title="Hapus Kontribusi"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Tambah Kontribusi */}
      {showAddContribModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                Tambah Kontribusi Target
              </h2>
              <button
                onClick={() => setShowAddContribModal(false)}
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

            <form onSubmit={handleAddContribution} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nominal Kontribusi (Rp) *
                </label>
                <input
                  type="number"
                  placeholder="Contoh: 1000000"
                  value={contribAmount}
                  onChange={(e) => setContribAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  required
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Maksimal yang dibutuhkan: {formatCurrency(goal.remainingAmount)}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tanggal Kontribusi
                </label>
                <input
                  type="date"
                  value={contribDate}
                  onChange={(e) => setContribDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Keterangan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Tabungan gaji bulan ini"
                  value={contribDesc}
                  onChange={(e) => setContribDesc(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="">-- Tanpa Hubungan Transaksi --</option>
                  {userTransactions.map((tx) => (
                    <option key={tx.id} value={tx.id}>
                      {tx.description} ({formatCurrency(tx.amount)})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  Hanya sebagai referensi alokasi, tidak mengurangi saldo riil ganda.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddContribModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-sm shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
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
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                Ubah Target Keuangan
              </h2>
              <button
                onClick={() => setShowEditGoalModal(false)}
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

            <form onSubmit={handleEditGoal} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Target *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deskripsi
                </label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
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
                  value={editTarget}
                  onChange={(e) => setEditTarget(e.target.value)}
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
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditGoalModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-sm shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
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

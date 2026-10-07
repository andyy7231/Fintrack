"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";

interface TransferItem {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  description: string | null;
  transferDate: Date | string;
  createdAt: Date | string;
}

interface AccountOption {
  id: string;
  name: string;
  currentBalance: number;
  currency: string;
}

interface TransfersClientProps {
  initialTransfers: TransferItem[];
  accounts: AccountOption[];
}

export function TransfersClient({ initialTransfers, accounts }: TransfersClientProps) {
  const [list, setList] = useState<TransferItem[]>(initialTransfers);
  const [showModal, setShowModal] = useState(false);
  const [fromAccountId, setFromAccountId] = useState(accounts[0]?.id || "");
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id || "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAccountName = (id: string) => {
    return accounts.find((a) => a.id === id)?.name || "Akun";
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (fromAccountId === toAccountId) {
      setError("Akun asal dan akun tujuan tidak boleh sama.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/v1/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAccountId,
          toAccountId,
          amount,
          description: description || undefined,
          transferDate: new Date(date).toISOString(),
        }),
      });

      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || "Gagal melakukan transfer.");
      } else {
        const refresh = await fetch("/api/v1/transfers");
        const refreshJson = await refresh.json();
        if (refreshJson.success) {
          setList(refreshJson.data);
        }
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2" data-purpose="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Transfer Antar Akun
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Pindahkan dana antar rekening tanpa mempengaruhi grafik pemasukan dan pengeluaran
          </p>
        </div>
        <button
          onClick={() => {
            if (accounts.length < 2) {
              alert("Anda membutuhkan minimal 2 akun keuangan untuk melakukan transfer.");
              return;
            }
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-500/20 transition cursor-pointer"
        >
          <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>⇄ Transfer Baru</span>
        </button>
      </div>

      {/* Accounting context callout banner (Stitch Style) */}
      <div className="bg-gradient-to-r from-[#10221c] to-[#0a1612] text-white rounded-2xl p-5 border border-[#1b382d] flex items-start gap-3 shadow-sm">
        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
            Prinsip Akuntansi FinTrack
          </span>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Pemindahan saldo antar akun diperlakukan secara atomik dan <span className="text-white font-semibold">bukan</span> merupakan pemasukan atau pengeluaran. Total kekayaan bersih Anda tetap terjaga.
          </p>
        </div>
      </div>

      {/* Transfer History Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-sm font-bold text-slate-900">
            Riwayat Pemindahan Saldo
          </h2>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
            {list.length} Transaksi
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
            <thead className="bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3.5">Tanggal</th>
                <th className="px-6 py-3.5">Dari Akun</th>
                <th className="px-6 py-3.5">Ke Akun</th>
                <th className="px-6 py-3.5">Deskripsi</th>
                <th className="px-6 py-3.5 text-right">Nominal Transfer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {list.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    Belum ada riwayat transfer saldo antar akun.
                  </td>
                </tr>
              ) : (
                list.map((tr) => (
                  <tr key={tr.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-3.5 whitespace-nowrap text-slate-500">
                      {new Date(tr.transferDate).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold text-xs" style={{background:'rgba(255,10,84,0.08)',color:'#FF0A54',border:'1px solid rgba(255,10,84,0.20)'}}>
                        <span>📤</span>
                        {getAccountName(tr.fromAccountId)}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200/60">
                        <span>📥</span>
                        {getAccountName(tr.toAccountId)}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-600">
                      {tr.description || "-"}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap text-right font-bold text-slate-900">
                      {formatCurrency(parseFloat(tr.amount))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add Transfer */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                Transfer Saldo Antar Akun
              </h2>
              <button
                onClick={() => setShowModal(false)}
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
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Dari Akun (Sumber Dana) *
                </label>
                <select
                  required
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (Saldo: {formatCurrency(acc.currentBalance, acc.currency)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ke Akun (Penerima Dana) *
                </label>
                <select
                  required
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (Saldo: {formatCurrency(acc.currentBalance, acc.currency)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nominal Transfer (Rp) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  placeholder="Contoh: 100000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deskripsi / Catatan Transfer
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Top up GoPay dari BCA"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tanggal Transaksi *
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-sm shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Memproses..." : "Eksekusi Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

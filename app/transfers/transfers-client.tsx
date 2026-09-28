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
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Transfer Antar Akun
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
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
          className="cursor-pointer self-start sm:self-auto rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          ⇄ Transfer Baru
        </button>
      </div>

      {/* Note about transfer */}
      <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-xs text-blue-700 dark:border-blue-900/30 dark:bg-blue-950/20 dark:text-blue-300">
        💡 <strong>Prinsip Akuntansi FinTrack:</strong> Pemindahan saldo antar akun diperlakukan secara
        atomik dan <em>bukan</em> merupakan pemasukan atau pengeluaran. Total kekayaan bersih Anda
        tetap terjaga.
      </div>

      {/* Transfer History Table */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-850 text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Tanggal</th>
                <th className="px-4 py-3 font-semibold">Dari Akun</th>
                <th className="px-4 py-3 font-semibold">Ke Akun</th>
                <th className="px-4 py-3 font-semibold">Deskripsi</th>
                <th className="px-4 py-3 font-semibold text-right">Nominal Transfer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {list.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                    Belum ada riwayat transfer.
                  </td>
                </tr>
              ) : (
                list.map((tr) => (
                  <tr key={tr.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                    <td className="px-4 py-3.5 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                      {new Date(tr.transferDate).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-red-600 dark:text-red-400">
                      {getAccountName(tr.fromAccountId)}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-emerald-600 dark:text-emerald-400">
                      {getAccountName(tr.toAccountId)}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-600 dark:text-zinc-300">
                      {tr.description || "-"}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-right font-bold text-zinc-900 dark:text-zinc-100">
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
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Transfer Saldo Antar Akun
            </h2>

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Dari Akun (Sumber Dana)
                </label>
                <select
                  required
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (Saldo: {formatCurrency(acc.currentBalance, acc.currency)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Ke Akun (Penerima Dana)
                </label>
                <select
                  required
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (Saldo: {formatCurrency(acc.currentBalance, acc.currency)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Nominal Transfer (Rp)
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  placeholder="Contoh: 100000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Deskripsi / Catatan Transfer
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Top up GoPay dari BCA"
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

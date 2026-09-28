"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { AccountWithBalance } from "@/services/account.service";

interface AccountsClientProps {
  initialAccounts: AccountWithBalance[];
}

export function AccountsClient({ initialAccounts }: AccountsClientProps) {
  const [accountsList, setAccountsList] = useState<AccountWithBalance[]>(initialAccounts);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"CASH" | "BANK" | "E_WALLET" | "OTHER">("BANK");
  const [initialBalance, setInitialBalance] = useState("0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/v1/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type,
          initialBalance,
          currency: "IDR",
        }),
      });

      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || "Gagal membuat akun.");
      } else {
        // Refetch accounts list
        const refreshRes = await fetch("/api/v1/accounts");
        const refreshJson = await refreshRes.json();
        if (refreshJson.success) {
          setAccountsList(refreshJson.data);
        }
        setShowModal(false);
        setName("");
        setInitialBalance("0");
      }
    } catch {
      setError("Terjadi kendala jaringan saat membuat akun.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (accountId: string, accountName: string) => {
    if (!confirm(`Nonaktifkan akun "${accountName}"? Riwayat transaksi akan tetap tersimpan.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/accounts/${accountId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setAccountsList((prev) =>
          prev.map((acc) => (acc.id === accountId ? { ...acc, isActive: false } : acc))
        );
      } else {
        alert(json.error?.message || "Gagal menonaktifkan akun.");
      }
    } catch {
      alert("Gagal menonaktifkan akun.");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Akun Keuangan
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Kelola dompet tunai, rekening bank, dan e-wallet Anda
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          + Tambah Akun
        </button>
      </div>

      {/* Account Cards Grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accountsList.map((acc) => (
          <div
            key={acc.id}
            className={`rounded-2xl border bg-white p-5 shadow-xs transition-shadow dark:bg-zinc-900 ${
              acc.isActive
                ? "border-zinc-200 dark:border-zinc-800"
                : "border-zinc-200/60 opacity-60 dark:border-zinc-800/60"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {acc.type}
                </span>
                <h3 className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {acc.name}
                </h3>
              </div>
              <div>
                {acc.isActive ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                    Aktif
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    Nonaktif
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Saldo Saat Ini</p>
              <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {formatCurrency(acc.currentBalance, acc.currency)}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Saldo Awal: {formatCurrency(parseFloat(acc.initialBalance), acc.currency)}
              </p>
            </div>

            {acc.isActive && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => handleDeactivate(acc.id, acc.name)}
                  className="cursor-pointer text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  Nonaktifkan
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {accountsList.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500">Belum ada akun keuangan yang dibuat.</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-3 cursor-pointer rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Buat Akun Sekarang
          </button>
        </div>
      )}

      {/* Modal Add Account */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Tambah Akun Keuangan Baru
            </h2>

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Nama Akun
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: BCA, Dompet Tunai, GoPay"
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Jenis Akun
                </label>
                <select
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as "CASH" | "BANK" | "E_WALLET" | "OTHER")
                  }
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="BANK">BANK (BCA, Mandiri, BRI, dll)</option>
                  <option value="CASH">CASH (Uang Tunai / Dompet)</option>
                  <option value="E_WALLET">E-WALLET (GoPay, OVO, DANA, ShopeePay)</option>
                  <option value="OTHER">OTHER (Lainnya)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Saldo Awal (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
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
                  {loading ? "Menyimpan..." : "Simpan Akun"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

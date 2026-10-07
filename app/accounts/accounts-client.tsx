"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
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

  // Calculations
  const activeAccounts = useMemo(() => accountsList.filter((a) => a.isActive), [accountsList]);
  const totalBalance = useMemo(
    () => activeAccounts.reduce((sum, a) => sum + a.currentBalance, 0),
    [activeAccounts]
  );
  const bankBalance = useMemo(
    () => activeAccounts.filter((a) => a.type === "BANK" || a.type === "CASH").reduce((sum, a) => sum + a.currentBalance, 0),
    [activeAccounts]
  );
  const ewalletBalance = useMemo(
    () => activeAccounts.filter((a) => a.type === "E_WALLET").reduce((sum, a) => sum + a.currentBalance, 0),
    [activeAccounts]
  );
  const otherBalance = useMemo(
    () => activeAccounts.filter((a) => a.type === "OTHER").reduce((sum, a) => sum + a.currentBalance, 0),
    [activeAccounts]
  );

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

  const getTypeIcon = (t: string) => {
    switch (t) {
      case "BANK":
        return "🏦";
      case "CASH":
        return "💵";
      case "E_WALLET":
        return "📱";
      default:
        return "💳";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <section className="flex flex-wrap items-center justify-between gap-4 pb-2" data-purpose="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Akun Keuangan
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Kelola dompet tunai, rekening bank, dan e-wallet Anda
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/transfers"
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 shadow-sm transition"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Transfer Antar Akun</span>
          </Link>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-500/20 transition cursor-pointer"
          >
            <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>+ Tambah Akun</span>
          </button>
        </div>
      </section>

      {/* KPI Overview Cards (Stitch Style) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-purpose="kpi-overview-cards">
        {/* Hero Card: Total Saldo Seluruh Akun */}
        <div className="bg-gradient-to-br from-[#09221a] to-[#0c3125] text-white p-4 sm:p-5 rounded-2xl border border-emerald-900/60 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-300 truncate">
              Total Saldo Seluruh Akun
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <div className="min-w-0 mt-3">
            <div
              title={formatCurrency(totalBalance)}
              className="text-xl sm:text-2xl font-bold text-white whitespace-nowrap truncate"
            >
              {formatCurrency(totalBalance)}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-emerald-800/40 flex items-center justify-between">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
              Likuid
            </span>
            <span className="text-[11px] text-emerald-200/70 font-medium truncate">
              {activeAccounts.length} Akun Aktif
            </span>
          </div>
        </div>

        {/* KPI Card 2: Kas & Bank */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 truncate">
              Kas & Bank
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm shrink-0">
              🏦
            </div>
          </div>
          <div className="min-w-0 mt-3">
            <div
              title={formatCurrency(bankBalance)}
              className="text-lg sm:text-xl font-bold text-slate-900 whitespace-nowrap truncate"
            >
              {formatCurrency(bankBalance)}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 truncate">
            <span>Rekening & Kas Tunai</span>
          </div>
        </div>

        {/* KPI Card 3: Dompet Digital */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 truncate">
              Dompet Digital (E-Wallet)
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center text-sm shrink-0">
              📱
            </div>
          </div>
          <div className="min-w-0 mt-3">
            <div
              title={formatCurrency(ewalletBalance)}
              className="text-lg sm:text-xl font-bold text-slate-900 whitespace-nowrap truncate"
            >
              {formatCurrency(ewalletBalance)}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 truncate">
            <span>GoPay, OVO, DANA, dll</span>
          </div>
        </div>

        {/* KPI Card 4: Lainnya */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 truncate">
              Akun Lainnya
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-sm shrink-0">
              💳
            </div>
          </div>
          <div className="min-w-0 mt-3">
            <div
              title={formatCurrency(otherBalance)}
              className="text-lg sm:text-xl font-bold text-slate-900 whitespace-nowrap truncate"
            >
              {formatCurrency(otherBalance)}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 truncate">
            <span>Investasi & Lain-lain</span>
          </div>
        </div>
      </section>

      {/* Account Cards Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {accountsList.map((acc) => (
          <div
            key={acc.id}
            className={`rounded-2xl border bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] hover:shadow-md transition-all flex flex-col justify-between ${
              acc.isActive
                ? "border-slate-200/80"
                : "border-slate-200/50 opacity-60 bg-slate-50/50"
            }`}
          >
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg">
                    {getTypeIcon(acc.type)}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {acc.name}
                    </h3>
                    <span className="inline-flex items-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      {acc.type}
                    </span>
                  </div>
                </div>
                <div>
                  {acc.isActive ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Aktif
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-500">
                      Nonaktif
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Saldo Saat Ini
                </span>
                <p className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
                  {formatCurrency(acc.currentBalance, acc.currency)}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Saldo Awal: {formatCurrency(parseFloat(acc.initialBalance), acc.currency)}
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <Link
                href="/transfers"
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition"
              >
                Transfer Dana →
              </Link>
              {acc.isActive && (
                <button
                  onClick={() => handleDeactivate(acc.id, acc.name)}
                  className="cursor-pointer text-xs font-semibold"
                  style={{color:'#FF0A54'}}
                  onMouseEnter={e=>(e.currentTarget.style.color='#d50040')}
                  onMouseLeave={e=>(e.currentTarget.style.color='#FF0A54')}
                >
                  Nonaktifkan
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Dashed Add Account Card */}
        <div
          onClick={() => setShowModal(true)}
          className="border-2 border-dashed border-slate-200 rounded-2xl p-6 hover:border-emerald-500 hover:bg-emerald-50/20 transition cursor-pointer flex flex-col items-center justify-center text-center min-h-[200px] group"
        >
          <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-emerald-500/20 text-slate-400 group-hover:text-emerald-600 flex items-center justify-center transition">
            <svg className="w-5 h-5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-slate-700 group-hover:text-slate-900 mt-3">
            + Tambah Akun Baru
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            BCA, Mandiri, GoPay, Dompet Tunai
          </p>
        </div>
      </div>

      {/* Modal Add Account (Stitch Style) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                Tambah Akun Keuangan Baru
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
                  Nama Akun Keuangan *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: BCA Tabungan, Dompet Tunai, GoPay"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jenis Akun *
                </label>
                <select
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as "CASH" | "BANK" | "E_WALLET" | "OTHER")
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="BANK">BANK (BCA, Mandiri, BRI, BNI, dll)</option>
                  <option value="CASH">CASH (Uang Tunai / Dompet)</option>
                  <option value="E_WALLET">E-WALLET (GoPay, OVO, DANA, ShopeePay)</option>
                  <option value="OTHER">OTHER (Investasi / Lainnya)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Saldo Awal (Rp) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
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

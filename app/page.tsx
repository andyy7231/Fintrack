import Link from "next/link";
import Image from "next/image";
import { getCurrentUser } from "@/lib/auth/session";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen bg-[#0a1612] text-slate-200">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between p-12 bg-[#0a1612] border-r border-[#132820]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-black border border-emerald-500/30 shadow-lg shadow-emerald-500/20">
            <Image src="/fintrack-logo.png" alt="FinTrack" width={40} height={40} className="w-full h-full object-cover" priority />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-white">FinTrack</span>
        </div>

        <div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight leading-tight">
            Kelola keuangan Anda<br />
            <span className="text-[#00c076]">lebih cerdas.</span>
          </h1>
          <p className="mt-4 text-slate-400 text-lg leading-relaxed">
            Catat transaksi via WhatsApp, pantau budget, lacak tujuan keuangan — semua dalam satu dashboard yang elegan.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            {[
              "💬 Catat transaksi via WhatsApp",
              "📊 Dashboard keuangan real-time",
              "🎯 Manajemen budget & goals",
              "🔐 Aman & terenkripsi",
            ].map((feat) => (
              <div key={feat} className="flex items-center gap-2 text-sm text-slate-300">
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-600">
          © 2026 FinTrack · Personal Finance Manager
        </p>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 bg-[#f6f8f9] text-slate-900">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-10 justify-center">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-black border border-emerald-500/30 shadow-lg shadow-emerald-500/20">
              <Image src="/fintrack-logo.png" alt="FinTrack" width={40} height={40} className="w-full h-full object-cover" priority />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-[#0a1612]">FinTrack</span>
          </div>

          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {user ? `Selamat kembali, ${user.name}! 👋` : "Selamat datang!"}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {user
              ? "Lanjutkan ke dashboard keuangan Anda."
              : "Masuk atau buat akun baru untuk mulai."}
          </p>

          <div className="mt-8 flex flex-col gap-3">
            {user ? (
              <Link
                href="/dashboard"
                className="w-full flex items-center justify-center rounded-xl bg-[#00c076] hover:bg-[#00ab68] px-6 py-3 text-sm font-bold text-[#0a1612] shadow-sm transition-all hover:shadow-md"
              >
                Masuk ke Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="w-full flex items-center justify-center rounded-xl bg-[#00c076] hover:bg-[#00ab68] px-6 py-3 text-sm font-bold text-[#0a1612] shadow-sm transition-all hover:shadow-md"
                >
                  Masuk / Login
                </Link>
                <Link
                  href="/register"
                  className="w-full flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-all"
                >
                  Daftar Akun Baru
                </Link>
              </>
            )}
          </div>

          <p className="mt-8 text-center text-xs text-slate-400">
            🔒 Aman ditenagai <strong>Better Auth</strong> &amp; <strong>PostgreSQL</strong>
          </p>
        </div>
      </div>
    </div>
  );
}

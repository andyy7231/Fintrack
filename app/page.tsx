import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 text-center dark:bg-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 font-bold text-white text-2xl shadow-lg shadow-blue-500/20">
          FT
        </div>
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-5xl">
          FinTrack
        </h1>
        <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">
          Personal Finance Management Web + WhatsApp
        </p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">
          Catat transaksi semudah mengirim pesan WhatsApp, kelola keuangan secara terstruktur di web.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          {user ? (
            <Link
              href="/dashboard"
              className="w-full rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 sm:w-auto"
            >
              Masuk ke Dashboard ({user.name})
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="w-full rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 sm:w-auto"
              >
                Masuk / Login
              </Link>
              <Link
                href="/register"
                className="w-full rounded-xl border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:w-auto"
              >
                Daftar Akun Baru
              </Link>
            </>
          )}
        </div>

        <div className="mt-12 rounded-xl border border-zinc-200 bg-white p-4 text-xs text-zinc-500 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          🔒 Autentikasi aman ditenagai oleh <strong>Better Auth</strong> &amp; <strong>PostgreSQL</strong>.
        </div>
      </div>
    </div>
  );
}

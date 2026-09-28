import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { AppHeader } from "@/components/navigation/app-header";

export default async function ProfilePage() {
  const sessionData = await getSession();

  if (!sessionData?.user) {
    redirect("/login");
  }

  const { user } = sessionData;
  const currency = ((user as Record<string, unknown>).currency as string) || "IDR";
  const timezone = ((user as Record<string, unknown>).timezone as string) || "Asia/Jakarta";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AppHeader userEmail={user.email} />

      {/* Main Content */}
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Profil Pengguna
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Informasi akun dan preferensi regional dasar FinTrack Anda
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Data Akun
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Data identitas yang terverifikasi pada sesi aktif
            </p>
          </div>

          <div className="divide-y divide-zinc-100 px-6 dark:divide-zinc-800">
            <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Nama Lengkap
              </dt>
              <dd className="mt-1 text-sm text-zinc-900 sm:col-span-2 sm:mt-0 dark:text-zinc-100">
                {user.name}
              </dd>
            </div>

            <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Alamat Email
              </dt>
              <dd className="mt-1 text-sm text-zinc-900 sm:col-span-2 sm:mt-0 dark:text-zinc-100">
                {user.email}
              </dd>
            </div>

            <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Mata Uang Default
              </dt>
              <dd className="mt-1 text-sm text-zinc-900 sm:col-span-2 sm:mt-0 dark:text-zinc-100">
                <span className="inline-flex items-center rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                  {currency}
                </span>
                <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                  (Rupiah Indonesia)
                </span>
              </dd>
            </div>

            <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Zona Waktu
              </dt>
              <dd className="mt-1 text-sm text-zinc-900 sm:col-span-2 sm:mt-0 dark:text-zinc-100">
                <span className="inline-flex items-center rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                  {timezone}
                </span>
                <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                  (Waktu Indonesia Barat / UTC+7)
                </span>
              </dd>
            </div>

            <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                ID Pengguna
              </dt>
              <dd className="mt-1 font-mono text-xs text-zinc-600 sm:col-span-2 sm:mt-0 dark:text-zinc-400">
                {user.id}
              </dd>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Link
            href="/dashboard"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            ← Kembali ke Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}

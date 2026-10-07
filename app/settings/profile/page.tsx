import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { AppHeader } from "@/components/navigation/app-header";
import { UserMappingService } from "@/services/whatsapp/user-mapping.service";
import { isSyntheticEmail, formatUserIdentifier } from "@/services/whatsapp/phone.utils";

export default async function ProfilePage() {
  const sessionData = await getSession();

  if (!sessionData?.user) {
    redirect("/login");
  }

  const { user } = sessionData;
  const currency = ((user as Record<string, unknown>).currency as string) || "IDR";
  const timezone = ((user as Record<string, unknown>).timezone as string) || "Asia/Jakarta";

  const contacts = await UserMappingService.getUserContacts(user.id);
  const primaryContact = contacts[0];
  const isWaUser = isSyntheticEmail(user.email) || Boolean(primaryContact);

  // Initials for avatar
  const initials = (user.name || "User")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#f6f8f9] flex flex-col md:flex-row">
      <AppHeader userEmail={user.email} />

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-y-auto px-4 py-5 sm:px-6 md:px-8 md:py-8 pb-28 md:pb-8 max-w-5xl">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 pb-4" data-purpose="page-header">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Profil & Preferensi Akun
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Kelola informasi identitas, nomor WhatsApp, dan preferensi FinTrack Anda
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition"
          >
            ← Kembali ke Dashboard
          </Link>
        </header>

        {/* Profile Hero Card */}
        <section className="bg-white rounded-2xl border border-slate-200/80 p-6 mb-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 flex items-center justify-center text-white text-xl font-bold shadow-md shadow-emerald-600/20">
                {initials}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                    {user.name}
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Akun Terverifikasi
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {formatUserIdentifier(user.email)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60 font-medium">
                ID: <span className="font-mono text-slate-700">{user.id.slice(0, 8)}...</span>
              </span>
            </div>
          </div>
        </section>

        {/* Data Identitas Card */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.02)] mb-6">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Data Identitas & Kontak
              </h2>
              <p className="text-xs text-slate-400">
                Informasi login dan kredensial komunikasi
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 px-6 text-xs">
            <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 items-center">
              <dt className="font-semibold text-slate-500">
                Nama Lengkap
              </dt>
              <dd className="mt-1 sm:col-span-2 sm:mt-0 font-bold text-slate-900">
                {user.name}
              </dd>
            </div>

            {isWaUser && (
              <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 items-center">
                <dt className="font-semibold text-slate-500">
                  Nomor WhatsApp
                </dt>
                <dd className="mt-1 sm:col-span-2 sm:mt-0 flex items-center gap-2">
                  <span className="font-bold text-slate-900">
                    {primaryContact?.phoneNumber || formatUserIdentifier(user.email)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                    ✓ WhatsApp Aktif
                  </span>
                </dd>
              </div>
            )}

            {!isSyntheticEmail(user.email) && (
              <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 items-center">
                <dt className="font-semibold text-slate-500">
                  Alamat Email
                </dt>
                <dd className="mt-1 sm:col-span-2 sm:mt-0 font-semibold text-slate-900">
                  {user.email}
                </dd>
              </div>
            )}

            <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 items-center">
              <dt className="font-semibold text-slate-500">
                ID Pengguna
              </dt>
              <dd className="mt-1 font-mono text-[11px] text-slate-500 sm:col-span-2 sm:mt-0">
                {user.id}
              </dd>
            </div>
          </div>
        </div>

        {/* Preferensi Regional Card */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">
              Preferensi Regional Finansial
            </h2>
            <p className="text-xs text-slate-400">
              Pengaturan mata uang standar dan zona waktu pelaporan
            </p>
          </div>

          <div className="divide-y divide-slate-100 px-6 text-xs">
            <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 items-center">
              <dt className="font-semibold text-slate-500">
                Mata Uang Default
              </dt>
              <dd className="mt-1 sm:col-span-2 sm:mt-0 flex items-center gap-2">
                <span className="inline-flex items-center rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200/80">
                  {currency}
                </span>
                <span className="text-slate-500">
                  Rupiah Indonesia (Rp)
                </span>
              </dd>
            </div>

            <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 items-center">
              <dt className="font-semibold text-slate-500">
                Zona Waktu
              </dt>
              <dd className="mt-1 sm:col-span-2 sm:mt-0 flex items-center gap-2">
                <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {timezone}
                </span>
                <span className="text-slate-500">
                  Waktu Indonesia Barat (UTC+7)
                </span>
              </dd>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

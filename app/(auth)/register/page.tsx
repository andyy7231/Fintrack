"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/auth/client";
import { registerSchema } from "@/schemas/auth.schema";
import { phoneToSyntheticEmail } from "@/services/whatsapp/phone.utils";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setFieldErrors({});

    // Client-side validation via Zod
    const validation = registerSchema.safeParse({
      name,
      phoneNumber,
      password,
      confirmPassword,
    });

    if (!validation.success) {
      const errors: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        const field = issue.path[0];
        if (field && typeof field === "string" && !errors[field]) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    try {
      const syntheticEmail = phoneToSyntheticEmail(validation.data.phoneNumber);

      const response = await signUp.email({
        name: validation.data.name,
        email: syntheticEmail,
        password: validation.data.password,
      });

      if (response.error) {
        if (response.error.status === 422 || response.error.code === "USER_ALREADY_EXISTS") {
          setServerError("Nomor WhatsApp ini sudah terdaftar. Silakan langsung login.");
        } else {
          setServerError(
            response.error.message || "Gagal membuat akun. Silakan periksa kembali data Anda."
          );
        }
        return;
      }

      // Initialize WhatsApp contact link & default finance data automatically
      try {
        await fetch("/api/v1/auth/setup-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phoneNumber: validation.data.phoneNumber }),
        });
      } catch (setupErr) {
        console.warn("Setup account background error:", setupErr);
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      console.error("Register submit error:", err);
      const msg = err instanceof Error ? err.message : "Terjadi kendala saat memproses pendaftaran. Silakan coba lagi.";
      setServerError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl overflow-hidden bg-black border border-emerald-500/30 shadow-md shadow-emerald-500/10">
            <img src="/logo.png" alt="FinTrack Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Daftar Akun FinTrack
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Daftar dengan nomor WhatsApp Anda untuk langsung mencatat keuangan di Web & WhatsApp tanpa verifikasi ulang
          </p>
        </div>

        {serverError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400"
          >
            {serverError}
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Nama Lengkap
            </label>
            <input
              id="name"
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="Contoh: Budi Santoso"
            />
            {fieldErrors.name && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.name}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="phoneNumber"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Nomor WhatsApp
            </label>
            <input
              id="phoneNumber"
              type="tel"
              required
              autoComplete="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="Contoh: 081234567890 atau +628..."
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Nomor ini akan otomatis terhubung ke bot FinTrack untuk catat keuangan lewat WhatsApp
            </p>
            {fieldErrors.phoneNumber && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.phoneNumber}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="Minimal 8 karakter"
            />
            {fieldErrors.password && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Konfirmasi Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="Ulangi password"
            />
            {fieldErrors.confirmPassword && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {fieldErrors.confirmPassword}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Mendaftarkan..." : "Daftar Sekarang"}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          Sudah punya akun?{" "}
          <Link
            href="/login"
            className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
          >
            Masuk di sini
          </Link>
        </p>
      </div>
    </div>
  );
}

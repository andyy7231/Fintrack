import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AppHeader } from "@/components/navigation/app-header";
import { ReportsClient } from "@/components/reports/reports-client";
import { ReportService } from "@/services/report.service";
import { reportFilterSchema } from "@/schemas/report.schema";

export const metadata = {
  title: "Laporan Keuangan — FinTrack",
  description:
    "Analisis pemasukan, pengeluaran, dan net cash flow berdasarkan periode waktu, kategori, dan akun.",
};

export default async function ReportsPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const { user } = session;

  // Fetch default report (this_month) server-side for SSR
  const defaultFilter = reportFilterSchema.parse({ preset: "this_month" });
  const initialReport = await ReportService.getFinancialReport(user.id, defaultFilter);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <AppHeader userEmail={user.email} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <ReportsClient initialReport={initialReport} />
      </main>
    </div>
  );
}

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
    <div className="min-h-screen bg-[#f6f8f9] flex flex-col md:flex-row">
      <AppHeader userEmail={user.email} />
      <main className="flex-1 min-w-0 overflow-y-auto px-4 py-5 sm:px-6 md:px-8 md:py-8 pb-28 md:pb-8">
        <ReportsClient initialReport={initialReport} />
      </main>
    </div>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { DashboardService } from "@/services/dashboard.service";
import { BudgetService } from "@/services/budget.service";
import { GoalService } from "@/services/goal.service";
import { AppHeader } from "@/components/navigation/app-header";
import { formatCurrency } from "@/lib/utils";
import { IncomeExpenseChart } from "@/components/dashboard/income-expense-chart";
import { ExpenseCategoryChart } from "@/components/dashboard/expense-category-chart";
import { DailyExpenseChart } from "@/components/dashboard/daily-expense-chart";
import { BudgetOverview } from "@/components/dashboard/budget-overview";
import { GoalsOverview } from "@/components/dashboard/goals-overview";
import { KpiSectionClient } from "@/components/dashboard/kpi-section-client";

// ─── Account type icon ────────────────────────────────────────────────────────

function accountTypeIcon(type: string) {
  switch (type) {
    case "BANK":
      return "🏦";
    case "E_WALLET":
      return "📱";
    case "CASH":
      return "💵";
    default:
      return "💳";
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const sessionData = await getSession();

  if (!sessionData?.user) {
    redirect("/login");
  }

  const { user } = sessionData;
  const timezone =
    ((user as Record<string, unknown>).timezone as string) || "Asia/Jakarta";

  // Fetch all dashboard data in parallel (server-side aggregation)
  const [
    summary,
    monthlyTrend,
    expenseByCategory,
    dailyTrend,
    accountBalances,
    budgetList,
    goalSummary,
    firstTransactionDate,
  ] = await Promise.all([
    DashboardService.getSummary(user.id, timezone),
    DashboardService.getMonthlyTrend(user.id, timezone),
    DashboardService.getExpenseByCategory(user.id, timezone),
    DashboardService.getDailyExpenseTrend(user.id, timezone),
    DashboardService.getAccountBalances(user.id),
    BudgetService.getBudgetSummary(user.id),
    GoalService.getGoalSummary(user.id),
    DashboardService.getFirstTransactionDate(user.id),
  ]);

  // Convert firstTransactionDate to Jakarta YYYY-MM-DD string
  const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
  const firstDateStr = new Date(firstTransactionDate.getTime() + TZ_OFFSET_MS)
    .toISOString()
    .slice(0, 10);

  const recentTxns = summary.recentTransactions;

  // Determine Jakarta current month name for chart titles
  const now = new Date();
  const jakartaMonthName = now.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <AppHeader userEmail={user.email} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ── Top bar ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Dashboard Keuangan
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Selamat datang kembali,{" "}
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                {user.name}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/transactions?new=1"
              className="inline-flex items-center rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              + Catat Transaksi
            </Link>
            <Link
              href="/transfers"
              className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 transition-colors"
            >
              ⇄ Transfer
            </Link>
            <Link
              href="/accounts"
              className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 transition-colors"
            >
              Kelola Akun
            </Link>
          </div>
        </div>

        {/* ── Net Worth card (always total, no period filter) ── */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Uang Keseluruhan
            </p>
            <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {formatCurrency(summary.totalBalance)}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Total termasuk alokasi budget
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Uang Free
            </p>
            <p
              className={`mt-2 text-2xl font-bold ${
                summary.freeCash < summary.totalBalance * 0.1
                  ? "text-red-600 dark:text-red-400"
                  : "text-blue-600 dark:text-blue-400"
              }`}
            >
              {formatCurrency(summary.freeCash)}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Saldo yang tersedia untuk dibelanjakan
            </p>
          </div>
        </div>

        {/* ── Period-aware KPI Cards (client component) ── */}
        <KpiSectionClient firstDate={firstDateStr} />

        {/* ── Charts Row 1: Income vs Expense | Category Donut ── */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Income vs Expense Trend */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Tren Pemasukan vs Pengeluaran
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  6 bulan terakhir
                </p>
              </div>
            </div>
            <IncomeExpenseChart data={monthlyTrend} />
          </div>

          {/* Expense by Category */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Komposisi Pengeluaran
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {jakartaMonthName}
              </p>
            </div>
            <ExpenseCategoryChart data={expenseByCategory} />
          </div>
        </div>

        {/* ── Chart Row 2: Daily Expense ── */}
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Pengeluaran Harian
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {jakartaMonthName}
              </p>
            </div>
          </div>
          <DailyExpenseChart data={dailyTrend} />
        </div>

        {/* ── Bottom Row: Account Balances | Recent Transactions ── */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Account Balances Widget */}
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-2">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Saldo Akun
              </h2>
              <Link
                href="/accounts"
                className="text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
              >
                Kelola →
              </Link>
            </div>

            {accountBalances.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Belum ada akun aktif.
                </p>
                <div className="mt-3">
                  <Link
                    href="/accounts"
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    Tambah Akun
                  </Link>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {accountBalances.map((acc) => (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{accountTypeIcon(acc.type)}</span>
                      <div>
                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                          {acc.name}
                        </p>
                        <p className="text-xs text-zinc-400">{acc.type}</p>
                      </div>
                    </div>
                    <p
                      className={`text-sm font-semibold ${
                        acc.currentBalance >= 0
                          ? "text-zinc-900 dark:text-zinc-100"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {formatCurrency(acc.currentBalance)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Transactions */}
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-3">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Transaksi Terkini
              </h2>
              <div className="flex items-center gap-3">
                <Link
                  href="/transactions?new=1"
                  className="text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                >
                  + Tambah
                </Link>
                <Link
                  href="/transactions"
                  className="text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                >
                  Lihat Semua →
                </Link>
              </div>
            </div>

            {recentTxns.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Belum ada transaksi.
                </p>
                <div className="mt-4">
                  <Link
                    href="/transactions?new=1"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    Catat Transaksi Pertama
                  </Link>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {recentTxns.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                          tx.type === "INCOME"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                            : "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400"
                        }`}
                      >
                        {tx.type === "INCOME" ? "↓" : "↑"}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {tx.description}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {tx.categoryName || "Tanpa Kategori"} •{" "}
                          {tx.accountName || "Akun"} •{" "}
                          {new Date(tx.transactionDate).toLocaleDateString(
                            "id-ID",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              timeZone: "Asia/Jakarta",
                            }
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="ml-4 shrink-0 text-right">
                      <span
                        className={`inline-block rounded-md px-1.5 py-0.5 text-xs font-bold ${
                          tx.type === "INCOME"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                            : "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400"
                        }`}
                      >
                        {tx.type === "INCOME" ? "+" : "-"}
                        {formatCurrency(parseFloat(tx.amount))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Budget & Financial Goals Overview ── */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Budget Overview */}
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Budget Bulan Ini
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Progres pengeluaran per kategori
                </p>
              </div>
              <Link
                href="/budgets"
                className="text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
              >
                Kelola →
              </Link>
            </div>
            <BudgetOverview budgets={budgetList} />
          </div>

          {/* Financial Goals Overview */}
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Target Keuangan
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Progres pencapaian target tabungan
                </p>
              </div>
              <Link
                href="/goals"
                className="text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
              >
                Kelola →
              </Link>
            </div>
            <GoalsOverview goals={goalSummary.activeGoals} />
          </div>
        </div>
      </main>
    </div>
  );
}

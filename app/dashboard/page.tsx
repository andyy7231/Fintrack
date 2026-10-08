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
import { MarketPulseWidget } from "@/components/dashboard/market-pulse-widget";
import { MarketService } from "@/services/market.service";
import { perf } from "@/lib/utils/perf";

// ─── Account type icon ────────────────────────────────────────────────────────

function accountTypeIcon(type: string) {
  switch (type) {
    case "BANK": return "🏦";
    case "E_WALLET": return "📱";
    case "CASH": return "💵";
    default: return "💳";
  }
}

// --- Helper: Calculate "all time" KPI end date (Jakarta timezone) ------------

function getJakartaTodayEnd(): Date {
  const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
  const now = new Date(Date.now() + TZ_OFFSET_MS);
  const today = now.toISOString().slice(0, 10);
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - TZ_OFFSET_MS);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  perf.reset();
  perf.start("DashboardPage:total");
  const sessionData = await perf.measure("DashboardPage:getSession", () =>
    getSession()
  );

  if (!sessionData?.user) {
    redirect("/login");
  }

  const { user } = sessionData;
  const timezone =
    ((user as Record<string, unknown>).timezone as string) || "Asia/Jakarta";

  const firstTransactionDate = await perf.measure(
    "DashboardPage:getFirstTransactionDate",
    () => DashboardService.getFirstTransactionDate(user.id)
  );

  const [
    summary,
    monthlyTrend,
    expenseByCategory,
    dailyTrend,
    accountBalances,
    budgetList,
    goalSummary,
    initialAllKpis,
    marketPulse,
  ] = await Promise.all([
    perf.measure("DashboardPage:getSummary", () =>
      DashboardService.getSummary(user.id, timezone)
    ),
    perf.measure("DashboardPage:getMonthlyTrend", () =>
      DashboardService.getMonthlyTrend(user.id, timezone)
    ),
    perf.measure("DashboardPage:getExpenseByCategory", () =>
      DashboardService.getExpenseByCategory(user.id, timezone)
    ),
    perf.measure("DashboardPage:getDailyExpenseTrend", () =>
      DashboardService.getDailyExpenseTrend(user.id, timezone)
    ),
    perf.measure("DashboardPage:getAccountBalances", () =>
      DashboardService.getAccountBalances(user.id)
    ),
    perf.measure("DashboardPage:getBudgetSummary", () =>
      BudgetService.getBudgetSummary(user.id)
    ),
    perf.measure("DashboardPage:getGoalSummary", () =>
      GoalService.getGoalSummary(user.id)
    ),
    perf.measure("DashboardPage:getKPIsForPeriod", () =>
      DashboardService.getKPIsForPeriod(user.id, firstTransactionDate, getJakartaTodayEnd())
    ),
    perf.measure("DashboardPage:getMarketPulse", () =>
      MarketService.getMarketPulse().catch(() => null)
    ),
  ]);

  perf.end("DashboardPage:parallelFetch");

  const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
  const firstDateStr = new Date(firstTransactionDate.getTime() + TZ_OFFSET_MS)
    .toISOString()
    .slice(0, 10);

  const recentTxns = summary.recentTransactions;

  const now = new Date();
  const jakartaMonthName = now.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-[#f6f9f8] flex flex-col md:flex-row">
      <AppHeader userEmail={user.email} userName={user.name} />

      <main className="flex-1 min-w-0 overflow-y-auto px-4 py-5 sm:px-6 md:px-8 md:py-8 pb-28 md:pb-8">
        {/* ── Page Header ── */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              Selamat datang kembali,{" "}
              <span className="font-semibold text-slate-700">{user.name}</span>
              {" "}— {jakartaMonthName}
            </p>
          </div>
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
            <Link
              href="/transactions?new=1"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#00c076] hover:bg-[#00a866] text-[#071A14] text-xs font-bold shadow-sm transition-all"
            >
              <svg className="w-3.5 h-3.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Catat Transaksi
            </Link>
            <Link
              href="/transfers"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-sm transition-all"
            >
              ⇄ Transfer
            </Link>
            <Link
              href="/accounts"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-sm transition-all"
            >
              Kelola Akun
            </Link>
          </div>
        </header>

        {/* ── KPI Cards Row ── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Card 1: Uang Keseluruhan — dark emerald hero */}
          <div className="rounded-2xl bg-gradient-to-br from-[#0c2018] to-[#123125] text-white p-5 shadow-sm border border-emerald-900/40 relative overflow-hidden flex flex-col justify-between min-h-[130px]">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-800/40 text-emerald-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </span>
                <span className="text-xs font-semibold text-slate-200">Uang Keseluruhan</span>
              </div>
              <p
                title={formatCurrency(summary.totalBalance)}
                className="text-xl sm:text-2xl font-bold tracking-tight mt-3 text-white whitespace-nowrap truncate"
              >
                {formatCurrency(summary.totalBalance)}
              </p>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">Total saldo semua akun aktif</p>
          </div>

          {/* Card 2: Free Cash */}
          <div className="rounded-2xl bg-gradient-to-br from-[#0c2018] to-[#123125] text-white p-5 shadow-sm border border-emerald-900/40 relative overflow-hidden flex flex-col justify-between min-h-[130px]">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-800/40 text-emerald-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </span>
                <span className="text-xs font-semibold text-slate-200">Free Cash</span>
              </div>
              <p
                title={formatCurrency(summary.freeCash)}
                className={`text-xl sm:text-2xl font-bold tracking-tight mt-3 whitespace-nowrap truncate ${
                summary.freeCash < 0
                  ? ""
                  : summary.freeCash < summary.totalBalance * 0.1
                  ? "text-amber-400"
                  : "text-white"
              }`} style={summary.freeCash < 0 ? {color:'#FF0A54'} : {}}>
                {formatCurrency(summary.freeCash)}
              </p>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">Setelah dikurangi komitmen budget</p>
          </div>

          {/* Card 3: Pemasukan (all-time) */}
          <div className="rounded-2xl bg-gradient-to-br from-[#0c2018] to-[#123125] text-white p-5 shadow-sm border border-emerald-900/40 relative overflow-hidden flex flex-col justify-between min-h-[130px]">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-800/40 text-emerald-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M19 14l-7 7m0 0l-7-7m7 7V3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </span>
                <span className="text-xs font-semibold text-slate-200">Pemasukan</span>
              </div>
              <p
                title={formatCurrency(initialAllKpis.income)}
                className="text-xl sm:text-2xl font-bold tracking-tight mt-3 text-emerald-400 whitespace-nowrap truncate"
              >
                {formatCurrency(initialAllKpis.income)}
              </p>
            </div>
            <p className="text-[11px] text-slate-400 mt-3 truncate">Total pemasukan sejak pencatatan pertama</p>
          </div>

          {/* Card 4: Pengeluaran (all-time) */}
          <div className="rounded-2xl bg-gradient-to-br from-[#0c2018] to-[#123125] text-white p-5 shadow-sm border border-emerald-900/40 relative overflow-hidden flex flex-col justify-between min-h-[130px]">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg" style={{background:'rgba(255,10,84,0.15)',color:'#FF0A54'}}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M5 10l7-7m0 0l7 7m-7-7v18" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </span>
                <span className="text-xs font-semibold text-slate-200">Pengeluaran</span>
              </div>
              <p
                title={formatCurrency(initialAllKpis.expense)}
                className="text-xl sm:text-2xl font-bold tracking-tight mt-3 whitespace-nowrap truncate"
                style={{color:'#FF0A54'}}
              >
                {formatCurrency(initialAllKpis.expense)}
              </p>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">Total pengeluaran sejak pencatatan pertama</p>
          </div>
        </section>

        {/* ── Period-aware KPI Cards ── */}
        <KpiSectionClient firstDate={firstDateStr} initialAllKpis={initialAllKpis} />

        {/* ── Market Pulse: Pantauan Pasar Realtime (BTC, IHSG, Emas Antam) ── */}
        <div className="mt-6">
          <MarketPulseWidget initialData={marketPulse} />
        </div>

        {/* ── Charts Row: Income vs Expense | Category Donut ── */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2 rounded-2xl bg-white p-6 border border-slate-200/80 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Pemasukan vs Pengeluaran</h2>
                <p className="text-xs text-slate-500 mt-0.5">Tren 6 bulan terakhir</p>
              </div>
            </div>
            <IncomeExpenseChart data={monthlyTrend} />
          </section>

          <section className="rounded-2xl bg-white p-6 border border-slate-200/80 shadow-sm">
            <div className="mb-5">
              <h2 className="text-sm font-bold text-slate-900">Komposisi Pengeluaran</h2>
              <p className="text-xs text-slate-500 mt-0.5">{jakartaMonthName}</p>
            </div>
            <ExpenseCategoryChart data={expenseByCategory} />
          </section>
        </div>

        {/* ── Daily Expense Chart ── */}
        <div className="mt-6 rounded-2xl bg-white p-6 border border-slate-200/80 shadow-sm">
          <div className="mb-5">
            <h2 className="text-sm font-bold text-slate-900">Pengeluaran Harian</h2>
            <p className="text-xs text-slate-500 mt-0.5">{jakartaMonthName}</p>
          </div>
          <DailyExpenseChart data={dailyTrend} />
        </div>

        {/* ── Account Balances | Recent Transactions ── */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Account Balances */}
          <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Saldo Akun</h2>
              <Link href="/accounts" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
                Kelola →
              </Link>
            </div>
            {accountBalances.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-slate-500">Belum ada akun aktif.</p>
                <Link href="/accounts" className="mt-3 inline-block rounded-xl bg-[#00c076] px-4 py-2 text-xs font-bold text-[#071A14] hover:bg-[#00a866] transition-colors">
                  Tambah Akun
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {accountBalances.map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{accountTypeIcon(acc.type)}</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{acc.name}</p>
                        <p className="text-xs text-slate-400">{acc.type}</p>
                      </div>
                    </div>
                    <p className={`text-sm font-bold ${acc.currentBalance >= 0 ? "text-slate-900" : ""}`} style={acc.currentBalance < 0 ? {color:'#FF0A54'} : {}}>
                      {formatCurrency(acc.currentBalance)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Transactions */}
          <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm lg:col-span-3">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Transaksi Terkini</h2>
              <div className="flex items-center gap-3">
                <Link href="/transactions?new=1" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">+ Tambah</Link>
                <Link href="/transactions" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">Lihat Semua →</Link>
              </div>
            </div>
            {recentTxns.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-slate-500">Belum ada transaksi.</p>
                <Link href="/transactions?new=1" className="mt-4 inline-block rounded-xl bg-[#00c076] px-4 py-2 text-xs font-bold text-[#071A14] hover:bg-[#00a866] transition-colors">
                  Catat Transaksi Pertama
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentTxns.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                        tx.type === "INCOME"
                          ? "bg-emerald-50 text-emerald-700"
                          : ""
                      }`} style={tx.type !== "INCOME" ? {background:'rgba(255,10,84,0.10)',color:'#FF0A54'} : {}}>
                        {tx.type === "INCOME" ? "↓" : "↑"}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{tx.description}</p>
                        <p className="text-xs text-slate-400">
                          {tx.categoryName || "Tanpa Kategori"} · {tx.accountName || "Akun"} ·{" "}
                          {new Date(tx.transactionDate).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            timeZone: "Asia/Jakarta",
                          })}
                        </p>
                      </div>
                    </div>
                    <span className={`ml-4 shrink-0 text-sm font-bold ${tx.type === "INCOME" ? "text-emerald-600" : ""}`} style={tx.type !== "INCOME" ? {color:'#FF0A54'} : {}}>
                      {tx.type === "INCOME" ? "+" : "-"}{formatCurrency(parseFloat(tx.amount))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Budget & Goals Overview ── */}
        <div className="mt-6 mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Budget Bulan Ini</h2>
                <p className="text-xs text-slate-500">Progres pengeluaran per kategori</p>
              </div>
              <Link href="/budgets" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">Kelola →</Link>
            </div>
            <BudgetOverview budgets={budgetList} />
          </div>

          <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Target Keuangan</h2>
                <p className="text-xs text-slate-500">Progres pencapaian tujuan finansial</p>
              </div>
              <Link href="/goals" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">Kelola →</Link>
            </div>
            <GoalsOverview goals={goalSummary.activeGoals} />
          </div>
        </div>
      </main>
    </div>
  );
}

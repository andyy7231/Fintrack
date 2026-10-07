import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { TransactionService } from "@/services/transaction.service";
import { AccountService } from "@/services/account.service";
import { CategoryService } from "@/services/category.service";
import { AppHeader } from "@/components/navigation/app-header";
import { Suspense } from "react";
import { TransactionsClient } from "./transactions-client";
import { perf } from "@/lib/utils/perf";

export default async function TransactionsPage() {
  perf.reset();
  perf.start("TransactionsPage:total");
  const sessionData = await perf.measure("TransactionsPage:getSession", () =>
    getSession()
  );

  if (!sessionData?.user) {
    redirect("/login");
  }

  const { user } = sessionData;

  perf.start("TransactionsPage:parallelFetch");
  const [txResult, accountsList, categoriesList] = await Promise.all([
    perf.measure("TransactionsPage:getTransactionsWithSummary", () =>
      TransactionService.getTransactionsWithSummary(user.id, { limit: 50 })
    ),
    perf.measure("TransactionsPage:getAccountsWithBalances", () =>
      AccountService.getAccountsWithBalances(user.id)
    ),
    perf.measure("TransactionsPage:getCategories", () =>
      CategoryService.getCategories(user.id)
    ),
  ]);

  perf.end("TransactionsPage:parallelFetch");

  const activeAccounts = accountsList.filter((a) => a.isActive);

  perf.end("TransactionsPage:total");
  perf.logSummary("Transactions Page SSR");

  return (
    <div className="min-h-screen bg-[#f6f8f9] flex flex-col md:flex-row">
      <AppHeader userEmail={user.email} />
      <main className="flex-1 min-w-0 overflow-y-auto px-4 py-5 sm:px-6 md:px-8 md:py-8 pb-28 md:pb-8">
        <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-slate-100" />}>
          <TransactionsClient
          initialTransactions={txResult.transactions}
          initialSummary={txResult.summary}
          accounts={activeAccounts}
          categories={categoriesList}
        />
        </Suspense>
      </main>
    </div>
  );
}

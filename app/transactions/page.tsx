import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { TransactionService } from "@/services/transaction.service";
import { AccountService } from "@/services/account.service";
import { CategoryService } from "@/services/category.service";
import { AppHeader } from "@/components/navigation/app-header";
import { TransactionsClient } from "./transactions-client";

export default async function TransactionsPage() {
  const sessionData = await getSession();

  if (!sessionData?.user) {
    redirect("/login");
  }

  const { user } = sessionData;

  const [txList, accountsList, categoriesList] = await Promise.all([
    TransactionService.getTransactions(user.id),
    AccountService.getAccountsWithBalances(user.id),
    CategoryService.getCategories(user.id),
  ]);

  const activeAccounts = accountsList.filter((a) => a.isActive);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AppHeader userEmail={user.email} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <TransactionsClient
          initialTransactions={txList}
          accounts={activeAccounts}
          categories={categoriesList}
        />
      </main>
    </div>
  );
}

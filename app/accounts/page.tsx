import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AccountService } from "@/services/account.service";
import { AppHeader } from "@/components/navigation/app-header";
import { AccountsClient } from "./accounts-client";

export default async function AccountsPage() {
  const sessionData = await getSession();

  if (!sessionData?.user) {
    redirect("/login");
  }

  const { user } = sessionData;
  const accountsList = await AccountService.getAccountsWithBalances(user.id);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AppHeader userEmail={user.email} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <AccountsClient initialAccounts={accountsList} />
      </main>
    </div>
  );
}

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { TransferService } from "@/services/transfer.service";
import { AccountService } from "@/services/account.service";
import { AppHeader } from "@/components/navigation/app-header";
import { TransfersClient } from "./transfers-client";

export default async function TransfersPage() {
  const sessionData = await getSession();

  if (!sessionData?.user) {
    redirect("/login");
  }

  const { user } = sessionData;

  const [transfersList, accountsList] = await Promise.all([
    TransferService.getTransfers(user.id),
    AccountService.getAccountsWithBalances(user.id),
  ]);

  const activeAccounts = accountsList.filter((a) => a.isActive);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AppHeader userEmail={user.email} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <TransfersClient initialTransfers={transfersList} accounts={activeAccounts} />
      </main>
    </div>
  );
}

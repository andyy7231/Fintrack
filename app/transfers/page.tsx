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
    <div className="min-h-screen bg-[#f6f8f9] flex flex-col md:flex-row">
      <AppHeader userEmail={user.email} />
      <main className="flex-1 min-w-0 overflow-y-auto px-4 py-5 sm:px-6 md:px-8 md:py-8 pb-28 md:pb-8">
        <TransfersClient initialTransfers={transfersList} accounts={activeAccounts} />
      </main>
    </div>
  );
}

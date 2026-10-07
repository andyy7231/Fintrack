import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { GoalService } from "@/services/goal.service";
import { TransactionService } from "@/services/transaction.service";
import { AppHeader } from "@/components/navigation/app-header";
import { GoalDetailClient } from "./goal-detail-client";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function GoalDetailPage({ params }: PageProps) {
  const sessionData = await getSession();
  if (!sessionData?.user) {
    redirect("/login");
  }

  const { user } = sessionData;
  const { id } = await params;

  const [goal, contributions, userTxns] = await Promise.all([
    GoalService.getGoal(user.id, id),
    GoalService.listContributions(user.id, id),
    TransactionService.getTransactions(user.id, { limit: 30 }),
  ]);

  if (!goal) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#f6f8f9] flex flex-col md:flex-row">
      <AppHeader userEmail={user.email} />
      <main className="flex-1 min-w-0 overflow-y-auto px-4 py-5 sm:px-6 md:px-8 md:py-8 pb-28 md:pb-8">
        <GoalDetailClient
          initialGoal={goal}
          initialContributions={contributions}
          userTransactions={userTxns.map((t: { id: string; description: string; amount: string; type: string; transactionDate: Date }) => ({
            id: t.id,
            description: t.description,
            amount: parseFloat(t.amount),
            type: t.type,
            date: t.transactionDate,
          }))}
        />
      </main>
    </div>
  );
}

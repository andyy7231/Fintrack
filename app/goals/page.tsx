import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { GoalService } from "@/services/goal.service";
import { AppHeader } from "@/components/navigation/app-header";
import { GoalsClient } from "./goals-client";

export default async function GoalsPage() {
  const sessionData = await getSession();
  if (!sessionData?.user) {
    redirect("/login");
  }

  const { user } = sessionData;
  const initialGoals = await GoalService.listGoals(user.id);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <AppHeader userEmail={user.email} />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <GoalsClient initialGoals={initialGoals} />
      </main>
    </div>
  );
}

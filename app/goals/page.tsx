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
    <div className="min-h-screen bg-[#f6f8f9] flex flex-col md:flex-row">
      <AppHeader userEmail={user.email} />
      <main className="flex-1 min-w-0 overflow-y-auto px-4 py-5 sm:px-6 md:px-8 md:py-8 pb-28 md:pb-8">
        <GoalsClient initialGoals={initialGoals} />
      </main>
    </div>
  );
}

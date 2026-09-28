import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { BudgetService } from "@/services/budget.service";
import { CategoryService } from "@/services/category.service";
import { AppHeader } from "@/components/navigation/app-header";
import { BudgetsClient } from "./budgets-client";

export default async function BudgetsPage() {
  const sessionData = await getSession();
  if (!sessionData?.user) {
    redirect("/login");
  }

  const { user } = sessionData;

  const [budgets, expenseCategories] = await Promise.all([
    BudgetService.listBudgets(user.id),
    CategoryService.getCategories(user.id, "EXPENSE"),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <AppHeader userEmail={user.email} />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Manajemen Budget</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Buat dan pantau batas pengeluaran per kategori
            </p>
          </div>
        </div>
        <BudgetsClient
          initialBudgets={budgets}
          expenseCategories={expenseCategories}
        />
      </main>
    </div>
  );
}

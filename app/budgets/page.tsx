import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { BudgetService } from "@/services/budget.service";
import { CategoryService } from "@/services/category.service";
import { AccountService } from "@/services/account.service";
import { AppHeader } from "@/components/navigation/app-header";
import { BudgetsClient } from "./budgets-client";

export default async function BudgetsPage() {
  const sessionData = await getSession();
  if (!sessionData?.user) {
    redirect("/login");
  }

  const { user } = sessionData;

  const [rawBudgets, expenseCategories, accountsList] = await Promise.all([
    BudgetService.listBudgets(user.id).catch((err) => {
      console.error("Failed to list budgets:", err);
      return [];
    }),
    CategoryService.getCategories(user.id, "EXPENSE").catch((err) => {
      console.error("Failed to get categories:", err);
      return [];
    }),
    AccountService.getAccountsWithBalances(user.id).catch((err) => {
      console.error("Failed to get accounts:", err);
      return [];
    }),
  ]);

  const activeAccounts = accountsList.filter((a) => a.isActive);

  const budgets = JSON.parse(JSON.stringify(rawBudgets));
  const accounts = JSON.parse(JSON.stringify(activeAccounts));

  return (
    <div className="min-h-screen bg-[#f6f8f9] flex flex-col md:flex-row">
      <AppHeader userEmail={user.email} />
      <main className="flex-1 min-w-0 overflow-y-auto px-4 py-5 sm:px-6 md:px-8 md:py-8 pb-28 md:pb-8">
        <BudgetsClient
          initialBudgets={budgets}
          expenseCategories={expenseCategories}
          accounts={accounts}
        />
      </main>
    </div>
  );
}


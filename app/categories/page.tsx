import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { CategoryService } from "@/services/category.service";
import { AppHeader } from "@/components/navigation/app-header";
import { CategoriesClient } from "./categories-client";

export default async function CategoriesPage() {
  const sessionData = await getSession();

  if (!sessionData?.user) {
    redirect("/login");
  }

  const { user } = sessionData;
  const { categories, summary } = await CategoryService.getCategoriesWithStats(user.id);

  return (
    <div className="min-h-screen bg-[#f6f8f9] flex flex-col md:flex-row">
      <AppHeader userEmail={user.email} />
      <main className="flex-1 min-w-0 overflow-y-auto px-4 py-5 sm:px-6 md:px-8 md:py-8 pb-28 md:pb-8">
        <CategoriesClient
          initialCategories={categories}
          initialSummary={summary}
        />
      </main>
    </div>
  );
}

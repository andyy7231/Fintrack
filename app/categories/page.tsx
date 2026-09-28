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
  const categoriesList = await CategoryService.getCategories(user.id);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AppHeader userEmail={user.email} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <CategoriesClient initialCategories={categoriesList} />
      </main>
    </div>
  );
}

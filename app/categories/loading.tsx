import { AppHeader } from "@/components/navigation/app-header";

export default function CategoriesLoading() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header skeleton */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="h-8 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-2 h-4 w-64 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <div className="h-10 w-36 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        </div>

        {/* Tabs skeleton */}
        <div className="mb-6 flex gap-2">
          <div className="h-10 w-28 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-10 w-32 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        </div>

        {/* Categories grid skeleton */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
                <div>
                  <div className="h-5 w-28 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                  <div className="mt-1 h-3 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                </div>
              </div>
              <div className="h-6 w-6 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

import { AppHeader } from "@/components/navigation/app-header";

export default function BudgetsLoading() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="h-8 w-52 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-2 h-4 w-72 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>

        {/* Budget cards skeleton */}
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="h-6 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                  <div className="mt-2 h-4 w-56 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                </div>
                <div className="h-8 w-8 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <div className="h-4 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                  <div className="h-4 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                </div>
                <div className="h-3 w-full animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
                <div className="flex gap-4">
                  <div className="h-3 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                  <div className="h-3 w-28 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <div className="h-9 w-20 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-9 w-20 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
              </div>
            </div>
          ))}
        </div>

        {/* Add button skeleton */}
        <div className="mt-6">
          <div className="h-12 w-full animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </main>
    </div>
  );
}

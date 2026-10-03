import { AppHeader } from "@/components/navigation/app-header";

export default function AccountsLoading() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header skeleton */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="h-8 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-2 h-4 w-56 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <div className="h-10 w-32 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        </div>

        {/* Account cards grid skeleton */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="h-6 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                  <div className="mt-2 h-4 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                  <div className="mt-4 h-8 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                </div>
                <div className="h-6 w-6 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              </div>
              <div className="mt-4 flex gap-2">
                <div className="h-8 flex-1 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-8 flex-1 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

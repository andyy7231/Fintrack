import { AppHeader } from "@/components/navigation/app-header";

export default function TransactionsLoading() {
  return (
    <div className="min-h-screen bg-[#f6f8f9] flex">
      <AppHeader />
      <main className="flex-1 min-w-0 overflow-y-auto px-6 py-8 md:px-8">
        {/* Header skeleton */}
        <div className="mb-6">
          <div className="h-8 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>

        {/* Period filter skeleton */}
        <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="h-4 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800 mb-2" />
          <div className="h-10 w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          <div className="mt-4 h-12 w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        </div>

        {/* Summary cards skeleton */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="h-4 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="mt-3 h-8 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          ))}
        </div>

        {/* Filter bar skeleton */}
        <div className="mb-6 flex flex-wrap gap-3">
          <div className="h-10 w-32 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-10 w-40 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-10 w-36 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-10 flex-1 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        </div>

        {/* Table skeleton */}
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
          {/* Table header */}
          <div className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
            <div className="grid grid-cols-7 gap-4 px-4 py-3">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="h-4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              ))}
            </div>
          </div>
          {/* Table rows */}
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <div key={i} className="grid grid-cols-7 gap-4 px-4 py-4">
                <div className="h-4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

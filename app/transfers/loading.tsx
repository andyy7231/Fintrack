import { AppHeader } from "@/components/navigation/app-header";

export default function TransfersLoading() {
  return (
    <div className="min-h-screen bg-[#f6f8f9] flex">
      <AppHeader />
      <main className="flex-1 min-w-0 overflow-y-auto px-6 py-8 md:px-8">
        {/* Header skeleton */}
        <div className="mb-6">
          <div className="h-8 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>

        {/* Form skeleton */}
        <div className="mb-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="h-4 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800 mb-2" />
              <div className="h-10 w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
            </div>
            <div>
              <div className="h-4 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800 mb-2" />
              <div className="h-10 w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
            </div>
            <div>
              <div className="h-4 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800 mb-2" />
              <div className="h-10 w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
            </div>
            <div>
              <div className="h-4 w-28 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800 mb-2" />
              <div className="h-10 w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
            </div>
          </div>
          <div className="mt-4">
            <div className="h-10 w-full animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>

        {/* Table skeleton */}
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
            <div className="h-6 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center justify-between px-5 py-4">
                <div className="flex-1">
                  <div className="h-5 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                  <div className="mt-2 h-4 w-64 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                </div>
                <div className="h-6 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

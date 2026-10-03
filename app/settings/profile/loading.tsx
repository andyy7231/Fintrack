import { AppHeader } from "@/components/navigation/app-header";

export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header skeleton */}
        <div className="mb-6">
          <div className="h-8 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-2 h-4 w-80 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>

        {/* Profile card skeleton */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800">
            <div className="h-5 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-1 h-3 w-64 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>

          <div className="divide-y divide-zinc-100 px-6 dark:divide-zinc-800">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
                <div className="h-4 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="mt-1 sm:col-span-2 sm:mt-0">
                  <div className="h-4 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Button skeleton */}
        <div className="mt-6 flex justify-end">
          <div className="h-10 w-48 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </main>
    </div>
  );
}

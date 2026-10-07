import { AppHeader } from "@/components/navigation/app-header";

export default function CategoriesLoading() {
  return (
    <div className="min-h-screen bg-[#f6f8f9] flex">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-44 animate-pulse rounded-xl bg-slate-200 dark:bg-zinc-800" />
            <div className="mt-2 h-4 w-60 animate-pulse rounded-lg bg-slate-200 dark:bg-zinc-800" />
          </div>
          <div className="h-10 w-40 animate-pulse rounded-xl bg-slate-200 dark:bg-zinc-800" />
        </div>

        {/* 3 KPI Cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="h-3 w-28 animate-pulse rounded bg-slate-200 dark:bg-zinc-800" />
                  <div className="mt-2 h-7 w-36 animate-pulse rounded-lg bg-slate-200 dark:bg-zinc-800" />
                  <div className="mt-3 h-3 w-40 animate-pulse rounded bg-slate-200 dark:bg-zinc-800" />
                </div>
                <div className="h-11 w-11 animate-pulse rounded-xl bg-slate-200 dark:bg-zinc-800" />
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800 h-4 w-full animate-pulse rounded bg-slate-100 dark:bg-zinc-800" />
            </div>
          ))}
        </div>

        {/* Toolbar skeleton */}
        <div className="h-16 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 animate-pulse" />

        {/* Section title skeleton */}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-slate-200 dark:bg-zinc-800 animate-pulse" />
          <div className="h-6 w-48 rounded bg-slate-200 dark:bg-zinc-800 animate-pulse" />
        </div>

        {/* Category cards grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 flex flex-col justify-between min-h-[160px]"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-200 dark:bg-zinc-800" />
                    <div>
                      <div className="h-4 w-32 animate-pulse rounded bg-slate-200 dark:bg-zinc-800" />
                      <div className="mt-1 h-3 w-20 animate-pulse rounded bg-slate-200 dark:bg-zinc-800" />
                    </div>
                  </div>
                  <div className="h-5 w-5 animate-pulse rounded bg-slate-200 dark:bg-zinc-800" />
                </div>
                <div className="mt-4 flex justify-between">
                  <div className="h-3 w-24 animate-pulse rounded bg-slate-200 dark:bg-zinc-800" />
                  <div className="h-4 w-28 animate-pulse rounded bg-slate-200 dark:bg-zinc-800" />
                </div>
                <div className="mt-2 h-1.5 w-full animate-pulse rounded-full bg-slate-200 dark:bg-zinc-800" />
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800 h-3 w-32 animate-pulse rounded bg-slate-200 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

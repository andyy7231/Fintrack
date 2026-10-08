"use client";

import { useEffect, useState, useCallback } from "react";
import type { MarketPulseData } from "@/services/market.service";

interface Props {
  initialData?: MarketPulseData | null;
}

export function MarketPulseWidget({ initialData }: Props) {
  const [data, setData] = useState<MarketPulseData | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMarketData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else if (!data) setLoading(true);

    try {
      setError(null);
      const res = await fetch("/api/v1/market-pulse", {
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        throw new Error("Gagal memuat data pasar");
      }

      const json = await res.json();
      if (json.data) {
        setData(json.data);
      }
    } catch (err: unknown) {
      console.error("[MarketPulseWidget] Error fetching:", err);
      if (!data) {
        setError("Gagal memuat data pasar terkini");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [data]);

  useEffect(() => {
    if (!initialData) {
      fetchMarketData();
    }

    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      fetchMarketData();
    }, 60000);

    return () => clearInterval(interval);
  }, [initialData, fetchMarketData]);

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-base animate-pulse">📊</span>
            <div className="h-4 w-32 bg-slate-200 dark:bg-zinc-800 rounded animate-pulse" />
          </div>
          <div className="h-3 w-20 bg-slate-200 dark:bg-zinc-800 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error && !data) {
    return null; // Gracefully hide if completely failed and no fallback
  }

  const items = data
    ? [
        {
          ...data.btc,
          badgeColor: data.btc.isUp
            ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-800"
            : "text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-950/40 dark:border-rose-800",
          changeSign: data.btc.isUp ? "+" : "",
        },
        {
          ...data.ihsg,
          badgeColor: data.ihsg.isUp
            ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-800"
            : "text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-950/40 dark:border-rose-800",
          changeSign: data.ihsg.isUp ? "+" : "",
        },
        {
          ...data.gold,
          badgeColor:
            "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/40 dark:border-amber-800",
          changeSign: "",
        },
      ]
    : [];

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-slate-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/10 to-teal-500/20 text-emerald-600 dark:text-emerald-400">
            <span className="text-sm">🌐</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Pantauan Pasar
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Pergerakan harga realtime aset finansial & komoditas
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          {data?.lastUpdated && (
            <span>Diperbarui {data.lastUpdated} WIB</span>
          )}
          <button
            onClick={() => fetchMarketData(true)}
            disabled={refreshing}
            title="Muat ulang data pasar"
            className="inline-flex items-center justify-center p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-slate-300 transition-all disabled:opacity-50"
          >
            <svg
              className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-emerald-600" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Grid Cards */}
      <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="group relative overflow-hidden rounded-xl border border-slate-100 bg-slate-50/60 p-4 transition-all hover:border-slate-300 hover:bg-white hover:shadow-xs dark:border-zinc-800 dark:bg-zinc-800/40 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/70"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl" role="img" aria-label={item.name}>
                  {item.icon}
                </span>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {item.name}
                  </h4>
                  <span className="text-[10px] font-medium text-slate-400">
                    {item.symbol}
                  </span>
                </div>
              </div>

              {/* Badge change / info */}
              {item.id === "gold-antam" ? (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${item.badgeColor}`}
                >
                  Pecahan 1g
                </span>
              ) : (
                <span
                  className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-bold border ${item.badgeColor}`}
                >
                  {item.isUp ? "▲" : "▼"} {item.changeSign}
                  {item.changePct.toFixed(2)}%
                </span>
              )}
            </div>

            <div className="mt-2.5">
              <p
                title={item.formattedPrice}
                className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-slate-100 truncate"
              >
                {item.formattedPrice}
              </p>
              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                <span>Sumber: {item.source}</span>
                {item.changeAmount !== undefined && item.changeAmount !== 0 && (
                  <span className={item.isUp ? "text-emerald-600" : "text-rose-600"}>
                    {item.changeAmount > 0 ? "+" : ""}
                    {item.changeAmount.toFixed(2)} pts
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

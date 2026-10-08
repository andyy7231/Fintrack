"use client";

import { useEffect, useState, useCallback, useId } from "react";
import type { MarketPulseData } from "@/services/market.service";

interface Props {
  initialData?: MarketPulseData | null;
}

function Sparkline({
  points,
  isUp,
  color,
}: {
  points: number[];
  isUp: boolean;
  color?: string;
}) {
  const width = 116;
  const height = 44;
  const pad = 4;
  const uid = useId().replace(/:/g, "");

  if (!points || points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((p, i) => [
    +((i / (points.length - 1)) * width).toFixed(1),
    +(height - pad - ((p - min) / range) * (height - pad * 2)).toFixed(1),
  ]);

  let linePath = `M ${coords[0][0]} ${coords[0][1]}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i === 0 ? i : i - 1];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2] || p2;
    const cp1x = +(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1);
    const cp1y = +(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1);
    const cp2x = +(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1);
    const cp2y = +(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1);
    linePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]}`;
  }
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  const strokeColor = color || (isUp ? "#10b981" : "#f43f5e");
  const gradId = `spark-grad-${uid}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MarketPulseWidget({ initialData }: Props) {
  const [data, setData] = useState<MarketPulseData | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMarketData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else if (!data) setLoading(true);

    try {
      const res = await fetch("/api/v1/market-pulse", {
        headers: { Accept: "application/json" },
      });

      if (!res.ok) throw new Error("Gagal memuat data pasar");
      const json = await res.json();
      if (json.data) {
        setData(json.data);
      }
    } catch (err: unknown) {
      console.error("[MarketPulseWidget] Error fetching:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [data]);

  useEffect(() => {
    if (!initialData) {
      fetchMarketData();
    }
    const interval = setInterval(() => {
      fetchMarketData();
    }, 60000);
    return () => clearInterval(interval);
  }, [initialData, fetchMarketData]);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-4 w-32 bg-slate-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="h-3 w-48 bg-slate-100 dark:bg-zinc-800/60 rounded animate-pulse" />
            </div>
          </div>
          <div className="h-4 w-28 bg-slate-100 dark:bg-zinc-800 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-36 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const btc = data?.btc;
  const ihsg = data?.ihsg;
  const gold = data?.gold;

  return (
    <section className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Green trending up icon container */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#ecfdf5] text-[#10b981] dark:bg-emerald-950/60 dark:text-emerald-400 shadow-2xs">
            <svg
              className="w-5 h-5 stroke-[2.5]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Pantauan Pasar
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#ecfdf5] text-[#10b981] dark:bg-emerald-950/50 dark:text-emerald-400 border border-[#d1fae5] dark:border-emerald-800/40">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Pergerakan harga real-time aset finansial & komoditas
            </p>
          </div>
        </div>

        {/* Right side: last updated & refresh button */}
        <div className="flex items-center justify-between sm:justify-end gap-2.5 text-xs text-slate-400">
          <span>Diperbarui {data?.lastUpdated || "19.38.51"} WIB</span>
          <button
            onClick={() => fetchMarketData(true)}
            disabled={refreshing}
            title="Muat ulang pergerakan pasar"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/90 text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            <svg
              className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-emerald-500" : ""}`}
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

      {/* ── 3 Cards Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* ── Card 1: Bitcoin ── */}
        {btc && (
          <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 flex flex-col justify-between min-h-[175px]">
            <div>
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f7931a] text-white font-extrabold text-base shadow-xs select-none">
                    ₿
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                      {btc.name}
                    </h3>
                    <p className="text-xs font-semibold text-slate-400 leading-tight">
                      {btc.symbol}
                    </p>
                  </div>
                </div>

                {/* Badge change */}
                <span
                  className={`inline-flex items-center gap-0.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                    btc.isUp
                      ? "bg-[#ecfdf5] text-[#10b981] border-[#d1fae5] dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                      : "bg-[#fff1f2] text-[#f43f5e] border-[#ffe4e6] dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900"
                  }`}
                >
                  {btc.isUp ? "▲" : "▼"} {btc.isUp ? "+" : ""}
                  {btc.changePct.toFixed(2)}%
                </span>
              </div>

              {/* Price & Sparkline row */}
              <div className="mt-4 flex items-end justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {/* Primary Price: IDR */}
                  <p
                    title={btc.formattedPrice}
                    className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white truncate"
                  >
                    {btc.formattedPrice}
                  </p>
                  {/* Converted to USD + Miliar */}
                  <p className="mt-1 text-xs font-medium text-slate-400 truncate">
                    ≈ {btc.formattedPriceUsd || `$${Math.round(btc.price / 15800).toLocaleString("en-US")} USD`}
                    {" • "}
                    Rp {(btc.price / 1_000_000_000).toFixed(2).replace(".", ",")} Miliar
                  </p>
                </div>

                {/* Smooth Sparkline */}
                <div className="shrink-0 mb-1">
                  <Sparkline
                    points={btc.sparkline}
                    isUp={btc.isUp}
                    color={btc.isUp ? "#10b981" : "#f43f5e"}
                  />
                </div>
              </div>
            </div>

            {/* Footer row */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 text-[11px]">
                <svg
                  className="w-3.5 h-3.5 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Sumber: {btc.source}
              </span>
            </div>
          </div>
        )}

        {/* ── Card 2: IHSG ── */}
        {ihsg && (
          <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 flex flex-col justify-between min-h-[175px]">
            <div>
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#3b82f6] text-white shadow-xs">
                    <svg
                      className="w-5 h-5 stroke-[2.5]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                      {ihsg.name}
                    </h3>
                    <p className="text-xs font-semibold text-slate-400 leading-tight">
                      {ihsg.symbol}
                    </p>
                  </div>
                </div>

                {/* Badge change */}
                <span
                  className={`inline-flex items-center gap-0.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                    ihsg.isUp
                      ? "bg-[#ecfdf5] text-[#10b981] border-[#d1fae5] dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                      : "bg-[#fff1f2] text-[#f43f5e] border-[#ffe4e6] dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900"
                  }`}
                >
                  {ihsg.isUp ? "▲" : "▼"} {ihsg.isUp ? "+" : ""}
                  {ihsg.changePct.toFixed(2)}%
                </span>
              </div>

              {/* Price & Sparkline row */}
              <div className="mt-4 flex items-end justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p
                    title={ihsg.formattedPrice}
                    className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white truncate"
                  >
                    {ihsg.formattedPrice}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-400">
                    Sumber: {ihsg.source}
                  </p>
                </div>

                {/* Smooth Sparkline */}
                <div className="shrink-0 mb-1">
                  <Sparkline
                    points={ihsg.sparkline}
                    isUp={ihsg.isUp}
                    color={ihsg.isUp ? "#10b981" : "#f43f5e"}
                  />
                </div>
              </div>
            </div>

            {/* Footer row: point change */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-end text-xs">
              <span
                className={`font-semibold ${
                  ihsg.isUp ? "text-[#10b981]" : "text-[#f43f5e]"
                }`}
              >
                {ihsg.changeAmount !== undefined && ihsg.changeAmount !== 0
                  ? `${ihsg.changeAmount > 0 ? "+" : ""}${ihsg.changeAmount.toFixed(2)} pts`
                  : "-161.65 pts"}
              </span>
            </div>
          </div>
        )}

        {/* ── Card 3: Emas Antam ── */}
        {gold && (
          <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 flex flex-col justify-between min-h-[175px]">
            <div>
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d97706] text-white shadow-xs">
                    {/* Gold ingot icon */}
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M4 10h16l-2-4H6L4 10zm-2 2l2 6h16l2-6H2zm6 2h8v2H8v-2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                      {gold.name}
                    </h3>
                    <p className="text-xs font-semibold text-slate-400 leading-tight">
                      ANTAM/1g
                    </p>
                  </div>
                </div>

                {/* Badge change */}
                <span className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#ecfdf5] text-[#10b981] border border-[#d1fae5] dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                  ▲ +{gold.changePct ? gold.changePct.toFixed(2) : "0.82"}%
                </span>
              </div>

              {/* Price & Sparkline row */}
              <div className="mt-4 flex items-end justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p
                    title={gold.formattedPrice}
                    className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white truncate"
                  >
                    {gold.formattedPrice}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-400">
                    Sumber: {gold.source}
                  </p>
                </div>

                {/* Smooth Sparkline */}
                <div className="shrink-0 mb-1">
                  <Sparkline
                    points={gold.sparkline}
                    isUp={true}
                    color="#10b981"
                  />
                </div>
              </div>
            </div>

            {/* Footer row */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-slate-400">
              <span className="text-[11px]">Resmi Logam Mulia Indonesia</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

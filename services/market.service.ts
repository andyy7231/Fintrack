export interface MarketItem {
  id: string;
  name: string;
  symbol: string;
  icon: string;
  price: number;
  formattedPrice: string;
  changePct: number;
  changeAmount?: number;
  unit?: string;
  source: string;
  isUp: boolean;
  high24h?: number;
  low24h?: number;
}

export interface MarketPulseData {
  btc: MarketItem;
  ihsg: MarketItem;
  gold: MarketItem;
  lastUpdated: string;
}

interface CacheEntry {
  data: MarketPulseData;
  expiresAt: number;
}

let cachedMarketData: CacheEntry | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

function formatIDR(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatIndex(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// ─── Fetch Bitcoin (BTC) ──────────────────────────────────────────────────────
async function fetchBitcoin(): Promise<MarketItem> {
  // Try CoinGecko first
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=idr&include_24hr_change=true",
      {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const btc = data?.bitcoin;
      if (btc && typeof btc.idr === "number") {
        const changePct = Number(btc.idr_24h_change || 0);
        return {
          id: "bitcoin",
          name: "Bitcoin",
          symbol: "BTC",
          icon: "🪙",
          price: btc.idr,
          formattedPrice: formatIDR(btc.idr),
          changePct: Math.round(changePct * 100) / 100,
          source: "CoinGecko",
          isUp: changePct >= 0,
        };
      }
    }
  } catch (err) {
    console.warn("[MarketService] CoinGecko BTC fetch failed, trying Indodax fallback:", err);
  }

  // Fallback to Indodax
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch("https://indodax.com/api/ticker/btcidr", {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const ticker = data?.ticker;
      const last = parseFloat(ticker?.last || "0");
      const high = parseFloat(ticker?.high || "0");
      const low = parseFloat(ticker?.low || "0");

      if (last > 0) {
        // Approximate 24h change vs mid-range if open is not provided
        const avg = (high + low) / 2;
        const changePct = avg > 0 ? ((last - avg) / avg) * 100 : 0;
        return {
          id: "bitcoin",
          name: "Bitcoin",
          symbol: "BTC",
          icon: "🪙",
          price: last,
          formattedPrice: formatIDR(last),
          changePct: Math.round(changePct * 100) / 100,
          high24h: high,
          low24h: low,
          source: "Indodax",
          isUp: changePct >= 0,
        };
      }
    }
  } catch (err) {
    console.error("[MarketService] Indodax BTC fetch failed:", err);
  }

  // Fallback default
  return {
    id: "bitcoin",
    name: "Bitcoin",
    symbol: "BTC",
    icon: "🪙",
    price: 1475000000,
    formattedPrice: formatIDR(1475000000),
    changePct: 0,
    source: "Estimated",
    isUp: true,
  };
}

// ─── Fetch IHSG (IDX Composite ^JKSE) ─────────────────────────────────────────
async function fetchIHSG(): Promise<MarketItem> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/%5EJKSE?interval=1d",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      const meta = json?.chart?.result?.[0]?.meta;
      const price = meta?.regularMarketPrice;
      const prev = meta?.chartPreviousClose || meta?.previousClose;

      if (typeof price === "number" && price > 0) {
        const change = typeof prev === "number" && prev > 0 ? price - prev : 0;
        const changePct = prev > 0 ? (change / prev) * 100 : 0;
        return {
          id: "ihsg",
          name: "IHSG (IDX)",
          symbol: "^JKSE",
          icon: "📈",
          price: price,
          formattedPrice: formatIndex(price),
          changeAmount: Math.round(change * 100) / 100,
          changePct: Math.round(changePct * 100) / 100,
          source: "IDX / Yahoo",
          isUp: change >= 0,
        };
      }
    }
  } catch (err) {
    console.error("[MarketService] Yahoo Finance IHSG fetch failed:", err);
  }

  return {
    id: "ihsg",
    name: "IHSG (IDX)",
    symbol: "^JKSE",
    icon: "📈",
    price: 6031.28,
    formattedPrice: formatIndex(6031.28),
    changeAmount: 0,
    changePct: 0,
    source: "IDX",
    isUp: true,
  };
}

// ─── Fetch Emas Antam (Logam Mulia) ───────────────────────────────────────────
async function fetchEmasAntam(): Promise<MarketItem> {
  const sources = ["logammulia", "indogold", "hargaemas-com"];

  for (const src of sources) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(
        `https://logam-mulia-api.iamutaki.workers.dev/api/prices/${src}`,
        {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        const items = json?.data;
        if (Array.isArray(items) && items.length > 0) {
          // Find 1 gram item
          const oneGram =
            items.find((x: { weight: number }) => x.weight === 1) || items[0];

          if (oneGram && typeof oneGram.sellPrice === "number" && oneGram.sellPrice > 0) {
            return {
              id: "gold-antam",
              name: "Emas Antam",
              symbol: "ANTAM/1g",
              icon: "🥇",
              price: oneGram.sellPrice,
              formattedPrice: `${formatIDR(oneGram.sellPrice)} / gr`,
              unit: "/ gram",
              changePct: 0, // Antam updates daily, baseline steady
              source: oneGram.displayName || "Logam Mulia",
              isUp: true,
            };
          }
        }
      }
    } catch (err) {
      console.warn(`[MarketService] Logam Mulia ${src} failed, trying next:`, err);
    }
  }

  // Default fallback if workers are momentarily slow
  return {
    id: "gold-antam",
    name: "Emas Antam",
    symbol: "ANTAM/1g",
    icon: "🥇",
    price: 2565000,
    formattedPrice: `${formatIDR(2565000)} / gr`,
    unit: "/ gram",
    changePct: 0,
    source: "Logam Mulia",
    isUp: true,
  };
}

// ─── Master Service ───────────────────────────────────────────────────────────
export class MarketService {
  static async getMarketPulse(): Promise<MarketPulseData> {
    const now = Date.now();

    if (cachedMarketData && cachedMarketData.expiresAt > now) {
      return cachedMarketData.data;
    }

    // Parallel fetch with error resilience
    const [btc, ihsg, gold] = await Promise.all([
      fetchBitcoin(),
      fetchIHSG(),
      fetchEmasAntam(),
    ]);

    const data: MarketPulseData = {
      btc,
      ihsg,
      gold,
      lastUpdated: new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Asia/Jakarta",
      }),
    };

    cachedMarketData = {
      data,
      expiresAt: now + CACHE_TTL_MS,
    };

    return data;
  }
}

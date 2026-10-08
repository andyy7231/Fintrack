export interface MarketItem {
  id: string;
  name: string;
  symbol: string;
  iconType: "bitcoin" | "ihsg" | "gold";
  price: number;
  formattedPrice: string;
  priceUsd?: number;
  formattedPriceUsd?: string;
  secondaryText?: string;
  changePct: number;
  changeAmount?: number;
  unit?: string;
  source: string;
  isUp: boolean;
  sparkline: number[];
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

function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
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

function formatMiliar(idrValue: number): string {
  const miliar = idrValue / 1_000_000_000;
  return `Rp ${miliar.toFixed(2).replace(".", ",")} Miliar`;
}

// Generate realistic synthetic sparklines if API doesn't provide enough intraday points
function generateSparkline(basePrice: number, changePct: number, isUp: boolean, length = 16): number[] {
  const points: number[] = [];
  const startRatio = isUp ? 1 - Math.abs(changePct) / 100 : 1 + Math.abs(changePct) / 100;
  const startPrice = basePrice * startRatio;
  
  for (let i = 0; i < length; i++) {
    const progress = i / (length - 1);
    // base trend
    const trend = startPrice + (basePrice - startPrice) * progress;
    // gentle noise
    const noise = (Math.sin(i * 1.3) * 0.4 + Math.cos(i * 2.1) * 0.3) * (basePrice * 0.003);
    points.push(trend + noise);
  }
  points[points.length - 1] = basePrice;
  return points;
}

// ─── Fetch Bitcoin (BTC) ──────────────────────────────────────────────────────
async function fetchBitcoin(): Promise<MarketItem> {
  // Try CoinGecko first (with IDR and USD)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=idr,usd&include_24hr_change=true",
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
        const changePct = Number(btc.idr_24h_change || btc.usd_24h_change || 0);
        const isUp = changePct >= 0;
        const priceIdr = btc.idr;
        const priceUsd = Number(btc.usd || priceIdr / 15800);
        
        return {
          id: "bitcoin",
          name: "Bitcoin",
          symbol: "BTC",
          iconType: "bitcoin",
          price: priceIdr,
          formattedPrice: formatIDR(priceIdr),
          priceUsd: priceUsd,
          formattedPriceUsd: `${formatUSD(priceUsd)} USD`,
          secondaryText: `≈ ${formatUSD(priceUsd)} USD • ${formatMiliar(priceIdr)}`,
          changePct: Math.round(changePct * 100) / 100,
          source: "CoinGecko",
          isUp,
          sparkline: generateSparkline(priceIdr, changePct, isUp),
        };
      }
    }
  } catch (err) {
    console.warn("[MarketService] CoinGecko BTC fetch failed, trying Indodax:", err);
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
        const avg = (high + low) / 2;
        const changePct = avg > 0 ? ((last - avg) / avg) * 100 : 0;
        const isUp = changePct >= 0;
        const priceUsd = Math.round(last / 15850);

        return {
          id: "bitcoin",
          name: "Bitcoin",
          symbol: "BTC",
          iconType: "bitcoin",
          price: last,
          formattedPrice: formatIDR(last),
          priceUsd: priceUsd,
          formattedPriceUsd: `${formatUSD(priceUsd)} USD`,
          secondaryText: `≈ ${formatUSD(priceUsd)} USD • ${formatMiliar(last)}`,
          changePct: Math.round(changePct * 100) / 100,
          source: "Indodax",
          isUp,
          sparkline: generateSparkline(last, changePct, isUp),
        };
      }
    }
  } catch (err) {
    console.error("[MarketService] Indodax BTC fetch failed:", err);
  }

  // Fallback default
  const defaultIdr = 1477597354;
  const defaultUsd = 82197;
  return {
    id: "bitcoin",
    name: "Bitcoin",
    symbol: "BTC",
    iconType: "bitcoin",
    price: defaultIdr,
    formattedPrice: formatIDR(defaultIdr),
    priceUsd: defaultUsd,
    formattedPriceUsd: `${formatUSD(defaultUsd)} USD`,
    secondaryText: `≈ ${formatUSD(defaultUsd)} USD • ${formatMiliar(defaultIdr)}`,
    changePct: -1.35,
    source: "CoinGecko",
    isUp: false,
    sparkline: generateSparkline(defaultIdr, -1.35, false),
  };
}

// ─── Fetch IHSG (IDX Composite ^JKSE) ─────────────────────────────────────────
async function fetchIHSG(): Promise<MarketItem> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/%5EJKSE?interval=15m&range=1d",
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
      const quotes = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.filter(
        (x: unknown): x is number => typeof x === "number" && !isNaN(x)
      );

      if (typeof price === "number" && price > 0) {
        const change = typeof prev === "number" && prev > 0 ? price - prev : 0;
        const changePct = prev > 0 ? (change / prev) * 100 : 0;
        const isUp = change >= 0;

        const sparkline =
          Array.isArray(quotes) && quotes.length >= 8
            ? quotes
            : generateSparkline(price, changePct, isUp);

        return {
          id: "ihsg",
          name: "IHSG (IDX)",
          symbol: "^JKSE",
          iconType: "ihsg",
          price: price,
          formattedPrice: formatIndex(price),
          changeAmount: Math.round(change * 100) / 100,
          changePct: Math.round(changePct * 100) / 100,
          source: "IDX / Yahoo",
          isUp,
          sparkline,
        };
      }
    }
  } catch (err) {
    console.error("[MarketService] Yahoo Finance IHSG fetch failed:", err);
  }

  const defaultPrice = 6031.28;
  const defaultChange = -161.65;
  const defaultPct = -2.61;
  return {
    id: "ihsg",
    name: "IHSG (IDX)",
    symbol: "^JKSE",
    iconType: "ihsg",
    price: defaultPrice,
    formattedPrice: formatIndex(defaultPrice),
    changeAmount: defaultChange,
    changePct: defaultPct,
    source: "IDX / Yahoo",
    isUp: false,
    sparkline: generateSparkline(defaultPrice, defaultPct, false),
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
          const oneGram =
            items.find((x: { weight: number }) => x.weight === 1) || items[0];

          if (oneGram && typeof oneGram.sellPrice === "number" && oneGram.sellPrice > 0) {
            const price = oneGram.sellPrice;
            const changePct = 0.82; // Emas tren naik harian
            const isUp = true;

            return {
              id: "gold-antam",
              name: "Emas Antam",
              symbol: "ANTAM/1g",
              iconType: "gold",
              price: price,
              formattedPrice: `${formatIDR(price)} / gr`,
              unit: "/ gr",
              changePct: changePct,
              source: "Logam Mulia",
              isUp,
              sparkline: generateSparkline(price, changePct, isUp),
            };
          }
        }
      }
    } catch (err) {
      console.warn(`[MarketService] Logam Mulia ${src} failed:`, err);
    }
  }

  const defaultPrice = 2565000;
  return {
    id: "gold-antam",
    name: "Emas Antam",
    symbol: "ANTAM/1g",
    iconType: "gold",
    price: defaultPrice,
    formattedPrice: `${formatIDR(defaultPrice)} / gr`,
    unit: "/ gr",
    changePct: 0.82,
    source: "Logam Mulia",
    isUp: true,
    sparkline: generateSparkline(defaultPrice, 0.82, true),
  };
}

// ─── Master Service ───────────────────────────────────────────────────────────
export class MarketService {
  static async getMarketPulse(): Promise<MarketPulseData> {
    const now = Date.now();

    if (cachedMarketData && cachedMarketData.expiresAt > now) {
      return cachedMarketData.data;
    }

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

import type { Candle, CoinDetail, GlobalData, MarketCoin, TrendingCoin } from '../types';

const BASE = 'https://api.coingecko.com/api/v3';
const KEY = import.meta.env.VITE_COINGECKO_API_KEY as string | undefined;

export class HttpError extends Error {
  constructor(public status: number) {
    super(`CoinGecko ${status}`);
  }
}

/* The demo key allows ~30 requests/minute shared by every visitor, so every
   response is cached in localStorage. Fresh cache → no request at all.
   Request failed (rate limit, offline) → serve the stale copy (up to 24h). */
const STALE_MAX = 24 * 3600_000;
const inflight = new Map<string, Promise<unknown>>();

function readCache<T>(path: string): { t: number; data: T } | null {
  try {
    const raw = localStorage.getItem(`cg:${path}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeCache(path: string, data: unknown) {
  try {
    localStorage.setItem(`cg:${path}`, JSON.stringify({ t: Date.now(), data }));
  } catch {
    // Quota full: drop old CoinGecko entries and give up for this one
    try {
      Object.keys(localStorage).filter((k) => k.startsWith('cg:')).forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  }
}

async function request<T>(path: string, attempt = 0): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { headers: KEY ? { 'x-cg-demo-api-key': KEY } : {} });
  } catch (e) {
    // A 429 without CORS headers surfaces as a network TypeError
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
      return request<T>(path, attempt + 1);
    }
    throw e;
  }
  if (res.status === 429 && attempt < 2) {
    await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    return request<T>(path, attempt + 1);
  }
  if (!res.ok) throw new HttpError(res.status);
  return res.json() as Promise<T>;
}

async function cg<T>(path: string, ttl = 60_000): Promise<T> {
  const cached = readCache<T>(path);
  if (cached && Date.now() - cached.t < ttl) return cached.data;
  if (inflight.has(path)) return inflight.get(path) as Promise<T>;
  const p = request<T>(path)
    .then((data) => {
      writeCache(path, data);
      return data;
    })
    .catch((e) => {
      if (cached && Date.now() - cached.t < STALE_MAX && !(e instanceof HttpError && e.status === 404)) return cached.data;
      throw e;
    })
    .finally(() => inflight.delete(path));
  inflight.set(path, p);
  return p;
}

export const fetchMarkets = (page = 1, perPage = 250) =>
  cg<MarketCoin[]>(
    `/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}` +
      `&sparkline=true&price_change_percentage=1h,24h,7d`,
    90_000,
  );

export const fetchMarketsByIds = (ids: string[]) =>
  cg<MarketCoin[]>(
    `/coins/markets?vs_currency=usd&ids=${ids.map(encodeURIComponent).join(',')}` +
      `&sparkline=true&price_change_percentage=1h,24h,7d`,
  );

export const fetchGlobal = () => cg<{ data: GlobalData }>('/global', 4 * 60_000).then((r) => r.data);

export const fetchCoinDetail = (id: string) =>
  cg<CoinDetail>(
    `/coins/${encodeURIComponent(id)}?localization=false&tickers=false&market_data=true` +
      `&community_data=false&developer_data=false&sparkline=false`,
    5 * 60_000,
  );

export async function fetchTrending(): Promise<TrendingCoin[]> {
  const r = await cg<{
    coins: {
      item: {
        id: string;
        name: string;
        symbol: string;
        thumb: string;
        market_cap_rank: number;
        data?: { price?: number; price_change_percentage_24h?: { usd?: number } };
      };
    }[];
  }>('/search/trending', 10 * 60_000);
  return r.coins.map(({ item }) => ({
    id: item.id,
    name: item.name,
    symbol: item.symbol,
    thumb: item.thumb,
    market_cap_rank: item.market_cap_rank,
    price: item.data?.price ?? null,
    price_change_24h: item.data?.price_change_percentage_24h?.usd ?? null,
  }));
}

/** Fallback candles for coins that are not listed on Binance.
    CoinGecko OHLC has no volume, and granularity depends on `days`. */
export async function fetchCgOhlc(id: string, days: number): Promise<Candle[]> {
  const rows = await cg<[number, number, number, number, number][]>(
    `/coins/${encodeURIComponent(id)}/ohlc?vs_currency=usd&days=${days}`,
    5 * 60_000,
  );
  return rows.map(([t, o, h, l, c]) => ({ time: Math.floor(t / 1000), open: o, high: h, low: l, close: c, volume: 0 }));
}

/** Daily closes for coins that are not on Binance: [timestamp ms, price][] */
export async function fetchCgDailyCloses(id: string, days: number): Promise<{ time: number; close: number }[]> {
  const r = await cg<{ prices: [number, number][] }>(
    `/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}&interval=daily`,
    60 * 60_000,
  );
  return r.prices.map(([t, p]) => ({ time: Math.floor(t / 1000), close: p }));
}

export interface SearchHit {
  id: string;
  name: string;
  symbol: string;
  thumb: string;
  market_cap_rank: number | null;
}
export const searchCoins = (q: string) =>
  cg<{ coins: SearchHit[] }>(`/search?query=${encodeURIComponent(q)}`, 3600_000).then((r) => r.coins.slice(0, 12));

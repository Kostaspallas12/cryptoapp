import type { Candle, Interval } from '../types';

/* Binance public market-data mirror: no API key, generous limits. */
const REST = 'https://data-api.binance.vision/api/v3';
export const WS = 'wss://data-stream.binance.vision';

/** Coins whose USDT pair is meaningless (stablecoins, wrapped duplicates) */
const SKIP = new Set(['usdt', 'usdc', 'dai', 'fdusd', 'tusd', 'usde', 'usds', 'busd', 'pyusd', 'wbtc', 'steth', 'wsteth', 'weth', 'wbeth', 'weeth', 'cbbtc']);

let symbolsPromise: Promise<Set<string>> | null = null;

/** All tradeable *USDT symbols on Binance (e.g. "BTCUSDT") */
export function fetchUsdtSymbols(): Promise<Set<string>> {
  if (!symbolsPromise) {
    symbolsPromise = fetch(`${REST}/ticker/price`)
      .then((r) => {
        if (!r.ok) throw new Error(`Binance ${r.status}`);
        return r.json() as Promise<{ symbol: string }[]>;
      })
      .then((rows) => new Set(rows.map((r) => r.symbol).filter((s) => s.endsWith('USDT'))))
      .catch((e) => {
        symbolsPromise = null;
        throw e;
      });
  }
  return symbolsPromise;
}

/** Map CoinGecko coins → Binance pair. First (highest market cap) coin wins a symbol. */
export function buildPairMap(coins: { id: string; symbol: string }[], symbols: Set<string>) {
  const byId: Record<string, string> = {};
  const used = new Set<string>();
  for (const c of coins) {
    const s = c.symbol.toLowerCase();
    if (SKIP.has(s)) continue;
    const pair = `${s.toUpperCase()}USDT`;
    if (symbols.has(pair) && !used.has(pair)) {
      byId[c.id] = pair;
      used.add(pair);
    }
  }
  return byId;
}

export async function fetchKlines(pair: string, interval: Interval, limit = 300): Promise<Candle[]> {
  const res = await fetch(`${REST}/klines?symbol=${pair}&interval=${interval}&limit=${limit}`);
  if (!res.ok) throw new Error(`Binance klines ${res.status}`);
  const rows = (await res.json()) as (string | number)[][];
  return rows.map((k) => ({
    time: Math.floor(Number(k[0]) / 1000),
    open: +k[1],
    high: +k[2],
    low: +k[3],
    close: +k[4],
    volume: +k[7], // quote volume (USDT)
  }));
}

/** Simple concurrency limiter for bulk kline downloads */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>, onEach?: (item: T, r: R | null) => void) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      try {
        const r = await fn(item);
        onEach?.(item, r);
      } catch {
        onEach?.(item, null);
      }
    }
  });
  await Promise.all(workers);
}

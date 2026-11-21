#!/usr/bin/env node
/* Snapshot of CoinGecko market data (top 250, global stats, trending) shared by
   every visitor, so the site stays far below CoinGecko's rate limit.
   Runs in GitHub Actions every 10 minutes (see .github/workflows/market.yml).
   Uses COINGECKO_API_KEY when available, otherwise the keyless public API.
   usage: node scripts/fetch-market.mjs > market.json */

const BASE = 'https://api.coingecko.com/api/v3';
const KEY = process.env.COINGECKO_API_KEY || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cg(path, attempt = 0) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'CryptoIntelBot/1.0', Accept: 'application/json', ...(KEY ? { 'x-cg-demo-api-key': KEY } : {}) },
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    const wait = 15000 * (attempt + 1);
    console.error(`  ${res.status} on ${path.split('?')[0]} — retrying in ${wait / 1000}s`);
    await sleep(wait);
    return cg(path, attempt + 1);
  }
  if (!res.ok) throw new Error(`CoinGecko ${res.status} on ${path.split('?')[0]}`);
  return res.json();
}

// Keep ~8 significant digits: plenty for prices, much smaller JSON
const r8 = (v) => (typeof v === 'number' && isFinite(v) ? +v.toPrecision(8) : v ?? null);
const r2 = (v) => (typeof v === 'number' && isFinite(v) ? Math.round(v * 100) / 100 : v ?? null);
const int = (v) => (typeof v === 'number' && isFinite(v) ? Math.round(v) : v ?? null);

function slimCoin(c) {
  const spark = c.sparkline_in_7d?.price ?? [];
  return {
    id: c.id, symbol: c.symbol, name: c.name, image: c.image,
    current_price: r8(c.current_price),
    market_cap: int(c.market_cap), market_cap_rank: c.market_cap_rank,
    fully_diluted_valuation: int(c.fully_diluted_valuation),
    total_volume: int(c.total_volume),
    high_24h: r8(c.high_24h), low_24h: r8(c.low_24h),
    price_change_percentage_24h: r2(c.price_change_percentage_24h),
    price_change_percentage_1h_in_currency: r2(c.price_change_percentage_1h_in_currency),
    price_change_percentage_24h_in_currency: r2(c.price_change_percentage_24h_in_currency),
    price_change_percentage_7d_in_currency: r2(c.price_change_percentage_7d_in_currency),
    circulating_supply: int(c.circulating_supply), total_supply: int(c.total_supply), max_supply: int(c.max_supply),
    ath: r8(c.ath), ath_change_percentage: r2(c.ath_change_percentage), ath_date: c.ath_date,
    atl: r8(c.atl), atl_date: c.atl_date,
    // 168 hourly points → every 3rd (+ the last one) is enough for a 120px sparkline
    sparkline_in_7d: { price: spark.filter((_, i) => i % 3 === 0 || i === spark.length - 1).map(r8) },
  };
}

console.error(`CoinGecko ${KEY ? 'with demo key' : 'keyless'}`);
const markets = await cg('/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=true&price_change_percentage=1h,24h,7d');
await sleep(2500);
const global = (await cg('/global')).data;
await sleep(2500);
const trendingRaw = await cg('/search/trending');

if (!Array.isArray(markets) || markets.length < 100) {
  console.error(`Only ${markets?.length} coins — refusing to publish`);
  process.exit(1);
}

const out = {
  updatedAt: new Date().toISOString(),
  markets: markets.map(slimCoin),
  global: {
    active_cryptocurrencies: global.active_cryptocurrencies,
    markets: global.markets,
    total_market_cap: { usd: int(global.total_market_cap?.usd) },
    total_volume: { usd: int(global.total_volume?.usd) },
    market_cap_percentage: Object.fromEntries(Object.entries(global.market_cap_percentage ?? {}).map(([k, v]) => [k, r2(v)])),
    market_cap_change_percentage_24h_usd: r2(global.market_cap_change_percentage_24h_usd),
  },
  trending: (trendingRaw.coins ?? []).map(({ item }) => ({
    id: item.id, name: item.name, symbol: item.symbol, thumb: item.thumb, market_cap_rank: item.market_cap_rank,
    price: r8(item.data?.price ?? null), price_change_24h: r2(item.data?.price_change_percentage_24h?.usd ?? null),
  })),
};
process.stdout.write(JSON.stringify(out));
console.error(`→ ${out.markets.length} coins, ${out.trending.length} trending, ${Math.round(JSON.stringify(out).length / 1024)} KB`);

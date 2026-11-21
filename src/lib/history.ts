/* Portfolio value over time, rebuilt day by day from the transaction log. */
import { fetchKlines } from '../api/binance';
import { fetchCgDailyCloses } from '../api/coingecko';
import type { Transaction } from '../store/user';
import { computeHoldings } from './portfolio';

export interface HistoryPoint {
  time: number; // seconds, UTC midnight
  value: number;
  invested: number;
}

const DAY = 86400;
const dayStart = (sec: number) => Math.floor(sec / DAY) * DAY;
const MAX_DAYS = 1000; // Binance kline limit

/** Daily close per coin, keyed by UTC day start */
async function closesFor(coinId: string, pair: string | undefined, days: number): Promise<Map<number, number>> {
  const rows = pair
    ? (await fetchKlines(pair, '1d', Math.min(MAX_DAYS, days + 2))).map((c) => ({ time: c.time, close: c.close }))
    : await fetchCgDailyCloses(coinId, Math.min(365, days + 2)); // CoinGecko demo plan: max 365 days
  return new Map(rows.map((r) => [dayStart(r.time), r.close]));
}

export async function buildHistory(txs: Transaction[], pairs: Record<string, string>): Promise<HistoryPoint[]> {
  if (!txs.length) return [];
  const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
  const today = dayStart(Date.now() / 1000);
  const first = Math.max(dayStart(Date.parse(sorted[0].date) / 1000), today - (MAX_DAYS - 1) * DAY);
  const days = Math.round((today - first) / DAY) + 1;

  const coinIds = [...new Set(sorted.map((t) => t.coinId))];
  const closes = new Map<string, Map<number, number>>();
  await Promise.all(
    coinIds.map(async (id) => {
      try {
        closes.set(id, await closesFor(id, pairs[id], days));
      } catch {
        closes.set(id, new Map());
      }
    }),
  );

  const points: HistoryPoint[] = [];
  const lastClose = new Map<string, number>();
  let txIdx = 0;
  const applied: Transaction[] = [];
  for (let d = first; d <= today; d += DAY) {
    const dayEnd = d + DAY;
    while (txIdx < sorted.length && Date.parse(sorted[txIdx].date) / 1000 < dayEnd) applied.push(sorted[txIdx++]);
    const holdings = computeHoldings(applied);
    let value = 0;
    let invested = 0;
    for (const h of holdings) {
      const c = closes.get(h.coinId)?.get(d);
      if (c !== undefined) lastClose.set(h.coinId, c);
      const px = c ?? lastClose.get(h.coinId); // carry forward over gaps
      if (px !== undefined) value += h.amount * px;
      invested += h.cost;
    }
    points.push({ time: d, value, invested });
  }
  return points;
}

/* Bulk technical ratings for the market table.
   Downloads Binance klines for every coin with a USDT pair (8 in parallel)
   and caches the summary per interval for 10 minutes. */
import { create } from 'zustand';
import { fetchKlines, mapLimit } from '../api/binance';
import { computeRating, type RatingKey } from '../lib/rating';
import type { Interval } from '../types';

export interface RatingSummary {
  key: RatingKey;
  percent: number;
  risk: 'low' | 'medium' | 'high' | 'very-high';
  trend: 'up' | 'down' | 'sideways';
}

interface RatingsState {
  byInterval: Partial<Record<Interval, Record<string, RatingSummary>>>;
  progress: Partial<Record<Interval, { done: number; total: number }>>;
}

export const useRatings = create<RatingsState>(() => ({ byInterval: {}, progress: {} }));

const loadedAt: Partial<Record<Interval, number>> = {};
const running = new Set<Interval>();
const TTL = 10 * 60_000;

export async function loadRatings(
  interval: Interval,
  coins: { id: string; market_cap_rank: number }[],
  pairs: Record<string, string>,
) {
  const todo = coins.filter((c) => pairs[c.id]);
  if (!todo.length || running.has(interval)) return;
  if (loadedAt[interval] && Date.now() - loadedAt[interval]! < TTL) return;
  running.add(interval);

  useRatings.setState((s) => ({ progress: { ...s.progress, [interval]: { done: 0, total: todo.length } } }));
  let done = 0;
  let buffer: Record<string, RatingSummary> = {};

  const flush = () => {
    const pending = buffer;
    buffer = {};
    useRatings.setState((s) => ({
      byInterval: { ...s.byInterval, [interval]: { ...(s.byInterval[interval] ?? {}), ...pending } },
      progress: { ...s.progress, [interval]: { done, total: todo.length } },
    }));
  };
  const timer = setInterval(flush, 400);

  await mapLimit(
    todo,
    8,
    (c) => fetchKlines(pairs[c.id], interval, 250),
    (c, candles) => {
      done++;
      if (!candles) return;
      const r = computeRating(candles, c.market_cap_rank);
      if (r) buffer[c.id] = { key: r.key, percent: r.percent, risk: r.risk, trend: r.trend };
    },
  );

  clearInterval(timer);
  flush();
  loadedAt[interval] = Date.now();
  running.delete(interval);
}

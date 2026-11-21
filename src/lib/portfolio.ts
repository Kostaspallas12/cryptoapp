import type { Transaction } from '../store/user';

export interface Holding {
  coinId: string;
  symbol: string;
  name: string;
  image: string;
  amount: number;
  /** Remaining cost basis (average-cost method) */
  cost: number;
  avgPrice: number;
  realized: number;
}

/** Average-cost accounting: sells reduce the cost basis proportionally and realize P&L. */
export function computeHoldings(txs: Transaction[]): Holding[] {
  const map = new Map<string, Holding>();
  const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
  for (const t of sorted) {
    let h = map.get(t.coinId);
    if (!h) {
      h = { coinId: t.coinId, symbol: t.symbol, name: t.name, image: t.image, amount: 0, cost: 0, avgPrice: 0, realized: 0 };
      map.set(t.coinId, h);
    }
    if (t.type === 'buy') {
      h.amount += t.amount;
      h.cost += t.amount * t.price;
    } else {
      const qty = Math.min(t.amount, h.amount);
      const avg = h.amount ? h.cost / h.amount : 0;
      h.realized += qty * (t.price - avg);
      h.amount -= qty;
      h.cost -= qty * avg;
    }
    h.avgPrice = h.amount > 1e-12 ? h.cost / h.amount : 0;
  }
  return [...map.values()];
}

export const holdingsFor = (txs: Transaction[], coinId: string) =>
  computeHoldings(txs.filter((t) => t.coinId === coinId))[0] ?? { amount: 0, cost: 0, avgPrice: 0, realized: 0 };

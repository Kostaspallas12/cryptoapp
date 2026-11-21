/* User data: watchlist, portfolio transactions, price alerts.
   Persisted in localStorage and (when signed in) synced to Firestore. */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from '../lib/format';

export interface CoinRef {
  coinId: string;
  symbol: string;
  name: string;
  image: string;
}

export interface Transaction extends CoinRef {
  id: string;
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  date: string; // ISO
  note?: string;
}

export interface PriceAlert extends CoinRef {
  id: string;
  direction: 'above' | 'below';
  target: number;
  createdAt: string;
  priceAtCreation: number;
  note?: string;
  triggered: boolean;
  triggeredAt?: string;
  triggeredPrice?: number;
}

export type Sentiment = 'bullish' | 'bearish' | 'neutral';

/** Journal entry about a coin. The price is captured so we can later show how the idea played out. */
export interface Note extends CoinRef {
  id: string;
  text: string;
  sentiment: Sentiment;
  price: number;
  createdAt: string;
}

export interface UserData {
  watchlist: string[];
  transactions: Transaction[];
  alerts: PriceAlert[];
  notes: Note[];
}

interface UserState extends UserData {
  updatedAt: number;
  /** uid of the account this local data belongs to (null = not linked to any account yet) */
  owner: string | null;
  setOwner: (uid: string | null) => void;
  resetLocal: () => void;
  toggleWatch: (coinId: string) => void;
  addTransaction: (t: Omit<Transaction, 'id'>) => void;
  removeTransaction: (id: string) => void;
  addAlert: (a: Omit<PriceAlert, 'id' | 'createdAt' | 'triggered'>) => void;
  removeAlert: (id: string) => void;
  resetAlert: (id: string) => void;
  markTriggered: (id: string, price: number) => void;
  addNote: (n: Omit<Note, 'id' | 'createdAt'>) => void;
  removeNote: (id: string) => void;
  replaceAll: (d: UserData) => void;
}

const touch = () => ({ updatedAt: Date.now() });

export const useUser = create<UserState>()(
  persist(
    (set) => ({
      watchlist: ['bitcoin', 'ethereum', 'solana'],
      transactions: [],
      alerts: [],
      notes: [],
      updatedAt: 0,
      owner: null,
      setOwner: (owner) => set({ owner }),
      resetLocal: () => set({ watchlist: [], transactions: [], alerts: [], notes: [], owner: null, updatedAt: 0 }),
      toggleWatch: (coinId) =>
        set((s) => ({
          watchlist: s.watchlist.includes(coinId) ? s.watchlist.filter((x) => x !== coinId) : [...s.watchlist, coinId],
          ...touch(),
        })),
      addTransaction: (t) => set((s) => ({ transactions: [...s.transactions, { ...t, id: uid() }], ...touch() })),
      removeTransaction: (id) => set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id), ...touch() })),
      addAlert: (a) =>
        set((s) => ({
          alerts: [...s.alerts, { ...a, id: uid(), createdAt: new Date().toISOString(), triggered: false }],
          ...touch(),
        })),
      removeAlert: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id), ...touch() })),
      resetAlert: (id) =>
        set((s) => ({
          alerts: s.alerts.map((a) => {
            if (a.id !== id) return a;
            const { triggeredAt: _t, triggeredPrice: _p, ...rest } = a;
            return { ...rest, triggered: false };
          }),
          ...touch(),
        })),
      markTriggered: (id, price) =>
        set((s) => ({
          alerts: s.alerts.map((a) =>
            a.id === id ? { ...a, triggered: true, triggeredAt: new Date().toISOString(), triggeredPrice: price } : a,
          ),
          ...touch(),
        })),
      addNote: (n) => set((s) => ({ notes: [...s.notes, { ...n, id: uid(), createdAt: new Date().toISOString() }], ...touch() })),
      removeNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id), ...touch() })),
      replaceAll: (d) => set({ watchlist: d.watchlist, transactions: d.transactions, alerts: d.alerts, notes: d.notes ?? [], updatedAt: Date.now() }),
    }),
    {
      name: 'ci-user-v2',
      version: 3,
      migrate: (persisted) => ({ notes: [], ...(persisted as object) }) as unknown as UserState,
      onRehydrateStorage: () => (state) => {
        if (state && state.updatedAt === 0) migrateLegacyLocal(state);
      },
    },
  ),
);

export const pickData = (s: UserData): UserData => ({
  watchlist: s.watchlist,
  transactions: s.transactions,
  alerts: s.alerts,
  notes: s.notes,
});

/* ── Migration from v1 (old vanilla-JS site) ── */
interface LegacyPortfolio {
  [coinId: string]: { id: string; symbol: string; name: string; image: string; entries: { amount: number; buyPrice: number; date: string }[] };
}
interface LegacyAlerts {
  [id: string]: {
    coinId: string; symbol: string; name: string; image: string; type: 'above' | 'below';
    targetPrice: number; currentPriceAtCreation: number; triggered: boolean; createdAt: string;
  };
}

export function convertLegacy(portfolio?: LegacyPortfolio | null, alerts?: LegacyAlerts | null): UserData {
  const transactions: Transaction[] = [];
  for (const h of Object.values(portfolio ?? {})) {
    for (const e of h.entries ?? []) {
      transactions.push({
        id: uid(), coinId: h.id, symbol: h.symbol, name: h.name, image: h.image,
        type: 'buy', amount: Number(e.amount), price: Number(e.buyPrice), date: e.date,
      });
    }
  }
  const al: PriceAlert[] = Object.values(alerts ?? {}).map((a) => ({
    id: uid(), coinId: a.coinId, symbol: a.symbol.toLowerCase(), name: a.name, image: a.image,
    direction: a.type, target: Number(a.targetPrice), priceAtCreation: Number(a.currentPriceAtCreation ?? 0),
    createdAt: a.createdAt, triggered: !!a.triggered,
  }));
  return { watchlist: [], transactions, alerts: al, notes: [] };
}

function migrateLegacyLocal(state: UserState) {
  try {
    const p = localStorage.getItem('cryptointel_portfolio');
    const a = localStorage.getItem('cryptointel_alerts');
    if (!p && !a) return;
    const legacy = convertLegacy(p ? JSON.parse(p) : null, a ? JSON.parse(a) : null);
    if (legacy.transactions.length || legacy.alerts.length) {
      state.replaceAll({
        watchlist: state.watchlist,
        transactions: [...state.transactions, ...legacy.transactions],
        alerts: [...state.alerts, ...legacy.alerts],
        notes: state.notes ?? [],
      });
    }
    // Import once: remove v1 keys so they are never re-imported (e.g. after sign-out)
    localStorage.removeItem('cryptointel_portfolio');
    localStorage.removeItem('cryptointel_alerts');
  } catch {
    /* ignore corrupted legacy data */
  }
}

/* Live prices from the Binance all-market mini-ticker stream (one socket, every pair, ~1s). */
import { create } from 'zustand';
import { WS } from '../api/binance';

export interface Tick {
  price: number;
  open24h: number;
  change24h: number; // %
  quoteVolume: number;
}

interface LiveState {
  ticks: Record<string, Tick>;
  status: 'connecting' | 'live' | 'offline';
  lastUpdate: number;
}

export const useLive = create<LiveState>(() => ({ ticks: {}, status: 'connecting', lastUpdate: 0 }));

type Listener = (pair: string, tick: Tick) => void;
const listeners = new Set<Listener>();
export const onTick = (fn: Listener) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

let socket: WebSocket | null = null;
let retry = 0;
let started = false;

export function startLive() {
  if (started) return;
  started = true;
  connect();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && (!socket || socket.readyState > 1)) connect();
  });
}

function connect() {
  try {
    socket?.close();
  } catch {
    /* ignore */
  }
  useLive.setState({ status: 'connecting' });
  const ws = new WebSocket(`${WS}/ws/!miniTicker@arr`);
  socket = ws;

  ws.onopen = () => {
    retry = 0;
    useLive.setState({ status: 'live' });
  };

  ws.onmessage = (ev) => {
    const arr = JSON.parse(ev.data) as { s: string; c: string; o: string; q: string }[];
    const prev = useLive.getState().ticks;
    const next: Record<string, Tick> = { ...prev };
    for (const m of arr) {
      if (!m.s.endsWith('USDT')) continue;
      const price = +m.c;
      const open = +m.o;
      const tick = { price, open24h: open, change24h: open ? ((price - open) / open) * 100 : 0, quoteVolume: +m.q };
      next[m.s] = tick;
      listeners.forEach((l) => l(m.s, tick));
    }
    useLive.setState({ ticks: next, status: 'live', lastUpdate: Date.now() });
  };

  ws.onclose = () => {
    if (socket !== ws) return;
    useLive.setState({ status: 'offline' });
    const delay = Math.min(30000, 1000 * 2 ** retry++);
    setTimeout(connect, delay);
  };
  ws.onerror = () => ws.close();
}

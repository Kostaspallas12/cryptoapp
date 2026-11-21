/* Watches live prices and fires price alerts (toast + sound + desktop notification). */
import { useEffect } from 'react';
import { usePairMap, useMarkets } from '../hooks/data';
import { translate } from '../i18n';
import { fmtPrice } from '../lib/format';
import { onTick } from '../store/live';
import { useSettings } from '../store/settings';
import { useUser, type PriceAlert } from '../store/user';
import { toast } from './Toasts';

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    o.start();
    o.stop(ctx.currentTime + 0.5);
  } catch {
    /* audio not allowed */
  }
}

function fire(a: PriceAlert, price: number) {
  useUser.getState().markTriggered(a.id, price);
  const lang = useSettings.getState().lang;
  const body = translate(lang, 'al.hit', {
    name: a.name,
    direction: translate(lang, a.direction === 'above' ? 'al.above' : 'al.below'),
    target: fmtPrice(a.target),
  });
  toast({ title: `${translate(lang, 'al.hitTitle')} · ${a.symbol.toUpperCase()}`, body: `${body} (${fmtPrice(price)})`, image: a.image, tone: a.direction === 'above' ? 'up' : 'down' }, 15000);
  beep();
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(`${a.symbol.toUpperCase()} ${fmtPrice(price)}`, { body, icon: a.image, tag: a.id });
    } catch {
      /* some mobile browsers only allow notifications from a service worker */
    }
  }
}

const hit = (a: PriceAlert, price: number) => (a.direction === 'above' ? price >= a.target : price <= a.target);

export function AlertEngine() {
  const pairs = usePairMap();
  const { data: coins } = useMarkets();

  // Binance-listed coins: check on every live tick
  useEffect(() => {
    const byPair: Record<string, string> = {};
    for (const [id, p] of Object.entries(pairs)) byPair[p] = id;
    return onTick((pair, tick) => {
      const coinId = byPair[pair];
      if (!coinId) return;
      for (const a of useUser.getState().alerts) {
        if (!a.triggered && a.coinId === coinId && hit(a, tick.price)) fire(a, tick.price);
      }
    });
  }, [pairs]);

  // Everything else: check whenever CoinGecko prices refresh
  useEffect(() => {
    if (!coins) return;
    const byId = new Map(coins.map((c) => [c.id, c.current_price]));
    for (const a of useUser.getState().alerts) {
      if (a.triggered || pairs[a.coinId]) continue;
      const price = byId.get(a.coinId);
      if (price !== undefined && hit(a, price)) fire(a, price);
    }
  }, [coins, pairs]);

  return null;
}

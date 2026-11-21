/* Technical Rating engine.
   Same idea as the industry-standard "technical rating": every indicator casts a
   vote (+1 buy, 0 neutral, -1 sell). Votes are averaged per group (oscillators,
   moving averages) and the two group averages are averaged into the summary.  */
import type { Candle } from '../types';
import { atr, bollinger, cci, ema, last, macd, prevLast, rsi, sma, stochastic } from './indicators';

export type Vote = 1 | 0 | -1;
export type RatingKey = 'strong-buy' | 'buy' | 'neutral' | 'sell' | 'strong-sell';

export interface IndicatorVote {
  id: string; // i18n key: ind.<id>
  label: string; // e.g. "RSI (14)"
  value: number | null;
  vote: Vote;
  /** i18n key of the plain-language explanation for this state */
  explain: string;
}

export interface Rating {
  score: number; // -1 … 1
  percent: number; // 0 … 100
  key: RatingKey;
  oscillators: { score: number; key: RatingKey; votes: IndicatorVote[] };
  movingAverages: { score: number; key: RatingKey; votes: IndicatorVote[] };
  counts: { buy: number; neutral: number; sell: number };
  volatility: number | null; // ATR as % of price
  risk: 'low' | 'medium' | 'high' | 'very-high';
  pivots: { s2: number; s1: number; p: number; r1: number; r2: number } | null;
  trend: 'up' | 'down' | 'sideways';
}

export function toKey(score: number): RatingKey {
  if (score > 0.5) return 'strong-buy';
  if (score > 0.1) return 'buy';
  if (score >= -0.1) return 'neutral';
  if (score >= -0.5) return 'sell';
  return 'strong-sell';
}

const avg = (v: IndicatorVote[]) => (v.length ? v.reduce((a, b) => a + b.vote, 0) / v.length : 0);

export function computeRating(candles: Candle[], marketCapRank?: number): Rating | null {
  if (candles.length < 30) return null;
  const close = candles.map((c) => c.close);
  const high = candles.map((c) => c.high);
  const low = candles.map((c) => c.low);
  const price = close[close.length - 1];

  /* ── Oscillators ── */
  const osc: IndicatorVote[] = [];

  const r = last(rsi(close));
  const rPrev = prevLast(rsi(close));
  if (r !== null) {
    let vote: Vote = 0;
    let explain = 'rsi.neutral';
    if (r < 30 && rPrev !== null && r > rPrev) { vote = 1; explain = 'rsi.oversoldRising'; }
    else if (r < 30) { vote = 1; explain = 'rsi.oversold'; }
    else if (r > 70 && rPrev !== null && r < rPrev) { vote = -1; explain = 'rsi.overboughtFalling'; }
    else if (r > 70) { vote = -1; explain = 'rsi.overbought'; }
    else if (r >= 50) explain = 'rsi.neutralHigh';
    else explain = 'rsi.neutralLow';
    osc.push({ id: 'rsi', label: 'RSI (14)', value: r, vote, explain });
  }

  const m = macd(close);
  const ml = last(m.line);
  const ms = last(m.signal);
  if (ml !== null && ms !== null) {
    const vote: Vote = ml > ms ? 1 : -1;
    osc.push({ id: 'macd', label: 'MACD (12, 26)', value: ml - ms, vote, explain: vote > 0 ? 'macd.bull' : 'macd.bear' });
  }

  const st = stochastic(high, low, close);
  const k = last(st.k);
  const d = last(st.d);
  if (k !== null && d !== null) {
    let vote: Vote = 0;
    let explain = 'stoch.neutral';
    if (k < 20 && k > d) { vote = 1; explain = 'stoch.oversold'; }
    else if (k > 80 && k < d) { vote = -1; explain = 'stoch.overbought'; }
    osc.push({ id: 'stoch', label: 'Stoch %K (14, 3, 3)', value: k, vote, explain });
  }

  const c = cci(high, low, close);
  const cv = last(c);
  const cp = prevLast(c);
  if (cv !== null) {
    let vote: Vote = 0;
    let explain = 'cci.neutral';
    if (cv < -100 && cp !== null && cv > cp) { vote = 1; explain = 'cci.oversold'; }
    else if (cv > 100 && cp !== null && cv < cp) { vote = -1; explain = 'cci.overbought'; }
    osc.push({ id: 'cci', label: 'CCI (20)', value: cv, vote, explain });
  }

  const bb = bollinger(close);
  const bu = last(bb.upper);
  const bl = last(bb.lower);
  if (bu !== null && bl !== null) {
    const pb = (price - bl) / (bu - bl);
    let vote: Vote = 0;
    let explain = 'bb.inside';
    if (pb < 0) { vote = 1; explain = 'bb.below'; }
    else if (pb > 1) { vote = -1; explain = 'bb.above'; }
    osc.push({ id: 'bb', label: 'Bollinger %B (20)', value: pb * 100, vote, explain });
  }

  // Momentum (10)
  if (close.length > 11) {
    const mom = price - close[close.length - 11];
    const momPrev = close[close.length - 2] - close[close.length - 12];
    const vote: Vote = mom > momPrev ? 1 : mom < momPrev ? -1 : 0;
    osc.push({ id: 'mom', label: 'Momentum (10)', value: mom, vote, explain: vote > 0 ? 'mom.up' : vote < 0 ? 'mom.down' : 'mom.flat' });
  }

  /* ── Moving averages ── */
  const mas: IndicatorVote[] = [];
  for (const p of [10, 20, 50, 100, 200]) {
    for (const [type, fn] of [['EMA', ema], ['SMA', sma]] as const) {
      const v = last(fn(close, p));
      if (v === null) continue;
      const vote: Vote = price > v ? 1 : price < v ? -1 : 0;
      mas.push({
        id: `${type.toLowerCase()}${p}`,
        label: `${type} (${p})`,
        value: v,
        vote,
        explain: vote > 0 ? 'ma.above' : vote < 0 ? 'ma.below' : 'ma.at',
      });
    }
  }

  const oscScore = avg(osc);
  const maScore = avg(mas);
  const score = mas.length ? (oscScore + maScore) / 2 : oscScore;

  const all = [...osc, ...mas];
  const counts = {
    buy: all.filter((v) => v.vote === 1).length,
    neutral: all.filter((v) => v.vote === 0).length,
    sell: all.filter((v) => v.vote === -1).length,
  };

  /* ── Volatility / risk ── */
  const a = last(atr(high, low, close));
  const volatility = a !== null ? (a / price) * 100 : null;
  let riskPts = 0;
  if (volatility !== null) riskPts += volatility > 10 ? 3 : volatility > 6 ? 2 : volatility > 3 ? 1 : 0;
  if (marketCapRank) riskPts += marketCapRank > 100 ? 2 : marketCapRank > 20 ? 1 : 0;
  if (r !== null && (r > 80 || r < 20)) riskPts += 1;
  const risk = riskPts <= 1 ? 'low' : riskPts <= 2 ? 'medium' : riskPts <= 4 ? 'high' : 'very-high';

  /* ── Classic pivot points from the previous closed candle ── */
  const prev = candles[candles.length - 2];
  const pivots = prev
    ? (() => {
        const p = (prev.high + prev.low + prev.close) / 3;
        return {
          p,
          r1: 2 * p - prev.low,
          s1: 2 * p - prev.high,
          r2: p + (prev.high - prev.low),
          s2: p - (prev.high - prev.low),
        };
      })()
    : null;

  /* ── Trend: EMA20 vs EMA50 slope ── */
  const e20 = last(ema(close, 20));
  const e50 = last(ema(close, 50));
  let trend: Rating['trend'] = 'sideways';
  if (e20 !== null && e50 !== null) {
    const gap = (e20 - e50) / e50;
    if (gap > 0.01 && price > e20) trend = 'up';
    else if (gap < -0.01 && price < e20) trend = 'down';
  }

  return {
    score,
    percent: Math.round(((score + 1) / 2) * 100),
    key: toKey(score),
    oscillators: { score: oscScore, key: toKey(oscScore), votes: osc },
    movingAverages: { score: maScore, key: toKey(maScore), votes: mas },
    counts,
    volatility,
    risk,
    pivots,
    trend,
  };
}

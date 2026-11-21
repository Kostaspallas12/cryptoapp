/* Technical indicators — every function returns a full series aligned with the input
   (null where there is not yet enough data), so the same values can feed both
   the chart overlays and the rating engine. */

export type Series = (number | null)[];

export function sma(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** EMA over a series that starts with nulls */
function emaSparse(values: Series, period: number): Series {
  const start = values.findIndex((v) => v !== null);
  const out: Series = new Array(values.length).fill(null);
  if (start < 0) return out;
  const dense = values.slice(start) as number[];
  const e = ema(dense, period);
  e.forEach((v, i) => (out[start + i] = v));
  return out;
}

/** Wilder's RSI */
export function rsi(closes: number[], period = 14): Series {
  const out: Series = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgG = gain / period;
  let avgL = loss / period;
  out[period] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgG = (avgG * (period - 1) + Math.max(d, 0)) / period;
    avgL = (avgL * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  }
  return out;
}

export function macd(closes: number[], fast = 12, slow = 26, signal = 9) {
  const ef = ema(closes, fast);
  const es = ema(closes, slow);
  const line: Series = closes.map((_, i) => (ef[i] !== null && es[i] !== null ? ef[i]! - es[i]! : null));
  const sig = emaSparse(line, signal);
  const hist: Series = line.map((v, i) => (v !== null && sig[i] !== null ? v - sig[i]! : null));
  return { line, signal: sig, hist };
}

export function bollinger(closes: number[], period = 20, mult = 2) {
  const mid = sma(closes, period);
  const upper: Series = new Array(closes.length).fill(null);
  const lower: Series = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    const m = mid[i]!;
    let v = 0;
    for (let j = i - period + 1; j <= i; j++) v += (closes[j] - m) ** 2;
    const sd = Math.sqrt(v / period);
    upper[i] = m + mult * sd;
    lower[i] = m - mult * sd;
  }
  return { mid, upper, lower };
}

/** Stochastic %K / %D */
export function stochastic(high: number[], low: number[], close: number[], kPeriod = 14, kSmooth = 3, dPeriod = 3) {
  const raw: Series = new Array(close.length).fill(null);
  for (let i = kPeriod - 1; i < close.length; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      hh = Math.max(hh, high[j]);
      ll = Math.min(ll, low[j]);
    }
    raw[i] = hh === ll ? 50 : ((close[i] - ll) / (hh - ll)) * 100;
  }
  const k = smaSparse(raw, kSmooth);
  const d = smaSparse(k, dPeriod);
  return { k, d };
}

function smaSparse(values: Series, period: number): Series {
  const start = values.findIndex((v) => v !== null);
  const out: Series = new Array(values.length).fill(null);
  if (start < 0) return out;
  const s = sma(values.slice(start) as number[], period);
  s.forEach((v, i) => (out[start + i] = v));
  return out;
}

/** Commodity Channel Index */
export function cci(high: number[], low: number[], close: number[], period = 20): Series {
  const tp = close.map((c, i) => (high[i] + low[i] + c) / 3);
  const m = sma(tp, period);
  const out: Series = new Array(close.length).fill(null);
  for (let i = period - 1; i < close.length; i++) {
    let md = 0;
    for (let j = i - period + 1; j <= i; j++) md += Math.abs(tp[j] - m[i]!);
    md /= period;
    out[i] = md === 0 ? 0 : (tp[i] - m[i]!) / (0.015 * md);
  }
  return out;
}

/** Average True Range (Wilder) */
export function atr(high: number[], low: number[], close: number[], period = 14): Series {
  const tr = close.map((_, i) =>
    i === 0
      ? high[i] - low[i]
      : Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1])),
  );
  const out: Series = new Array(close.length).fill(null);
  if (close.length < period) return out;
  let prev = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < close.length; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

export const last = (s: Series): number | null => {
  for (let i = s.length - 1; i >= 0; i--) if (s[i] !== null) return s[i];
  return null;
};

export const prevLast = (s: Series): number | null => {
  let found = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    if (s[i] !== null) {
      if (found === 1) return s[i];
      found++;
    }
  }
  return null;
};

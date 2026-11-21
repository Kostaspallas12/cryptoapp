let currentLocale = 'el-GR';
export const setFormatLocale = (lang: string) => {
  currentLocale = lang === 'el' ? 'el-GR' : 'en-US';
};

/** Price with decimals adapted to magnitude: 64,231.12 · 1.2345 · 0.00001234 */
export function fmtPrice(v: number | null | undefined, currency = true): string {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  const abs = Math.abs(v);
  let digits: number;
  if (abs >= 1000) digits = 2;
  else if (abs >= 1) digits = abs >= 100 ? 2 : 4;
  else if (abs >= 0.01) digits = 5;
  else if (abs === 0) digits = 2;
  else digits = Math.min(10, Math.ceil(-Math.log10(abs)) + 3);
  const s = v.toLocaleString(currentLocale, {
    minimumFractionDigits: abs >= 1000 ? 2 : Math.min(digits, 2),
    maximumFractionDigits: digits,
  });
  return currency ? `$${s}` : s;
}

/** Compact money: $1.23T, $45.6B, $789M */
export function fmtCompact(v: number | null | undefined, currency = true): string {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  const s = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(v);
  return currency ? `$${s}` : s;
}

export function fmtNumber(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  return v.toLocaleString(currentLocale, { maximumFractionDigits: digits });
}

export function fmtPct(v: number | null | undefined, digits = 2, sign = true): string {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  const s = Math.abs(v).toLocaleString(currentLocale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  if (!sign) return `${s}%`;
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${s}%`;
}

export function fmtDate(d: string | number | Date, withTime = false): string {
  const date = new Date(d);
  return date.toLocaleString(currentLocale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function fmtTime(d: number | Date): string {
  return new Date(d).toLocaleTimeString(currentLocale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export const changeClass = (v: number | null | undefined) =>
  v === null || v === undefined || v === 0 ? 'flat' : v > 0 ? 'up' : 'down';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/** Only allow http(s) links from third-party data (blocks javascript:, data:, etc.) */
export function safeUrl(u: string | undefined | null): string | undefined {
  if (!u) return undefined;
  try {
    const url = new URL(u);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

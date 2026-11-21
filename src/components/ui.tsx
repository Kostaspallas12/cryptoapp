/* Small shared UI pieces */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useT } from '../i18n';
import { changeClass, fmtPct, fmtPrice } from '../lib/format';
import type { RatingKey } from '../lib/rating';
import { useUser } from '../store/user';
import { IconClose, IconStar } from './Icons';

export function CoinImg({ src, alt, size = 26 }: { src?: string; alt: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (!src || err)
    return (
      <span
        style={{ width: size, height: size, borderRadius: '50%', background: 'var(--surface-3)', display: 'grid', placeItems: 'center', fontSize: size * 0.42, fontWeight: 700, color: 'var(--text-2)', flexShrink: 0 }}
      >
        {alt.slice(0, 1).toUpperCase()}
      </span>
    );
  return <img src={src} alt={alt} width={size} height={size} loading="lazy" onError={() => setErr(true)} style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0 }} />;
}

export function Pct({ v, pill = false, digits = 2 }: { v: number | null | undefined; pill?: boolean; digits?: number }) {
  const cls = changeClass(v);
  return <span className={`num ${cls} ${pill ? `pct-pill ${cls}` : ''}`}>{fmtPct(v, digits)}</span>;
}

/** Price that briefly flashes green/red when it changes */
export function LivePrice({ value, className = '' }: { value: number | null; className?: string }) {
  const prev = useRef(value);
  const [flash, setFlash] = useState('');
  useEffect(() => {
    if (value !== null && prev.current !== null && value !== prev.current) {
      setFlash(value > prev.current ? 'flash-up' : 'flash-down');
      const t = setTimeout(() => setFlash(''), 900);
      prev.current = value;
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [value]);
  return <span className={`price-cell ${flash} ${className}`} style={{ borderRadius: 4, padding: '1px 3px', margin: '-1px -3px' }}>{fmtPrice(value)}</span>;
}

export const RATING_COLOR: Record<RatingKey, string> = {
  'strong-buy': 'var(--up)',
  buy: 'var(--up)',
  neutral: 'var(--text-3)',
  sell: 'var(--down)',
  'strong-sell': 'var(--down)',
};

export function RatingBadge({ rating }: { rating?: RatingKey | null }) {
  const t = useT();
  if (!rating) return <span className="badge na">{t('rating.na')}</span>;
  return <span className={`badge ${rating}`}>{t(`rating.${rating}`)}</span>;
}

export function RiskBadge({ risk }: { risk?: 'low' | 'medium' | 'high' | 'very-high' }) {
  const t = useT();
  if (!risk) return <span className="faint">—</span>;
  return <span className={`badge risk-${risk}`}>{t(`risk.${risk}`)}</span>;
}

export function StarButton({ coinId, size = 16 }: { coinId: string; size?: number }) {
  const on = useUser((s) => s.watchlist.includes(coinId));
  const toggle = useUser((s) => s.toggleWatch);
  return (
    <button
      className={`star ${on ? 'on' : ''}`}
      aria-label="watchlist"
      aria-pressed={on}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        toggle(coinId);
      }}
    >
      <IconStar size={size} filled={on} />
    </button>
  );
}

export function Sparkline({ data, width = 120, height = 36, color }: { data?: number[]; width?: number; height?: number; color?: string }) {
  if (!data || data.length < 2) return <span className="faint">—</span>;
  // downsample for speed
  const step = Math.max(1, Math.floor(data.length / 60));
  const pts = data.filter((_, i) => i % step === 0 || i === data.length - 1);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const d = pts
    .map((v, i) => `${i ? 'L' : 'M'}${((i / (pts.length - 1)) * width).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`)
    .join(' ');
  const up = pts[pts.length - 1] >= pts[0];
  const c = color ?? (up ? 'var(--up)' : 'var(--down)');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', marginLeft: 'auto' }}>
      <path d={d} fill="none" stroke={c} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Semi-circle gauge for ratings (-1…1) or sentiment (0…100) */
export function Gauge({ value, min, max, label, color, size = 180 }: { value: number; min: number; max: number; label: ReactNode; color: string; size?: number }) {
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const r = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2 + 4;
  const arc = (from: number, to: number) => {
    const a0 = Math.PI * (1 - from);
    const a1 = Math.PI * (1 - to);
    return `M ${cx + r * Math.cos(a0)} ${cy - r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(a1)} ${cy - r * Math.sin(a1)}`;
  };
  const angle = Math.PI * (1 - pct);
  const nx = cx + (r - 16) * Math.cos(angle);
  const ny = cy - (r - 16) * Math.sin(angle);
  const segs = ['var(--down)', 'color-mix(in srgb, var(--down) 55%, var(--warn))', 'var(--text-3)', 'color-mix(in srgb, var(--up) 55%, var(--warn))', 'var(--up)'];
  return (
    <div style={{ position: 'relative', width: size }}>
      <svg width={size} height={size / 2 + 14}>
        {segs.map((c, i) => (
          <path key={i} d={arc(i / 5 + 0.008, (i + 1) / 5 - 0.008)} stroke={c} strokeWidth="9" fill="none" strokeLinecap="round" opacity={0.85} />
        ))}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--text)" strokeWidth="3" strokeLinecap="round" style={{ transition: 'all .6s' }} />
        <circle cx={cx} cy={cy} r="6" fill="var(--text)" />
      </svg>
      <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 16, color, marginTop: 2 }}>{label}</div>
    </div>
  );
}

export function Modal({ title, onClose, children, footer, className = '' }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; className?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${className}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={onClose} aria-label="close">
            <IconClose size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Skeleton({ w = '100%', h = 14, r }: { w?: number | string; h?: number; r?: number }) {
  return <div className="skel" style={{ width: w, height: h, borderRadius: r }} />;
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'active' : ''} onClick={() => onChange(o.value)} role="tab" aria-selected={o.value === value}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ErrorBox({ onRetry }: { onRetry?: () => void }) {
  const t = useT();
  return (
    <div className="empty">
      <p>{t('common.error')}</p>
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}

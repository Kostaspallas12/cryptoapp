import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchCoins, type SearchHit } from '../api/coingecko';
import { useMarkets, usePairMap } from '../hooks/data';
import { useT } from '../i18n';
import { fmtPrice } from '../lib/format';
import { useLive } from '../store/live';
import { IconSearch } from './Icons';
import { CoinImg, Pct } from './ui';

interface Item {
  id: string;
  name: string;
  symbol: string;
  image: string;
  rank: number | null;
  price?: number;
  change?: number | null;
}

export function SearchPalette({ onClose }: { onClose: () => void }) {
  const t = useT();
  const nav = useNavigate();
  const { data: coins } = useMarkets();
  const pairs = usePairMap();
  const ticks = useLive((s) => s.ticks);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [remote, setRemote] = useState<SearchHit[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const local: Item[] = useMemo(() => {
    const list = coins ?? [];
    const s = q.trim().toLowerCase();
    const filtered = s
      ? list.filter((c) => c.name.toLowerCase().includes(s) || c.symbol.toLowerCase().startsWith(s))
          .sort((a, b) => Number(b.symbol.toLowerCase() === s) - Number(a.symbol.toLowerCase() === s))
      : list;
    return filtered.slice(0, 10).map((c) => {
      const tick = pairs[c.id] ? ticks[pairs[c.id]] : undefined;
      return {
        id: c.id, name: c.name, symbol: c.symbol, image: c.image, rank: c.market_cap_rank,
        price: tick?.price ?? c.current_price, change: tick?.change24h ?? c.price_change_percentage_24h,
      };
    });
  }, [coins, q, pairs, ticks]);

  // Coins outside the top 250 → CoinGecko search
  useEffect(() => {
    const s = q.trim();
    if (s.length < 2 || local.length >= 5) {
      setRemote([]);
      return;
    }
    const h = setTimeout(() => searchCoins(s).then(setRemote).catch(() => setRemote([])), 300);
    return () => clearTimeout(h);
  }, [q, local.length]);

  const items: Item[] = [
    ...local,
    ...remote
      .filter((r) => !local.some((l) => l.id === r.id))
      .map((r) => ({ id: r.id, name: r.name, symbol: r.symbol, image: r.thumb, rank: r.market_cap_rank })),
  ];

  const go = (it?: Item) => {
    if (!it) return;
    nav(`/coin/${it.id}`);
    onClose();
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal palette" role="dialog" aria-modal="true">
        <div className="palette-input">
          <IconSearch size={18} className="faint" />
          <input
            ref={inputRef}
            value={q}
            placeholder={t('common.searchHint')}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              if (e.key === 'Enter') go(items[active]);
            }}
          />
          <span className="kbd">Esc</span>
        </div>
        <div className="palette-list">
          {items.length === 0 && <div className="palette-empty">{t('common.noResults')}</div>}
          {items.map((it, i) => (
            <div key={it.id} className={`palette-item ${i === active ? 'active' : ''}`} onMouseEnter={() => setActive(i)} onClick={() => go(it)}>
              <CoinImg src={it.image} alt={it.name} size={24} />
              <div className="grow">
                <span className="bold">{it.name}</span> <span className="faint small" style={{ textTransform: 'uppercase' }}>{it.symbol}</span>
              </div>
              {it.price !== undefined && <span className="num small">{fmtPrice(it.price)}</span>}
              {it.change !== undefined && <Pct v={it.change} />}
              {it.rank && <span className="rank-tag">#{it.rank}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

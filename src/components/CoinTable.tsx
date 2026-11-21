import { memo, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePairMap } from '../hooks/data';
import { useT } from '../i18n';
import { fmtCompact } from '../lib/format';
import type { RatingKey } from '../lib/rating';
import { useLive } from '../store/live';
import { loadRatings, useRatings, type RatingSummary } from '../store/ratings';
import { useSettings } from '../store/settings';
import type { Interval, MarketCoin } from '../types';
import { CoinImg, LivePrice, Pct, RatingBadge, Seg, Skeleton, Sparkline, StarButton } from './ui';

type SortKey = 'rank' | 'name' | 'price' | 'h1' | 'h24' | 'd7' | 'mcap' | 'vol' | 'rating';
const RATING_ORDER: Record<RatingKey, number> = { 'strong-buy': 5, buy: 4, neutral: 3, sell: 2, 'strong-sell': 1 };

const Row = memo(function Row({ coin, pair, rating }: { coin: MarketCoin; pair?: string; rating?: RatingSummary }) {
  const nav = useNavigate();
  const tick = useLive((s) => (pair ? s.ticks[pair] : undefined));
  const price = tick?.price ?? coin.current_price;
  const ch24 = tick?.change24h ?? coin.price_change_percentage_24h;
  return (
    <tr onClick={() => nav(`/coin/${coin.id}`)}>
      <td className="left" style={{ paddingRight: 0, width: 36 }}>
        <StarButton coinId={coin.id} size={15} />
      </td>
      <td className="left faint" style={{ width: 44 }}>{coin.market_cap_rank}</td>
      <td className="left">
        <div className="coin-cell">
          <CoinImg src={coin.image} alt={coin.name} />
          <div className="stack" style={{ gap: 0 }}>
            <span className="name">{coin.name}</span>
            <span className="sym">{coin.symbol}</span>
          </div>
        </div>
      </td>
      <td><LivePrice value={price} /></td>
      <td><Pct v={ch24} /></td>
      <td><Pct v={coin.price_change_percentage_7d_in_currency} /></td>
      <td className="num">{fmtCompact(coin.market_cap)}</td>
      <td className="num muted">{fmtCompact(coin.total_volume)}</td>
      <td style={{ width: 120 }}><Sparkline data={coin.sparkline_in_7d?.price} width={108} /></td>
      <td><RatingBadge rating={rating?.key} /></td>
    </tr>
  );
});

export function useRatingsFor(coins: MarketCoin[] | undefined) {
  const interval = useSettings((s) => s.ratingInterval);
  const pairs = usePairMap();
  const ratings = useRatings((s) => s.byInterval[interval]);
  const progress = useRatings((s) => s.progress[interval]);
  useEffect(() => {
    if (coins?.length && Object.keys(pairs).length) loadRatings(interval, coins, pairs);
  }, [coins, pairs, interval]);
  return { interval, ratings: ratings ?? {}, progress, pairs };
}

interface Props {
  coins: MarketCoin[];
  loading?: boolean;
  pageSize?: number;
  toolbarLeft?: React.ReactNode;
  filter?: 'all' | 'buy' | 'sell';
}

export function CoinTable({ coins, loading, pageSize = 50, toolbarLeft, filter = 'all' }: Props) {
  const t = useT();
  const setInterval_ = useSettings((s) => s.setRatingInterval);
  const { interval, ratings, progress, pairs } = useRatingsFor(coins);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'rank', dir: 1 });
  const [limit, setLimit] = useState(pageSize);

  const rows = useMemo(() => {
    let list = coins;
    if (filter === 'buy') list = list.filter((c) => ratings[c.id]?.key === 'buy' || ratings[c.id]?.key === 'strong-buy');
    if (filter === 'sell') list = list.filter((c) => ratings[c.id]?.key === 'sell' || ratings[c.id]?.key === 'strong-sell');
    const ticks = useLive.getState().ticks;
    const val = (c: MarketCoin): number | string => {
      switch (sort.key) {
        case 'rank': return c.market_cap_rank ?? 1e9;
        case 'name': return c.name.toLowerCase();
        case 'price': return (pairs[c.id] && ticks[pairs[c.id]]?.price) || c.current_price;
        case 'h1': return c.price_change_percentage_1h_in_currency ?? -1e9;
        case 'h24': return (pairs[c.id] ? ticks[pairs[c.id]]?.change24h : undefined) ?? c.price_change_percentage_24h ?? -1e9;
        case 'd7': return c.price_change_percentage_7d_in_currency ?? -1e9;
        case 'mcap': return c.market_cap;
        case 'vol': return c.total_volume;
        case 'rating': return ratings[c.id] ? RATING_ORDER[ratings[c.id].key] * 1000 + ratings[c.id].percent : -1;
      }
    };
    return [...list].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });
  }, [coins, sort, ratings, filter, pairs]);

  const th = (key: SortKey, label: string, cls = '') => (
    <th
      className={`sortable ${cls} ${sort.key === key ? 'sorted' : ''}`}
      onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : key === 'rank' || key === 'name' ? 1 : -1 }))}
    >
      {label} {sort.key === key ? (sort.dir === 1 ? '↑' : '↓') : ''}
    </th>
  );

  const pct = progress ? Math.round((progress.done / Math.max(1, progress.total)) * 100) : 0;
  const analyzing = progress && progress.done < progress.total;

  return (
    <div className="card card-flush">
      <div className="toolbar">
        <div className="row-wrap">{toolbarLeft}</div>
        <div className="row-wrap">
          {analyzing && <span className="faint xs">{t('rating.analyzing', { done: progress!.done, total: progress!.total })}</span>}
          <span className="faint small hide-sm">{t('market.ratingTf')}</span>
          <Seg<Interval>
            value={interval}
            onChange={setInterval_}
            options={[{ value: '1h', label: '1H' }, { value: '4h', label: '4H' }, { value: '1d', label: '1D' }, { value: '1w', label: '1W' }]}
          />
        </div>
      </div>
      <div className="progress-line" style={{ opacity: analyzing ? 1 : 0 }}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th className="left" />
              {th('rank', '#', 'left')}
              {th('name', t('common.coin'), 'left')}
              {th('price', t('common.price'))}
              {th('h24', '24h')}
              {th('d7', '7d')}
              {th('mcap', t('common.marketCap'))}
              {th('vol', t('common.volume24h'))}
              <th>{t('common.last7d')}</th>
              {th('rating', t('common.rating'))}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 10 }, (_, i) => (
                <tr key={i}>
                  <td colSpan={10}><Skeleton h={22} /></td>
                </tr>
              ))}
            {rows.slice(0, limit).map((c) => (
              <Row key={c.id} coin={c} pair={pairs[c.id]} rating={ratings[c.id]} />
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <div style={{ padding: 14, textAlign: 'center', borderTop: '1px solid var(--border)' }}>
          <button className="btn" onClick={() => setLimit((l) => l + pageSize)}>
            {t('market.showMore')} ({rows.length - limit})
          </button>
        </div>
      )}
    </div>
  );
}

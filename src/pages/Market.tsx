import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CoinTable } from '../components/CoinTable';
import { IconFlame, IconInfo, IconTrendDown, IconTrendUp } from '../components/Icons';
import { CoinImg, ErrorBox, Gauge, Pct, Skeleton, Sparkline } from '../components/ui';
import { useFearGreed, useGlobal, useMarkets, usePairMap, useTrending } from '../hooks/data';
import { useT } from '../i18n';
import { fmtCompact, fmtNumber, fmtPrice } from '../lib/format';
import { useLive } from '../store/live';
import { useUser } from '../store/user';
import type { MarketCoin } from '../types';

function fngColor(v: number) {
  if (v < 25) return 'var(--down)';
  if (v < 45) return 'color-mix(in srgb, var(--down) 55%, var(--warn))';
  if (v <= 55) return 'var(--text-2)';
  if (v <= 75) return 'color-mix(in srgb, var(--up) 55%, var(--warn))';
  return 'var(--up)';
}

function StatsStrip() {
  const t = useT();
  const { data: g } = useGlobal();
  const items = [
    { label: t('market.globalCap'), value: fmtCompact(g?.total_market_cap.usd), sub: g && <Pct v={g.market_cap_change_percentage_24h_usd} /> },
    { label: t('market.volume'), value: fmtCompact(g?.total_volume.usd) },
    { label: t('market.btcDom'), value: g ? `${g.market_cap_percentage.btc.toFixed(1)}%` : '—' },
    { label: t('market.ethDom'), value: g ? `${g.market_cap_percentage.eth.toFixed(1)}%` : '—' },
    { label: t('market.coins'), value: g ? fmtNumber(g.active_cryptocurrencies, 0) : '—' },
  ];
  return (
    <div className="stats-strip">
      {items.map((it) => (
        <div key={it.label}>
          <div className="stat-label">{it.label}</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{g ? it.value : <Skeleton w={90} h={20} />}</div>
          {it.sub && <div className="stat-sub">{it.sub}</div>}
        </div>
      ))}
    </div>
  );
}

function FearGreedCard() {
  const t = useT();
  const { data } = useFearGreed();
  return (
    <div className="card">
      <div className="card-title">
        <span>{t('fng.title')}</span>
        <span title={t('fng.explain')} className="faint" style={{ cursor: 'help' }}><IconInfo size={14} /></span>
      </div>
      {data ? (
        <div className="row" style={{ gap: 16, alignItems: 'center' }}>
          <Gauge value={data.value} min={0} max={100} size={150} color={fngColor(data.value)} label={<><span className="num" style={{ fontSize: 26 }}>{data.value}</span><div className="small">{t(`fng.${data.label}`)}</div></>} />
          <div className="grow">
            <p className="muted small" style={{ lineHeight: 1.6 }}>{t('fng.explain')}</p>
            <div style={{ marginTop: 10 }}>
              <Sparkline data={data.history.map((h) => h.value)} width={150} height={30} color="var(--accent)" />
            </div>
          </div>
        </div>
      ) : (
        <Skeleton h={120} />
      )}
    </div>
  );
}

function MoverCard({ title, icon, coins, pairs }: { title: string; icon: React.ReactNode; coins: MarketCoin[]; pairs: Record<string, string> }) {
  const ticks = useLive((s) => s.ticks);
  return (
    <div className="card">
      <div className="card-title"><span className="row">{icon}{title}</span></div>
      <div className="mini-list">
        {coins.length === 0 && Array.from({ length: 5 }, (_, i) => <div key={i} style={{ padding: '8px 0' }}><Skeleton h={22} /></div>)}
        {coins.map((c) => {
          const tk = pairs[c.id] ? ticks[pairs[c.id]] : undefined;
          return (
            <Link key={c.id} to={`/coin/${c.id}`} className="mini-row">
              <CoinImg src={c.image} alt={c.name} size={22} />
              <div className="grow ellipsis"><span className="nm">{c.symbol.toUpperCase()}</span> <span className="faint small">{c.name}</span></div>
              <span className="num small">{fmtPrice(tk?.price ?? c.current_price)}</span>
              <Pct v={tk?.change24h ?? c.price_change_percentage_24h} pill />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function TrendingCard() {
  const t = useT();
  const { data } = useTrending();
  return (
    <div className="card">
      <div className="card-title"><span className="row"><IconFlame size={15} />{t('market.trending')}</span></div>
      <div className="mini-list">
        {!data && Array.from({ length: 5 }, (_, i) => <div key={i} style={{ padding: '8px 0' }}><Skeleton h={22} /></div>)}
        {data?.slice(0, 5).map((c) => (
          <Link key={c.id} to={`/coin/${c.id}`} className="mini-row">
            <CoinImg src={c.thumb} alt={c.name} size={22} />
            <div className="grow ellipsis"><span className="nm">{c.symbol.toUpperCase()}</span> <span className="faint small">{c.name}</span></div>
            {c.market_cap_rank && <span className="rank-tag">#{c.market_cap_rank}</span>}
            <Pct v={c.price_change_24h} pill />
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Dollar-pegged coins add nothing to a heatmap */
const isStable = (c: MarketCoin) =>
  c.current_price > 0.97 && c.current_price < 1.03 && Math.abs(c.price_change_percentage_7d_in_currency ?? 0) < 1.5;

function heatColor(ch: number) {
  const a = Math.min(1, Math.abs(ch) / 8);
  const base = ch >= 0 ? '22, 163, 106' : '220, 50, 62';
  return `rgba(${base}, ${0.35 + a * 0.65})`;
}

function Heatmap({ coins, pairs }: { coins: MarketCoin[]; pairs: Record<string, string> }) {
  const t = useT();
  const ticks = useLive((s) => s.ticks);
  return (
    <div className="card">
      <div className="card-title"><span>{t('market.heatmap')}</span><span className="faint xs" style={{ fontWeight: 400 }}>{t('market.heatmapHint')}</span></div>
      <div className="heatmap">
        {coins.filter((c) => !isStable(c)).slice(0, 50).map((c, i) => {
          const ch = (pairs[c.id] ? ticks[pairs[c.id]]?.change24h : undefined) ?? c.price_change_percentage_24h ?? 0;
          return (
            <Link key={c.id} to={`/coin/${c.id}`} className={`heat ${i < 2 ? 'big' : ''}`} style={{ background: heatColor(ch) }} title={c.name}>
              <span className="s">{c.symbol}</span>
              <span className="c">{ch >= 0 ? '+' : ''}{ch.toFixed(2)}%</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function MarketPage() {
  const t = useT();
  const { data: coins, isLoading, isError, refetch } = useMarkets();
  const pairs = usePairMap();
  const watchlist = useUser((s) => s.watchlist);
  const [filter, setFilter] = useState<'all' | 'watch' | 'buy' | 'sell'>('all');

  const { gainers, losers } = useMemo(() => {
    const liquid = (coins ?? []).filter((c) => c.total_volume > 5_000_000 && c.price_change_percentage_24h !== null);
    const sorted = [...liquid].sort((a, b) => b.price_change_percentage_24h! - a.price_change_percentage_24h!);
    return { gainers: sorted.slice(0, 5), losers: sorted.slice(-5).reverse() };
  }, [coins]);

  const tableCoins = useMemo(
    () => (filter === 'watch' ? (coins ?? []).filter((c) => watchlist.includes(c.id)) : coins ?? []),
    [coins, filter, watchlist],
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('market.title')}</h1>
          <p className="page-sub">{t('market.subtitle')}</p>
        </div>
      </div>

      <StatsStrip />

      <div className="hero">
        <FearGreedCard />
        <MoverCard title={t('market.gainers')} icon={<IconTrendUp size={15} className="up" />} coins={gainers} pairs={pairs} />
        <MoverCard title={t('market.losers')} icon={<IconTrendDown size={15} className="down" />} coins={losers} pairs={pairs} />
        <TrendingCard />
      </div>

      <div className="section">
        {coins ? <Heatmap coins={coins} pairs={pairs} /> : <Skeleton h={260} r={16} />}
      </div>

      <div className="section">
        <div className="section-head">
          <h2 className="section-title">{t('market.allCoins')}</h2>
        </div>
        {isError ? (
          <div className="card"><ErrorBox onRetry={() => refetch()} /></div>
        ) : (
          <CoinTable
            coins={tableCoins}
            loading={isLoading}
            filter={filter === 'watch' ? 'all' : filter}
            toolbarLeft={
              <div className="chips">
                {(['all', 'watch', 'buy', 'sell'] as const).map((f) => (
                  <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                    {t(`market.filter.${f}`)}
                  </button>
                ))}
              </div>
            }
          />
        )}
      </div>
    </>
  );
}

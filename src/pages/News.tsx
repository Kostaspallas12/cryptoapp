import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconSearch } from '../components/Icons';
import { NewsList } from '../components/NewsList';
import { CoinImg, ErrorBox, Pct, Skeleton } from '../components/ui';
import { useMarkets, usePairMap } from '../hooks/data';
import { useNews } from '../hooks/useNews';
import { useT } from '../i18n';
import { fmtAgo } from '../lib/format';
import { useLive } from '../store/live';
import { useUser } from '../store/user';

const PAGE = 30;

export function NewsPage() {
  const t = useT();
  const { items, isLoading, isError, refetch, updatedAt, sources } = useNews();
  const watchlist = useUser((s) => s.watchlist);
  const txs = useUser((s) => s.transactions);
  const [q, setQ] = useState('');
  const [source, setSource] = useState('');
  const [mine, setMine] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const myCoins = useMemo(() => new Set([...watchlist, ...txs.map((x) => x.coinId)]), [watchlist, txs]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter(
      (a) =>
        (!source || a.source === source) &&
        (!mine || a.coins.some((c) => myCoins.has(c))) &&
        (!s || a.title.toLowerCase().includes(s) || a.summary.toLowerCase().includes(s)),
    );
  }, [items, q, source, mine, myCoins]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('news.title')}</h1>
          <p className="page-sub">{t('news.subtitle')}</p>
        </div>
        {updatedAt && <span className="faint small">{t('news.updated', { time: fmtAgo(updatedAt) })}</span>}
      </div>

      <div className="news-layout">
        <div className="card">
          <div className="row-wrap" style={{ marginBottom: 10, gap: 10 }}>
            <div className="input-wrap grow" style={{ minWidth: 200 }}>
              <span className="prefix"><IconSearch size={14} /></span>
              <input className="input" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder={t('news.search')} />
            </div>
            <button className={`chip ${mine ? 'active' : ''}`} onClick={() => { setMine((m) => !m); setLimit(PAGE); }}>
              ⭐ {t('news.myCoins')}
            </button>
          </div>
          <div className="chips" style={{ marginBottom: 6 }}>
            <button className={`chip ${!source ? 'active' : ''}`} onClick={() => setSource('')}>{t('news.allSources')}</button>
            {sources.map((s) => (
              <button key={s} className={`chip ${source === s ? 'active' : ''}`} onClick={() => { setSource(s); setLimit(PAGE); }}>{s}</button>
            ))}
          </div>
          <p className="faint xs" style={{ marginBottom: 4 }}>{t('news.english')}</p>

          {isError && !items.length ? (
            <ErrorBox onRetry={() => refetch()} />
          ) : isLoading ? (
            <div className="stack" style={{ gap: 14, marginTop: 10 }}>{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} h={86} />)}</div>
          ) : filtered.length === 0 ? (
            <div className="empty" style={{ padding: 30 }}>{t('news.empty')}</div>
          ) : (
            <>
              <NewsList items={filtered.slice(0, limit)} />
              {filtered.length > limit && (
                <div style={{ textAlign: 'center', marginTop: 10 }}>
                  <button className="btn" onClick={() => setLimit((l) => l + PAGE)}>{t('news.more')} ({filtered.length - limit})</button>
                </div>
              )}
            </>
          )}
        </div>

        <aside className="stack" style={{ gap: 16 }}>
          <TrendingInNews items={items} />
        </aside>
      </div>
    </>
  );
}

/** Coins mentioned most in the last 24h of headlines */
function TrendingInNews({ items }: { items: ReturnType<typeof useNews>['items'] }) {
  const t = useT();
  const { data: coins } = useMarkets();
  const pairs = usePairMap();
  const ticks = useLive((s) => s.ticks);
  const top = useMemo(() => {
    const since = Date.now() - 86400_000;
    const count = new Map<string, number>();
    items.filter((a) => Date.parse(a.published) > since).forEach((a) => a.coins.forEach((c) => count.set(c, (count.get(c) ?? 0) + 1)));
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [items]);
  return (
    <div className="card">
      <div className="card-title"><span>🔥 {t('news.trending')}</span></div>
      {top.length === 0 && <Skeleton h={160} />}
      <div className="mini-list">
        {top.map(([id, n]) => {
          const c = coins?.find((x) => x.id === id);
          if (!c) return null;
          const tk = pairs[id] ? ticks[pairs[id]] : undefined;
          return (
            <Link key={id} to={`/coin/${id}`} className="mini-row">
              <CoinImg src={c.image} alt={c.name} size={22} />
              <div className="grow ellipsis">
                <span className="nm">{c.symbol.toUpperCase()}</span> <span className="faint small">{t('news.mentions', { n })}</span>
              </div>
              <Pct v={tk?.change24h ?? c.price_change_percentage_24h} pill />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMarkets } from '../hooks/data';
import type { TaggedArticle } from '../hooks/useNews';
import { fmtAgo } from '../lib/format';
import { IconExternal } from './Icons';

function useCoinLookup() {
  const { data } = useMarkets();
  return useMemo(() => new Map((data ?? []).map((c) => [c.id, c])), [data]);
}

function Thumb({ src }: { src: string | null }) {
  const [err, setErr] = useState(false);
  if (!src || err) return <div className="news-thumb news-thumb-empty">📰</div>;
  return <img className="news-thumb" src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setErr(true)} />;
}

export function NewsItem({ a, compact = false, hideCoin }: { a: TaggedArticle; compact?: boolean; hideCoin?: string }) {
  const coins = useCoinLookup();
  const tags = a.coins.filter((id) => id !== hideCoin).slice(0, compact ? 3 : 5);
  return (
    <article className={`news-item ${compact ? 'compact' : ''}`}>
      <a href={a.link} target="_blank" rel="noopener noreferrer" className="news-thumb-link" tabIndex={-1}>
        <Thumb src={a.image} />
      </a>
      <div className="news-body">
        <a href={a.link} target="_blank" rel="noopener noreferrer" className="news-title">
          {a.title}
          <IconExternal size={12} className="news-ext" />
        </a>
        <div className="news-meta">
          <b>{a.source}</b> · <time dateTime={a.published} title={new Date(a.published).toLocaleString()}>{fmtAgo(a.published)}</time>
        </div>
        {!compact && a.summary && <p className="news-summary">{a.summary}</p>}
        {tags.length > 0 && (
          <div className="news-coins">
            {tags.map((id) => {
              const c = coins.get(id);
              return (
                <Link key={id} to={`/coin/${id}`} className="news-coin">
                  {c?.image && <img src={c.image} alt="" width={14} height={14} />}
                  {(c?.symbol ?? id).toUpperCase()}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
}

export function NewsList({ items, compact, hideCoin }: { items: TaggedArticle[]; compact?: boolean; hideCoin?: string }) {
  return (
    <div className="news-list">
      {items.map((a) => (
        // link is unique after de-duplication; ids from older feeds could collide
        <NewsItem key={a.link} a={a} compact={compact} hideCoin={hideCoin} />
      ))}
    </div>
  );
}

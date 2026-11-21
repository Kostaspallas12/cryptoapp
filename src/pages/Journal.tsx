import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconBook, IconTrash } from '../components/Icons';
import { OutcomeBadge } from '../components/NotesCard';
import { CoinImg, Pct, Seg } from '../components/ui';
import { usePairMap } from '../hooks/data';
import { useCoinsByIds } from '../hooks/useCoinsByIds';
import { useT } from '../i18n';
import { fmtDate, fmtNumber, fmtPrice, fmtTime } from '../lib/format';
import { noteOutcome, SENTIMENT_ICON } from '../lib/journal';
import { useLive } from '../store/live';
import { useUser, type Note, type Transaction } from '../store/user';

type Entry = { kind: 'note'; at: string; item: Note } | { kind: 'trade'; at: string; item: Transaction };

export function JournalPage() {
  const t = useT();
  const notes = useUser((s) => s.notes);
  const txs = useUser((s) => s.transactions);
  const removeNote = useUser((s) => s.removeNote);
  const removeTx = useUser((s) => s.removeTransaction);
  const [filter, setFilter] = useState<'all' | 'notes' | 'trades'>('all');
  const [coin, setCoin] = useState('');

  const ids = useMemo(() => [...new Set([...notes.map((n) => n.coinId), ...txs.map((x) => x.coinId)])], [notes, txs]);
  const { coins } = useCoinsByIds(ids);
  const pairs = usePairMap();
  const ticks = useLive((s) => s.ticks);
  const priceOf = (id: string) => (pairs[id] ? ticks[pairs[id]]?.price : undefined) ?? coins.find((c) => c.id === id)?.current_price ?? null;

  const coinOptions = useMemo(() => {
    const map = new Map<string, string>();
    [...notes, ...txs].forEach((x) => map.set(x.coinId, x.name));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [notes, txs]);

  const entries = useMemo(() => {
    const list: Entry[] = [
      ...(filter !== 'trades' ? notes.map((n) => ({ kind: 'note' as const, at: n.createdAt, item: n })) : []),
      ...(filter !== 'notes' ? txs.map((x) => ({ kind: 'trade' as const, at: x.date, item: x })) : []),
    ];
    return list.filter((e) => !coin || e.item.coinId === coin).sort((a, b) => b.at.localeCompare(a.at));
  }, [notes, txs, filter, coin]);

  // Accuracy of directional notes (live)
  const judged = notes.map((n) => noteOutcome(n, priceOf(n.coinId)).right).filter((r): r is boolean => r !== null);
  const accuracy = judged.length ? Math.round((judged.filter(Boolean).length / judged.length) * 100) : null;

  // Group by calendar day
  const groups: { day: string; items: Entry[] }[] = [];
  for (const e of entries) {
    const day = fmtDate(e.at);
    if (groups[groups.length - 1]?.day !== day) groups.push({ day, items: [] });
    groups[groups.length - 1].items.push(e);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('journal.title')}</h1>
          <p className="page-sub">{t('journal.subtitle')}</p>
        </div>
      </div>

      {notes.length + txs.length === 0 ? (
        <div className="card empty">
          <div className="ico"><IconBook size={24} /></div>
          <h3>{t('journal.empty')}</h3>
          <p>{t('journal.emptyHint')}</p>
          <Link to="/" className="btn btn-primary">{t('watch.browse')}</Link>
        </div>
      ) : (
        <>
          <div className="grid g-3" style={{ marginBottom: 16 }}>
            <div className="card">
              <div className="stat-label">{t('journal.entries')}</div>
              <div className="stat-value">{notes.length + txs.length}</div>
              <div className="stat-sub faint">{notes.length} {t('journal.notes').toLowerCase()} · {txs.length} {t('journal.trades').toLowerCase()}</div>
            </div>
            <div className="card" style={{ gridColumn: 'span 2' }}>
              <div className="stat-label">{t('journal.accuracy')}</div>
              <div className={`stat-value ${accuracy === null ? '' : accuracy >= 50 ? 'up' : 'down'}`}>
                {accuracy === null ? '—' : `${accuracy}%`}
                {judged.length > 0 && <span className="faint small" style={{ fontFamily: 'var(--font)', fontWeight: 500 }}> · {judged.filter(Boolean).length}/{judged.length}</span>}
              </div>
              <div className="stat-sub faint">{t('journal.accuracyHint')}</div>
            </div>
          </div>

          <div className="row between" style={{ flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
            <Seg
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: t('journal.all') },
                { value: 'notes', label: `📝 ${t('journal.notes')}` },
                { value: 'trades', label: `⇄ ${t('journal.trades')}` },
              ]}
            />
            <select className="select" style={{ width: 'auto', minWidth: 180 }} value={coin} onChange={(e) => setCoin(e.target.value)}>
              <option value="">{t('journal.allCoins')}</option>
              {coinOptions.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>

          <div className="timeline">
            {groups.map((g) => (
              <div key={g.day} className="stack" style={{ gap: 10 }}>
                <div className="tl-day">{g.day}</div>
                {g.items.map((e) =>
                  e.kind === 'note' ? (
                    <NoteItem key={e.item.id} n={e.item} price={priceOf(e.item.coinId)} onDelete={() => removeNote(e.item.id)} />
                  ) : (
                    <TradeItem key={e.item.id} x={e.item} price={priceOf(e.item.coinId)} onDelete={() => confirm(`${t('common.delete')}?`) && removeTx(e.item.id)} />
                  ),
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function CoinLink({ id, name, symbol, image }: { id: string; name: string; symbol: string; image: string }) {
  return (
    <Link to={`/coin/${id}`} className="row bold">
      <CoinImg src={image} alt={name} size={18} /> {name} <span className="faint xs" style={{ textTransform: 'uppercase' }}>{symbol}</span>
    </Link>
  );
}

function NoteItem({ n, price, onDelete }: { n: Note; price: number | null; onDelete: () => void }) {
  const t = useT();
  const o = noteOutcome(n, price);
  return (
    <div className="tl-item">
      <div className={`tl-ico ${n.sentiment}`}>{SENTIMENT_ICON[n.sentiment]}</div>
      <div className="tl-body">
        <div className="tl-head">
          <CoinLink id={n.coinId} name={n.name} symbol={n.symbol} image={n.image} />
          <span className="faint xs">📝 {t(`notes.${n.sentiment}`)} · {fmtTime(new Date(n.createdAt))}</span>
          <button className="star" style={{ marginLeft: 'auto', width: 24, height: 24 }} onClick={onDelete} aria-label={t('common.delete')}>
            <IconTrash size={13} />
          </button>
        </div>
        <p className="note-text">{n.text}</p>
        <div className="row-wrap xs muted">
          <span>{t('notes.at')}: <b className="num">{fmtPrice(n.price)}</b></span>
          <span>· {t('notes.since')}: <Pct v={o.change} /></span>
          <OutcomeBadge right={o.right} />
        </div>
      </div>
    </div>
  );
}

function TradeItem({ x, price, onDelete }: { x: Transaction; price: number | null; onDelete: () => void }) {
  const t = useT();
  const change = price && x.price ? ((price - x.price) / x.price) * 100 : null;
  return (
    <div className="tl-item">
      <div className={`tl-ico ${x.type}`}>{x.type === 'buy' ? '▲' : '▼'}</div>
      <div className="tl-body">
        <div className="tl-head">
          <CoinLink id={x.coinId} name={x.name} symbol={x.symbol} image={x.image} />
          <span className={`badge ${x.type === 'buy' ? 'buy' : 'sell'}`}>{t(x.type === 'buy' ? 'pf.buy' : 'pf.sell')}</span>
          <span className="faint xs">{fmtTime(new Date(x.date))}</span>
          <button className="star" style={{ marginLeft: 'auto', width: 24, height: 24 }} onClick={onDelete} aria-label={t('common.delete')}>
            <IconTrash size={13} />
          </button>
        </div>
        <div className="row-wrap small" style={{ marginTop: 6 }}>
          <span className="num bold">{fmtNumber(x.amount, 8)} {x.symbol.toUpperCase()}</span>
          <span className="muted">× {fmtPrice(x.price)} = <b className="num">{fmtPrice(x.amount * x.price)}</b></span>
          <span className="xs muted">· {t('notes.since')}: <Pct v={change} /></span>
        </div>
        {x.note && <p className="note-text muted small">{x.note}</p>}
      </div>
    </div>
  );
}

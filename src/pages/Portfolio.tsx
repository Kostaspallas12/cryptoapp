import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TxModal } from '../components/Forms';
import { IconCloud, IconPlus, IconTrash, IconWallet } from '../components/Icons';
import { CoinImg, Pct } from '../components/ui';
import { usePairMap } from '../hooks/data';
import { useCoinsByIds } from '../hooks/useCoinsByIds';
import { useT } from '../i18n';
import { useAuth } from '../lib/firebase';
import { fmtDate, fmtNumber, fmtPrice } from '../lib/format';
import { computeHoldings } from '../lib/portfolio';
import { useLive } from '../store/live';
import { useUser } from '../store/user';

const PALETTE = ['#7c8cff', '#16c784', '#f5a524', '#e45bd8', '#38bdf8', '#f97316', '#a3e635', '#f43f5e', '#14b8a6', '#94a3b8'];

function Donut({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((a, b) => a + b.value, 0) || 1;
  const r = 60;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" style={{ flexShrink: 0 }}>
      <g transform="rotate(-90 80 80)">
        <circle cx="80" cy="80" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="20" />
        {parts.map((p) => {
          const len = (p.value / total) * c;
          const el = <circle key={p.label} cx="80" cy="80" r={r} fill="none" stroke={p.color} strokeWidth="20" strokeDasharray={`${Math.max(0, len - 1.5)} ${c}`} strokeDashoffset={-offset} />;
          offset += len;
          return el;
        })}
      </g>
    </svg>
  );
}

export function PortfolioPage() {
  const t = useT();
  const nav = useNavigate();
  const user = useAuth((s) => s.user);
  const sync = useAuth((s) => s.sync);
  const txs = useUser((s) => s.transactions);
  const removeTx = useUser((s) => s.removeTransaction);
  const [modal, setModal] = useState(false);
  const holdings = useMemo(() => computeHoldings(txs), [txs]);
  const ids = useMemo(() => holdings.map((h) => h.coinId), [holdings]);
  const { coins } = useCoinsByIds(ids);
  const pairs = usePairMap();
  const ticks = useLive((s) => s.ticks);

  const rows = useMemo(() => {
    return holdings
      .filter((h) => h.amount > 1e-12)
      .map((h) => {
        const m = coins.find((c) => c.id === h.coinId);
        const tk = pairs[h.coinId] ? ticks[pairs[h.coinId]] : undefined;
        const price = tk?.price ?? m?.current_price ?? null;
        const ch = tk?.change24h ?? m?.price_change_percentage_24h ?? null;
        const value = price !== null ? price * h.amount : null;
        return { ...h, image: m?.image ?? h.image, price, ch, value, pnl: value !== null ? value - h.cost : null };
      })
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  }, [holdings, coins, pairs, ticks]);

  const totals = useMemo(() => {
    const value = rows.reduce((a, r) => a + (r.value ?? 0), 0);
    const cost = rows.reduce((a, r) => a + r.cost, 0);
    const realized = holdings.reduce((a, h) => a + h.realized, 0);
    const prev = rows.reduce((a, r) => a + (r.value !== null && r.ch !== null ? r.value / (1 + r.ch / 100) : 0), 0);
    return { value, cost, unrealized: value - cost, realized, change24h: value - prev, change24hPct: prev ? ((value - prev) / prev) * 100 : null };
  }, [rows, holdings]);

  const parts = useMemo(() => {
    const top = rows.slice(0, 7).map((r, i) => ({ label: r.symbol.toUpperCase(), value: r.value ?? 0, color: PALETTE[i] }));
    const rest = rows.slice(7).reduce((a, r) => a + (r.value ?? 0), 0);
    if (rest > 0) top.push({ label: 'Other', value: rest, color: PALETTE[9] });
    return top;
  }, [rows]);

  const signed = (v: number) => `${v >= 0 ? '+' : '−'}${fmtPrice(Math.abs(v))}`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('pf.title')}</h1>
          <p className="page-sub">{t('pf.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>
          <IconPlus size={15} /> {t('pf.addTx')}
        </button>
      </div>

      {(!user || sync === 'error') && (
        <div className="notice" style={{ marginBottom: 16 }}>
          <IconCloud size={16} /> {user ? t('common.syncFailed') : t('common.localOnly')}
        </div>
      )}

      {txs.length === 0 ? (
        <div className="card empty">
          <div className="ico"><IconWallet size={24} /></div>
          <h3>{t('pf.empty')}</h3>
          <p>{t('pf.emptyHint')}</p>
          <button className="btn btn-primary" onClick={() => setModal(true)}><IconPlus size={15} /> {t('pf.addTx')}</button>
        </div>
      ) : (
        <>
          <div className="grid g-4">
            <div className="card">
              <div className="stat-label">{t('pf.value')}</div>
              <div className="stat-value" style={{ fontSize: 24 }}>{fmtPrice(totals.value)}</div>
            </div>
            <div className="card">
              <div className="stat-label">{t('pf.pnl24h')}</div>
              <div className={`stat-value ${totals.change24h >= 0 ? 'up' : 'down'}`}>{signed(totals.change24h)}</div>
              <div className="stat-sub"><Pct v={totals.change24hPct} /></div>
            </div>
            <div className="card">
              <div className="stat-label">{t('pf.pnl')}</div>
              <div className={`stat-value ${totals.unrealized + totals.realized >= 0 ? 'up' : 'down'}`}>{signed(totals.unrealized + totals.realized)}</div>
              <div className="stat-sub"><Pct v={totals.cost ? (totals.unrealized / totals.cost) * 100 : null} /></div>
            </div>
            <div className="card">
              <div className="stat-label">{t('pf.invested')}</div>
              <div className="stat-value">{fmtPrice(totals.cost)}</div>
            </div>
          </div>

          <div className="coin-layout">
            <div className="card card-flush">
              <div className="toolbar"><h2 className="section-title">{t('pf.holdings')}</h2></div>
              <div className="table-wrap">
                <table className="table" style={{ minWidth: 760 }}>
                  <thead>
                    <tr>
                      <th className="left">{t('common.coin')}</th>
                      <th>{t('common.price')}</th>
                      <th>24h</th>
                      <th>{t('pf.holding')}</th>
                      <th>{t('pf.avgBuy')}</th>
                      <th>{t('pf.pnl')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.coinId} onClick={() => nav(`/coin/${r.coinId}`)}>
                        <td className="left">
                          <div className="coin-cell" style={{ minWidth: 160 }}>
                            <CoinImg src={r.image} alt={r.name} />
                            <div className="stack" style={{ gap: 0 }}><span className="name">{r.name}</span><span className="sym">{r.symbol}</span></div>
                          </div>
                        </td>
                        <td className="num">{fmtPrice(r.price)}</td>
                        <td><Pct v={r.ch} /></td>
                        <td>
                          <div className="num bold">{fmtPrice(r.value)}</div>
                          <div className="num faint xs">{fmtNumber(r.amount, 6)} {r.symbol.toUpperCase()}</div>
                        </td>
                        <td className="num muted">{fmtPrice(r.avgPrice)}</td>
                        <td>
                          <div className={`num bold ${r.pnl !== null && r.pnl >= 0 ? 'up' : 'down'}`}>{r.pnl !== null ? signed(r.pnl) : '—'}</div>
                          <div className="xs"><Pct v={r.cost && r.pnl !== null ? (r.pnl / r.cost) * 100 : null} /></div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="card-title">{t('pf.allocation')}</div>
              {parts.length > 0 && (
                <div className="stack" style={{ alignItems: 'center', gap: 16 }}>
                  <Donut parts={parts} />
                  <div className="donut-legend" style={{ width: '100%' }}>
                    {parts.map((p) => (
                      <div key={p.label}>
                        <span className="swatch" style={{ background: p.color }} />
                        <span className="grow bold">{p.label}</span>
                        <span className="num muted">{((p.value / (totals.value || 1)) * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card card-flush section">
            <div className="toolbar"><h2 className="section-title">{t('pf.transactions')}</h2></div>
            <div className="table-wrap">
              <table className="table" style={{ minWidth: 720 }}>
                <thead>
                  <tr>
                    <th className="left">{t('common.date')}</th>
                    <th className="left">{t('common.coin')}</th>
                    <th className="left" />
                    <th>{t('common.amount')}</th>
                    <th>{t('common.price')}</th>
                    <th>{t('common.total')}</th>
                    <th className="left">{t('common.note')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {[...txs].sort((a, b) => b.date.localeCompare(a.date)).map((tx) => (
                    <tr key={tx.id} style={{ cursor: 'default' }}>
                      <td className="left muted">{fmtDate(tx.date, true)}</td>
                      <td className="left"><div className="row"><CoinImg src={tx.image} alt={tx.name} size={20} /><b>{tx.symbol.toUpperCase()}</b></div></td>
                      <td className="left"><span className={`badge ${tx.type === 'buy' ? 'buy' : 'sell'}`}>{t(tx.type === 'buy' ? 'pf.buy' : 'pf.sell')}</span></td>
                      <td className="num">{fmtNumber(tx.amount, 8)}</td>
                      <td className="num">{fmtPrice(tx.price)}</td>
                      <td className="num bold">{fmtPrice(tx.amount * tx.price)}</td>
                      <td className="left muted ellipsis" style={{ maxWidth: 220 }} title={tx.note}>{tx.note ?? ''}</td>
                      <td>
                        <button className="star" onClick={() => confirm(`${t('common.delete')}?`) && removeTx(tx.id)} aria-label={t('common.delete')}>
                          <IconTrash size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {modal && <TxModal onClose={() => setModal(false)} />}
    </>
  );
}

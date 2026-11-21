import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertModal } from '../components/Forms';
import { IconBell, IconPlus, IconRefresh, IconTrash } from '../components/Icons';
import { CoinImg, Pct, Seg } from '../components/ui';
import { usePairMap } from '../hooks/data';
import { useCoinsByIds } from '../hooks/useCoinsByIds';
import { useT } from '../i18n';
import { fmtDate, fmtPrice } from '../lib/format';
import { useLive } from '../store/live';
import { useUser } from '../store/user';

function NotifStatus() {
  const t = useT();
  const [perm, setPerm] = useState(() => ('Notification' in window ? Notification.permission : 'denied'));
  if (!('Notification' in window)) return null;
  if (perm === 'granted') return <span className="badge buy">{t('al.notifOn')}</span>;
  if (perm === 'denied') return <span className="badge neutral">{t('al.notifBlocked')}</span>;
  return (
    <button className="btn" onClick={() => Notification.requestPermission().then(setPerm)}>
      <IconBell size={15} /> {t('al.enableNotif')}
    </button>
  );
}

export function AlertsPage() {
  const t = useT();
  const alerts = useUser((s) => s.alerts);
  const remove = useUser((s) => s.removeAlert);
  const reset = useUser((s) => s.resetAlert);
  const [tab, setTab] = useState<'active' | 'triggered'>('active');
  const [modal, setModal] = useState(false);
  const ids = useMemo(() => [...new Set(alerts.map((a) => a.coinId))], [alerts]);
  const { coins } = useCoinsByIds(ids);
  const pairs = usePairMap();
  const ticks = useLive((s) => s.ticks);

  const list = alerts
    .filter((a) => (tab === 'active' ? !a.triggered : a.triggered))
    .sort((a, b) => (b.triggeredAt ?? b.createdAt).localeCompare(a.triggeredAt ?? a.createdAt));
  const activeCount = alerts.filter((a) => !a.triggered).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('al.title')}</h1>
          <p className="page-sub">{t('al.subtitle')}</p>
        </div>
        <div className="row-wrap">
          <NotifStatus />
          <button className="btn btn-primary" onClick={() => setModal(true)}><IconPlus size={15} /> {t('al.new')}</button>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <Seg
          value={tab}
          onChange={setTab}
          options={[
            { value: 'active', label: `${t('al.active')} (${activeCount})` },
            { value: 'triggered', label: `${t('al.triggered')} (${alerts.length - activeCount})` },
          ]}
        />
      </div>

      {list.length === 0 ? (
        <div className="card empty">
          <div className="ico"><IconBell size={24} /></div>
          <h3>{t('al.empty')}</h3>
          <p>{t('al.emptyHint')}</p>
          <button className="btn btn-primary" onClick={() => setModal(true)}><IconPlus size={15} /> {t('al.new')}</button>
        </div>
      ) : (
        <div className="card card-flush">
          <div className="table-wrap">
            <table className="table" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th className="left">{t('common.coin')}</th>
                  <th className="left">{t('al.when')}</th>
                  <th>{t('al.target')}</th>
                  <th>{t('al.current')}</th>
                  <th>{t('al.distance')}</th>
                  <th className="left">{t('common.date')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((a) => {
                  const m = coins.find((c) => c.id === a.coinId);
                  const price = (pairs[a.coinId] && ticks[pairs[a.coinId]]?.price) || m?.current_price || null;
                  const dist = price ? ((a.target - price) / price) * 100 : null;
                  return (
                    <tr key={a.id} style={{ cursor: 'default' }}>
                      <td className="left">
                        <Link to={`/coin/${a.coinId}`} className="coin-cell" style={{ minWidth: 160 }}>
                          <CoinImg src={a.image} alt={a.name} />
                          <div className="stack" style={{ gap: 0 }}>
                            <span className="name">{a.name}</span>
                            <span className="sym">{a.note ?? a.symbol}</span>
                          </div>
                        </Link>
                      </td>
                      <td className="left">
                        <span className={`badge ${a.direction === 'above' ? 'buy' : 'sell'}`}>{a.direction === 'above' ? '↑' : '↓'} {t(a.direction === 'above' ? 'al.above' : 'al.below')}</span>
                      </td>
                      <td className="num bold">{fmtPrice(a.target)}</td>
                      <td className="num">{a.triggered ? fmtPrice(a.triggeredPrice) : fmtPrice(price)}</td>
                      <td>{a.triggered ? <span className="badge buy">✓</span> : <Pct v={dist} />}</td>
                      <td className="left muted small">{fmtDate(a.triggeredAt ?? a.createdAt, true)}</td>
                      <td>
                        <div className="row" style={{ justifyContent: 'flex-end' }}>
                          {a.triggered && (
                            <button className="btn btn-sm" onClick={() => reset(a.id)}><IconRefresh size={13} /> {t('al.reset')}</button>
                          )}
                          <button className="star" onClick={() => remove(a.id)} aria-label={t('common.delete')}><IconTrash size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && <AlertModal onClose={() => setModal(false)} />}
    </>
  );
}

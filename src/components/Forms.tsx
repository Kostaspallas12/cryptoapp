import { useMemo, useState } from 'react';
import { useMarkets } from '../hooks/data';
import { useT } from '../i18n';
import { fmtNumber, fmtPct, fmtPrice } from '../lib/format';
import { holdingsFor } from '../lib/portfolio';
import { useUser, type CoinRef } from '../store/user';
import { CoinImg, Modal, Seg } from './ui';

export interface CoinChoice extends CoinRef {
  price: number;
}

function CoinSelect({ value, onChange }: { value: CoinChoice | null; onChange: (c: CoinChoice) => void }) {
  const t = useT();
  const { data: coins } = useMarkets();
  return (
    <div className="field">
      <label>{t('common.coin')}</label>
      <div className="row">
        {value && <CoinImg src={value.image} alt={value.name} size={28} />}
        <select
          className="select grow"
          value={value?.coinId ?? ''}
          onChange={(e) => {
            const c = coins?.find((x) => x.id === e.target.value);
            if (c) onChange({ coinId: c.id, symbol: c.symbol, name: c.name, image: c.image, price: c.current_price });
          }}
        >
          <option value="" disabled>{t('pf.selectCoin')}</option>
          {coins?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.symbol.toUpperCase()})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

const parseNum = (s: string) => parseFloat(s.replace(',', '.'));

export function TxModal({ coin: initial, onClose }: { coin?: CoinChoice; onClose: () => void }) {
  const t = useT();
  const add = useUser((s) => s.addTransaction);
  const txs = useUser((s) => s.transactions);
  const [coin, setCoin] = useState<CoinChoice | null>(initial ?? null);
  const [type, setType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState(initial ? String(+initial.price.toPrecision(6)) : '');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  const held = useMemo(() => (coin ? holdingsFor(txs, coin.coinId).amount : 0), [txs, coin]);
  const total = parseNum(amount) * parseNum(price);

  const submit = () => {
    const a = parseNum(amount);
    const p = parseNum(price);
    if (!coin || !(a > 0) || !(p >= 0)) return setErr(t('pf.invalid'));
    if (type === 'sell' && a > held + 1e-12) return setErr(t('pf.tooMuch', { amount: fmtNumber(held, 8) }));
    add({ coinId: coin.coinId, symbol: coin.symbol, name: coin.name, image: coin.image, type, amount: a, price: p, date: new Date(date).toISOString(), note: note.trim() || undefined });
    onClose();
  };

  return (
    <Modal
      title={t('pf.addTx')}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={submit}>{t('common.save')}</button>
        </>
      }
    >
      <Seg value={type} onChange={setType} options={[{ value: 'buy', label: t('pf.buy') }, { value: 'sell', label: t('pf.sell') }]} />
      {initial ? (
        <div className="row">
          <CoinImg src={initial.image} alt={initial.name} size={28} />
          <b>{initial.name}</b> <span className="faint" style={{ textTransform: 'uppercase' }}>{initial.symbol}</span>
        </div>
      ) : (
        <CoinSelect value={coin} onChange={(c) => { setCoin(c); setPrice(String(+c.price.toPrecision(6))); }} />
      )}
      <div className="grid g-2">
        <div className="field">
          <label>{t('common.amount')}</label>
          <input className="input mono" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoFocus />
          {type === 'sell' && coin && <span className="faint xs">{t('pf.holding')}: {fmtNumber(held, 8)}</span>}
        </div>
        <div className="field">
          <label>{t('pf.pricePer')}</label>
          <div className="input-wrap">
            <span className="prefix">$</span>
            <input className="input mono" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="field">
        <label>{t('common.date')}</label>
        <input className="input" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="field">
        <label>{t('common.note')} <span className="faint">({t('common.optional')})</span></label>
        <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </div>
      <div className="row between">
        <span className="muted">{t('common.total')}</span>
        <b className="num">{isFinite(total) ? fmtPrice(total) : '—'}</b>
      </div>
      {err && <div className="form-error">{err}</div>}
    </Modal>
  );
}

export function AlertModal({ coin: initial, onClose }: { coin?: CoinChoice; onClose: () => void }) {
  const t = useT();
  const add = useUser((s) => s.addAlert);
  const [coin, setCoin] = useState<CoinChoice | null>(initial ?? null);
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [target, setTarget] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const current = coin?.price ?? 0;
  const tv = parseNum(target);
  const dist = current && tv ? ((tv - current) / current) * 100 : null;

  const quick = (pct: number) => {
    if (!current) return;
    setDirection(pct >= 0 ? 'above' : 'below');
    setTarget(String(+(current * (1 + pct / 100)).toPrecision(6)));
  };

  const submit = () => {
    if (!coin || !(tv > 0)) return setErr(t('pf.invalid'));
    add({ coinId: coin.coinId, symbol: coin.symbol, name: coin.name, image: coin.image, direction, target: tv, priceAtCreation: current, note: note.trim() || undefined });
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    onClose();
  };

  return (
    <Modal
      title={t('al.new')}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={submit}>{t('common.save')}</button>
        </>
      }
    >
      {initial ? (
        <div className="row between">
          <div className="row">
            <CoinImg src={initial.image} alt={initial.name} size={28} />
            <b>{initial.name}</b>
          </div>
          <span className="muted small">{t('al.current')}: <b className="num">{fmtPrice(current)}</b></span>
        </div>
      ) : (
        <CoinSelect value={coin} onChange={setCoin} />
      )}
      <div className="field">
        <label>{t('al.when')}</label>
        <Seg value={direction} onChange={setDirection} options={[{ value: 'above', label: `↑ ${t('al.above')}` }, { value: 'below', label: `↓ ${t('al.below')}` }]} />
      </div>
      <div className="field">
        <label>{t('al.target')}</label>
        <div className="input-wrap">
          <span className="prefix">$</span>
          <input className="input mono" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} autoFocus />
        </div>
        <div className="row-wrap" style={{ marginTop: 4 }}>
          <span className="faint xs">{t('al.quick')}:</span>
          {[-10, -5, 5, 10, 20].map((p) => (
            <button key={p} className="chip" style={{ padding: '3px 9px', fontSize: 11.5 }} onClick={() => quick(p)}>
              {p > 0 ? '+' : ''}{p}%
            </button>
          ))}
        </div>
        {dist !== null && <span className={`xs ${dist >= 0 ? 'up' : 'down'}`}>{t('al.distance')}: {fmtPct(dist)}</span>}
      </div>
      <div className="field">
        <label>{t('common.note')} <span className="faint">({t('common.optional')})</span></label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
      </div>
      {err && <div className="form-error">{err}</div>}
    </Modal>
  );
}

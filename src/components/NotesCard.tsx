import { useMemo, useState } from 'react';
import { useT } from '../i18n';
import { fmtDate, fmtPrice } from '../lib/format';
import { noteOutcome, SENTIMENT_CLASS, SENTIMENT_ICON } from '../lib/journal';
import { useUser, type CoinRef, type Sentiment } from '../store/user';
import { IconTrash } from './Icons';
import { Pct, Seg } from './ui';

export function OutcomeBadge({ right }: { right: boolean | null }) {
  const t = useT();
  if (right === null) return null;
  return <span className={`badge ${right ? 'buy' : 'neutral'}`}>{right ? `✓ ${t('notes.right')}` : t('notes.wrong')}</span>;
}

export function NotesCard({ coin, price }: { coin: CoinRef; price: number | null }) {
  const t = useT();
  const all = useUser((s) => s.notes);
  const addNote = useUser((s) => s.addNote);
  const removeNote = useUser((s) => s.removeNote);
  const notes = useMemo(
    () => all.filter((n) => n.coinId === coin.coinId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [all, coin.coinId],
  );
  const [text, setText] = useState('');
  const [sentiment, setSentiment] = useState<Sentiment>('bullish');

  const save = () => {
    const v = text.trim();
    if (!v || price === null) return;
    addNote({ ...coin, text: v.slice(0, 1000), sentiment, price });
    setText('');
  };

  return (
    <div className="card">
      <div className="card-title"><span>📝 {t('notes.title')}</span></div>
      <p className="faint small" style={{ marginTop: -6, marginBottom: 10 }}>{t('notes.hint')}</p>
      <textarea
        className="textarea"
        value={text}
        maxLength={1000}
        placeholder={t('notes.placeholder')}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && save()}
      />
      <div className="row between" style={{ marginTop: 8, flexWrap: 'wrap', gap: 8 }}>
        <Seg<Sentiment>
          value={sentiment}
          onChange={setSentiment}
          options={[
            { value: 'bullish', label: <span className="up">▲ {t('notes.bullish')}</span> },
            { value: 'neutral', label: `● ${t('notes.neutral')}` },
            { value: 'bearish', label: <span className="down">▼ {t('notes.bearish')}</span> },
          ]}
        />
        <button className="btn btn-primary btn-sm" onClick={save} disabled={!text.trim() || price === null}>
          {t('notes.add')}
        </button>
      </div>

      {notes.length > 0 && <div className="divider" />}
      <div className="stack" style={{ gap: 12 }}>
        {notes.map((n) => {
          const o = noteOutcome(n, price);
          return (
            <div key={n.id} className="note">
              <div className="row between">
                <span className={`small bold ${SENTIMENT_CLASS[n.sentiment]}`}>
                  {SENTIMENT_ICON[n.sentiment]} {t(`notes.${n.sentiment}`)}
                </span>
                <span className="row">
                  <span className="faint xs">{fmtDate(n.createdAt, true)}</span>
                  <button className="star" style={{ width: 24, height: 24 }} onClick={() => removeNote(n.id)} aria-label={t('common.delete')}>
                    <IconTrash size={13} />
                  </button>
                </span>
              </div>
              <p className="note-text">{n.text}</p>
              <div className="row-wrap xs muted">
                <span>{t('notes.at')}: <b className="num">{fmtPrice(n.price)}</b></span>
                <span>· {t('notes.since')}: <Pct v={o.change} /></span>
                <OutcomeBadge right={o.right} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

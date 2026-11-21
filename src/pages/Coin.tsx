import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CandleChart, type Lower, type Overlay } from '../components/CandleChart';
import { AlertModal, TxModal, type CoinChoice } from '../components/Forms';
import { IconArrowLeft, IconBell, IconExternal, IconPlus, IconStar, IconTrash } from '../components/Icons';
import { CoinImg, Gauge, LivePrice, Pct, RATING_COLOR, RatingBadge, RiskBadge, Seg, Skeleton } from '../components/ui';
import { HttpError } from '../api/coingecko';
import { useBinanceSymbols, useCandles, useCoinDetail, useLivePrice, useMarkets, usePairMap } from '../hooks/data';
import { useT } from '../i18n';
import { fmtCompact, fmtDate, fmtNumber, fmtPct, fmtPrice } from '../lib/format';
import { holdingsFor } from '../lib/portfolio';
import { computeRating, type IndicatorVote, type Rating } from '../lib/rating';
import { useSettings } from '../store/settings';
import { useUser } from '../store/user';
import type { Interval } from '../types';

const INTERVALS: { value: Interval; label: string }[] = [
  { value: '15m', label: '15m' },
  { value: '1h', label: '1H' },
  { value: '4h', label: '4H' },
  { value: '1d', label: '1D' },
  { value: '1w', label: '1W' },
];

function VoteCell({ v }: { v: IndicatorVote['vote'] }) {
  return <RatingBadge rating={v === 1 ? 'buy' : v === -1 ? 'sell' : 'neutral'} />;
}

function IndicatorTable({ votes, showExplain }: { votes: IndicatorVote[]; showExplain: boolean }) {
  const t = useT();
  return (
    <table className="ind-table">
      <thead>
        <tr>
          <th>{t('coin.indicator')}</th>
          <th style={{ textAlign: 'right' }}>{t('coin.value')}</th>
          <th style={{ textAlign: 'right' }}>{t('coin.action')}</th>
        </tr>
      </thead>
      <tbody>
        {votes.map((v) => (
          <tr key={v.id}>
            <td>
              <div className="bold">{v.label}</div>
              {showExplain && <div className="explain">{t(`ind.${v.explain}`)}</div>}
            </td>
            <td className="num" style={{ textAlign: 'right' }}>
              {v.value === null ? '—' : v.id.startsWith('ema') || v.id.startsWith('sma') ? fmtPrice(v.value, false) : Math.abs(v.value) < 1 && v.value !== 0 ? v.value.toPrecision(3) : fmtNumber(v.value, 2)}
            </td>
            <td style={{ textAlign: 'right' }}><VoteCell v={v.vote} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RatingGauge({ title, score, rkey, counts }: { title: string; score: number; rkey: Rating['key']; counts?: { buy: number; neutral: number; sell: number } }) {
  const t = useT();
  return (
    <div className="gauge-wrap">
      <div className="gauge-title">{title}</div>
      <Gauge value={score} min={-1} max={1} size={170} color={RATING_COLOR[rkey]} label={t(`rating.${rkey}`)} />
      {counts && (
        <div className="gauge-counts">
          <span>{t('rating.sell')} <b className="down">{counts.sell}</b></span>
          <span>{t('rating.neutral')} <b>{counts.neutral}</b></span>
          <span>{t('rating.buy')} <b className="up">{counts.buy}</b></span>
        </div>
      )}
    </div>
  );
}

function TechnicalCard({ rating, interval, count }: { rating: Rating; interval: Interval; count: number }) {
  const t = useT();
  const [explain, setExplain] = useState(true);
  const count2 = (v: IndicatorVote[]) => ({
    buy: v.filter((x) => x.vote === 1).length,
    neutral: v.filter((x) => x.vote === 0).length,
    sell: v.filter((x) => x.vote === -1).length,
  });
  const p = rating.pivots;
  return (
    <div className="card">
      <div className="section-head" style={{ marginBottom: 6 }}>
        <h2 className="section-title">{t('coin.technical')}</h2>
        <label className="row small muted" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={explain} onChange={(e) => setExplain(e.target.checked)} /> {t('coin.whatItMeans')}
        </label>
      </div>
      <p className="faint small" style={{ marginBottom: 18 }}>{t('coin.technicalHint', { count, tf: interval.toUpperCase() })}</p>

      <div className="ta-summary">
        <RatingGauge title={t('coin.oscillators')} score={rating.oscillators.score} rkey={rating.oscillators.key} counts={count2(rating.oscillators.votes)} />
        <RatingGauge title={t('coin.summary')} score={rating.score} rkey={rating.key} counts={rating.counts} />
        <RatingGauge title={t('coin.movingAverages')} score={rating.movingAverages.score} rkey={rating.movingAverages.key} counts={count2(rating.movingAverages.votes)} />
      </div>

      <div className="verdict" style={{ marginTop: 18 }}>
        <span dangerouslySetInnerHTML={{ __html: t('coin.verdict', { rating: t(`rating.${rating.key}`), ...rating.counts }) }} />{' '}
        <span dangerouslySetInnerHTML={{ __html: t('coin.verdictTrend', { trend: t(`trend.${rating.trend}`), risk: t(`risk.${rating.risk}`) }) }} />
      </div>

      <div className="grid g-2" style={{ marginTop: 18, alignItems: 'start' }}>
        <div>
          <div className="card-title">{t('coin.oscillators')}</div>
          <IndicatorTable votes={rating.oscillators.votes} showExplain={explain} />
        </div>
        <div>
          <div className="card-title">{t('coin.movingAverages')}</div>
          <IndicatorTable votes={rating.movingAverages.votes} showExplain={explain} />
        </div>
      </div>

      {p && (
        <>
          <div className="divider" />
          <div className="card-title">{t('coin.pivots')}</div>
          <p className="faint small" style={{ marginTop: -6, marginBottom: 10 }}>{t('coin.pivotsHint')}</p>
          <div className="pivots">
            <div className="s"><div className="lbl">S2</div><div className="val">{fmtPrice(p.s2)}</div></div>
            <div className="s"><div className="lbl">S1</div><div className="val">{fmtPrice(p.s1)}</div></div>
            <div><div className="lbl">{t('coin.pivot')}</div><div className="val">{fmtPrice(p.p)}</div></div>
            <div className="r"><div className="lbl">R1</div><div className="val">{fmtPrice(p.r1)}</div></div>
            <div className="r"><div className="lbl">R2</div><div className="val">{fmtPrice(p.r2)}</div></div>
          </div>
        </>
      )}
      {rating.volatility !== null && (
        <div className="row between" style={{ marginTop: 14 }}>
          <span className="muted">{t('coin.volatility')} <span className="faint small">· {t('coin.volatilityHint')}</span></span>
          <span className="row"><b className="num">{fmtPct(rating.volatility, 2, false)}</b><RiskBadge risk={rating.risk} /></span>
        </div>
      )}
    </div>
  );
}

function PositionCard({ coinId, price }: { coinId: string; price: number | null }) {
  const t = useT();
  const txs = useUser((s) => s.transactions);
  const h = useMemo(() => holdingsFor(txs, coinId), [txs, coinId]);
  if (h.amount <= 1e-12) return null;
  const value = price !== null ? h.amount * price : null;
  const pnl = value !== null ? value - h.cost : null;
  return (
    <div className="card">
      <div className="card-title"><span>{t('coin.position')}</span><Link to="/portfolio">{t('nav.portfolio')} →</Link></div>
      <div className="stat-value">{fmtPrice(value)}</div>
      <div className="stat-sub"><span className={pnl !== null && pnl >= 0 ? 'up' : 'down'}>{pnl !== null ? `${pnl >= 0 ? '+' : '−'}${fmtPrice(Math.abs(pnl))}` : '—'}</span> <Pct v={h.cost ? (pnl! / h.cost) * 100 : null} /></div>
      <div className="divider" />
      <div className="kv"><span>{t('pf.holding')}</span><span>{fmtNumber(h.amount, 8)}</span></div>
      <div className="kv"><span>{t('pf.avgBuy')}</span><span>{fmtPrice(h.avgPrice)}</span></div>
    </div>
  );
}

function CoinAlerts({ coinId }: { coinId: string }) {
  const t = useT();
  const all = useUser((s) => s.alerts);
  const alerts = useMemo(() => all.filter((a) => a.coinId === coinId), [all, coinId]);
  const remove = useUser((s) => s.removeAlert);
  if (!alerts.length) return null;
  return (
    <div className="card">
      <div className="card-title"><span>{t('nav.alerts')}</span><Link to="/alerts">{t('common.viewAll')} →</Link></div>
      {alerts.map((a) => (
        <div key={a.id} className="kv" style={{ alignItems: 'center' }}>
          <span className={a.triggered ? 'faint' : ''}>{a.direction === 'above' ? '↑' : '↓'} {t(a.direction === 'above' ? 'al.above' : 'al.below')} {a.triggered && `· ${t('al.triggered')}`}</span>
          <span className="row">
            {fmtPrice(a.target)}
            <button className="star" onClick={() => remove(a.id)} aria-label={t('common.delete')}><IconTrash size={14} /></button>
          </span>
        </div>
      ))}
    </div>
  );
}

export function CoinPage() {
  const { id = '' } = useParams();
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const { data: markets, isSuccess: mkOk, isError: mkErr } = useMarkets();
  const pairs = usePairMap();
  const market = markets?.find((c) => c.id === id);
  const { data: detail, isLoading: detailLoading, error: detailError } = useCoinDetail(id);
  const notFound = detailError instanceof HttpError && detailError.status === 404;
  const pair = pairs[id];
  const [interval, setInterval_] = useState<Interval>('1d');
  const [overlays, setOverlays] = useState<Overlay[]>(['ema20', 'ema50']);
  const [lower, setLower] = useState<Lower>('rsi');
  const [modal, setModal] = useState<'alert' | 'tx' | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const watched = useUser((s) => s.watchlist.includes(id));
  const toggleWatch = useUser((s) => s.toggleWatch);

  // Wait for the pair map before choosing the candle source, so we don't fetch CoinGecko first.
  const { isSuccess: symOk, isError: symErr } = useBinanceSymbols();
  const pairsReady = (symOk && (mkOk || mkErr)) || symErr;
  const { data: candles, isLoading: candlesLoading } = useCandles(id, pair, interval, pairsReady);

  const md = detail?.market_data;
  const base = market ?? (md ? { current_price: md.current_price.usd, price_change_percentage_24h: md.price_change_percentage_24h } : undefined);
  const { price, change24h, live } = useLivePrice(base, pair);
  const rating = useMemo(() => (candles ? computeRating(candles, market?.market_cap_rank ?? detail?.market_cap_rank) : null), [candles, market, detail]);

  const name = market?.name ?? detail?.name ?? id;
  const symbol = market?.symbol ?? detail?.symbol ?? '';
  const image = market?.image ?? detail?.image.large ?? '';

  if (notFound && !market)
    return (
      <div className="empty">
        <h3>{t('coin.notFound')}</h3>
        <Link className="btn" to="/">{t('404.back')}</Link>
      </div>
    );

  const choice: CoinChoice = { coinId: id, symbol, name, image, price: price ?? 0 };
  const low24 = market?.low_24h ?? md?.low_24h.usd;
  const high24 = market?.high_24h ?? md?.high_24h.usd;
  const rangePos = price !== null && low24 && high24 && high24 > low24 ? Math.max(0, Math.min(100, ((price - low24) / (high24 - low24)) * 100)) : null;
  // CoinGecko descriptions contain HTML: render as plain text only.
  const about = (detail?.description?.[lang] || detail?.description?.en || '').replace(/<[^>]*>/g, '').trim();
  const toggleOverlay = (o: Overlay) => setOverlays((s) => (s.includes(o) ? s.filter((x) => x !== o) : [...s, o]));

  return (
    <>
      <Link to="/" className="row muted small" style={{ marginBottom: 16, width: 'fit-content' }}>
        <IconArrowLeft size={14} /> {t('nav.market')}
      </Link>

      <div className="row between" style={{ flexWrap: 'wrap', gap: 16 }}>
        <div className="coin-head">
          <CoinImg src={image} alt={name} size={48} />
          <div>
            <div className="row">
              <h1>{name}</h1>
              <span className="faint bold" style={{ textTransform: 'uppercase' }}>{symbol}</span>
              {(market?.market_cap_rank ?? detail?.market_cap_rank) && <span className="rank-tag">#{market?.market_cap_rank ?? detail?.market_cap_rank}</span>}
            </div>
            <div className="row" style={{ marginTop: 6, gap: 12 }}>
              <span className="coin-price"><LivePrice value={price} /></span>
              <Pct v={change24h} pill />
              {rating && <RatingBadge rating={rating.key} />}
            </div>
          </div>
        </div>
        <div className="row-wrap">
          <button className={`btn ${watched ? 'on' : ''}`} onClick={() => toggleWatch(id)}>
            <IconStar size={15} filled={watched} /> {watched ? t('coin.unwatch') : t('coin.watch')}
          </button>
          <button className="btn" onClick={() => setModal('alert')} disabled={price === null}>
            <IconBell size={15} /> {t('coin.createAlert')}
          </button>
          <button className="btn btn-primary" onClick={() => setModal('tx')} disabled={price === null}>
            <IconPlus size={15} /> {t('coin.addTx')}
          </button>
        </div>
      </div>

      {!pair && markets && Object.keys(pairs).length > 0 && (
        <div className="notice" style={{ marginTop: 14 }}>{t('common.notOnBinance')}</div>
      )}

      <div className="coin-layout">
        <div className="stack" style={{ gap: 16 }}>
          <div className="card card-flush">
            <div className="chart-toolbar">
              <Seg value={interval} onChange={setInterval_} options={INTERVALS} />
              <div className="row-wrap">
                <div className="chips">
                  {(['ema20', 'ema50', 'sma200', 'bb'] as Overlay[]).map((o) => (
                    <button key={o} className={`chip ${overlays.includes(o) ? 'active' : ''}`} style={{ padding: '4px 10px', fontSize: 11.5 }} onClick={() => toggleOverlay(o)}>
                      {o === 'bb' ? 'Bollinger' : o.toUpperCase()}
                    </button>
                  ))}
                </div>
                <Seg<Lower> value={lower} onChange={setLower} options={[{ value: 'rsi', label: 'RSI' }, { value: 'macd', label: 'MACD' }, { value: 'volume', label: '—' }]} />
              </div>
            </div>
            {candlesLoading || !candles ? (
              <div style={{ padding: 14 }}><Skeleton h={560} /></div>
            ) : (
              <CandleChart candles={candles} pair={pair} interval={interval} overlays={overlays} lower={lower} />
            )}
            {live && <div className="xs faint" style={{ padding: '8px 14px', borderTop: '1px solid var(--border)' }}><span className="dot live" style={{ display: 'inline-block', marginRight: 6 }} />Binance · {pair}</div>}
          </div>

          {rating && candles ? <TechnicalCard rating={rating} interval={interval} count={candles.length} /> : candlesLoading && <Skeleton h={300} r={16} />}

          {about && (
            <div className="card">
              <h2 className="section-title" style={{ marginBottom: 10 }}>{t('coin.about', { name })}</h2>
              <div className={`about ${aboutOpen ? '' : 'clamp'}`} style={{ whiteSpace: 'pre-line' }}>{about}</div>
              {about.length > 500 && (
                <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setAboutOpen((o) => !o)}>
                  {aboutOpen ? '−' : '+'} {t('market.showMore')}
                </button>
              )}
            </div>
          )}
        </div>

        <aside className="stack" style={{ gap: 16 }}>
          <PositionCard coinId={id} price={price} />

          <div className="card">
            <div className="card-title">{t('coin.range24h')}</div>
            <div className="range">{rangePos !== null && <i style={{ left: `${rangePos}%` }} />}</div>
            <div className="row between small num"><span className="down">{fmtPrice(low24)}</span><span className="up">{fmtPrice(high24)}</span></div>
          </div>

          <div className="card">
            <div className="card-title">{t('coin.change')}</div>
            <div className="perf">
              {[
                ['24h', md?.price_change_percentage_24h ?? market?.price_change_percentage_24h],
                ['7d', md?.price_change_percentage_7d ?? market?.price_change_percentage_7d_in_currency],
                ['30d', md?.price_change_percentage_30d],
                ['1y', md?.price_change_percentage_1y],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <div className="faint xs bold">{k}</div>
                  <Pct v={v as number | null | undefined} digits={1} />
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">{t('coin.stats')}</div>
            {detailLoading && !market ? (
              <Skeleton h={200} />
            ) : (
              <>
                <div className="kv"><span>{t('common.marketCap')}</span><span>{fmtCompact(market?.market_cap ?? md?.market_cap.usd)}</span></div>
                <div className="kv"><span>{t('common.volume24h')}</span><span>{fmtCompact(market?.total_volume ?? md?.total_volume.usd)}</span></div>
                <div className="kv"><span>{t('coin.fdv')}</span><span>{fmtCompact(market?.fully_diluted_valuation ?? md?.fully_diluted_valuation?.usd)}</span></div>
                <div className="kv"><span>{t('coin.circulating')}</span><span>{fmtCompact(market?.circulating_supply ?? md?.circulating_supply, false)}</span></div>
                <div className="kv"><span>{t('coin.totalSupply')}</span><span>{fmtCompact(market?.total_supply ?? md?.total_supply, false)}</span></div>
                <div className="kv"><span>{t('coin.maxSupply')}</span><span>{(market?.max_supply ?? md?.max_supply) ? fmtCompact(market?.max_supply ?? md?.max_supply, false) : '∞'}</span></div>
                <div className="kv">
                  <span>{t('coin.ath')}</span>
                  <span>
                    {fmtPrice(market?.ath ?? md?.ath.usd)}
                    <div className="xs faint" style={{ fontWeight: 400 }}>
                      <span className="down">{fmtPct(market?.ath_change_percentage ?? md?.ath_change_percentage.usd, 1)}</span> · {(market?.ath_date ?? md?.ath_date.usd) && fmtDate((market?.ath_date ?? md?.ath_date.usd)!)}
                    </div>
                  </span>
                </div>
                <div className="kv">
                  <span>{t('coin.atl')}</span>
                  <span>
                    {fmtPrice(market?.atl ?? md?.atl.usd)}
                    <div className="xs faint" style={{ fontWeight: 400 }}>{(market?.atl_date ?? md?.atl_date.usd) && fmtDate((market?.atl_date ?? md?.atl_date.usd)!)}</div>
                  </span>
                </div>
              </>
            )}
          </div>

          <CoinAlerts coinId={id} />

          {detail && (
            <div className="card">
              <div className="card-title">{t('coin.links')}</div>
              <div className="stack" style={{ gap: 2 }}>
                {detail.links.homepage.filter(Boolean).slice(0, 1).map((u) => (
                  <a key={u} className="menu-item" href={u} target="_blank" rel="noopener noreferrer"><IconExternal size={14} />{t('coin.website')}</a>
                ))}
                {detail.links.whitepaper && (
                  <a className="menu-item" href={detail.links.whitepaper} target="_blank" rel="noopener noreferrer"><IconExternal size={14} />{t('coin.whitepaper')}</a>
                )}
                {detail.links.blockchain_site.filter(Boolean).slice(0, 1).map((u) => (
                  <a key={u} className="menu-item" href={u} target="_blank" rel="noopener noreferrer"><IconExternal size={14} />{t('coin.explorer')}</a>
                ))}
                {detail.links.twitter_screen_name && (
                  <a className="menu-item" href={`https://x.com/${detail.links.twitter_screen_name}`} target="_blank" rel="noopener noreferrer"><IconExternal size={14} />X / Twitter</a>
                )}
                {detail.links.subreddit_url && (
                  <a className="menu-item" href={detail.links.subreddit_url} target="_blank" rel="noopener noreferrer"><IconExternal size={14} />Reddit</a>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>

      {modal === 'alert' && <AlertModal coin={choice} onClose={() => setModal(null)} />}
      {modal === 'tx' && <TxModal coin={choice} onClose={() => setModal(null)} />}
    </>
  );
}

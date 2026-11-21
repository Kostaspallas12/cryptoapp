import { useQuery } from '@tanstack/react-query';
import { ColorType, LineStyle, createChart, type IChartApi, type ISeriesApi, type MouseEventParams, type UTCTimestamp } from 'lightweight-charts';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePairMap } from '../hooks/data';
import { useT } from '../i18n';
import { fmtCompact, fmtDate, fmtPrice } from '../lib/format';
import { buildHistory, type HistoryPoint } from '../lib/history';
import { useSettings } from '../store/settings';
import type { Transaction } from '../store/user';
import { Pct, Seg, Skeleton } from './ui';

type Range = '7d' | '30d' | '90d' | '1y' | 'all';
const RANGE_DAYS: Record<Range, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365, all: Infinity };
const cssVar = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

export function PortfolioHistory({ txs }: { txs: Transaction[] }) {
  const t = useT();
  const theme = useSettings((s) => s.theme);
  const pairs = usePairMap();
  const pairsReady = Object.keys(pairs).length > 0;
  const [range, setRange] = useState<Range>('30d');
  const [hover, setHover] = useState<HistoryPoint | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Recompute only when the transactions change (key = their ids + dates + amounts)
  const key = useMemo(() => txs.map((x) => `${x.id}:${x.date}:${x.amount}:${x.type}`).sort().join('|'), [txs]);
  const { data, isLoading } = useQuery({
    queryKey: ['pf-history', key],
    queryFn: () => buildHistory(txs, pairs),
    enabled: pairsReady && txs.length > 0,
    staleTime: 15 * 60_000,
  });

  const points = useMemo(() => {
    if (!data) return [];
    const n = RANGE_DAYS[range];
    return n === Infinity ? data : data.slice(-n);
  }, [data, range]);

  // Chart is created once (per theme); range changes only swap the data → no dispose races
  const ready = points.length >= 2;
  const seriesRef = useRef<{ area: ISeriesApi<'Area'>; inv: ISeriesApi<'Line'>; chart: IChartApi } | null>(null);
  const byTimeRef = useRef(new Map<number, HistoryPoint>());

  useEffect(() => {
    if (!ready || !boxRef.current) return;
    const chart = createChart(boxRef.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: cssVar('--text-2'), fontFamily: 'Inter, system-ui, sans-serif', fontSize: 11 },
      grid: { vertLines: { visible: false }, horzLines: { color: cssVar('--border'), style: LineStyle.Dotted } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      handleScroll: false,
      handleScale: false,
      localization: { priceFormatter: (p: number) => fmtCompact(p) },
    });
    const accent = cssVar('--accent');
    const area = chart.addAreaSeries({ lineColor: accent, topColor: `${accent}55`, bottomColor: `${accent}05`, lineWidth: 2, priceLineVisible: false });
    const inv = chart.addLineSeries({ color: cssVar('--text-3'), lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const onMove = (e: MouseEventParams) => setHover(e.time ? byTimeRef.current.get(e.time as number) ?? null : null);
    chart.subscribeCrosshairMove(onMove);
    seriesRef.current = { area, inv, chart };
    return () => {
      chart.unsubscribeCrosshairMove(onMove);
      seriesRef.current = null;
      chart.remove();
    };
  }, [ready, theme]);

  useEffect(() => {
    const s = seriesRef.current;
    if (!s || points.length < 2) return;
    byTimeRef.current = new Map(points.map((p) => [p.time, p]));
    s.area.setData(points.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    s.inv.setData(points.map((p) => ({ time: p.time as UTCTimestamp, value: p.invested })));
    s.chart.timeScale().fitContent();
    setHover(null);
  }, [points, ready, theme]);

  const firstP = points[0];
  const lastP = points[points.length - 1];
  const shown = hover ?? lastP;
  // Change over the range, excluding new money added during it
  const pnlNow = lastP ? lastP.value - lastP.invested : 0;
  const pnlThen = firstP ? firstP.value - firstP.invested : 0;
  const rangePnl = pnlNow - pnlThen;
  const rangePct = firstP && firstP.value > 0 ? (rangePnl / firstP.value) * 100 : null;

  return (
    <div className="card">
      <div className="section-head" style={{ marginBottom: 6 }}>
        <div>
          <h2 className="section-title">{t('pf.history')}</h2>
          <p className="faint small">{t('pf.historyHint')}</p>
        </div>
        <Seg<Range>
          value={range}
          onChange={setRange}
          options={[
            { value: '7d', label: '7D' },
            { value: '30d', label: '30D' },
            { value: '90d', label: '90D' },
            { value: '1y', label: '1Y' },
            { value: 'all', label: 'ALL' },
          ]}
        />
      </div>
      {isLoading || !data ? (
        <Skeleton h={300} />
      ) : points.length < 2 ? (
        <div className="empty" style={{ padding: 30 }}>{t('common.noData')}</div>
      ) : (
        <>
          <div className="row between" style={{ flexWrap: 'wrap', gap: 10, margin: '6px 0 10px' }}>
            <div>
              <div className="stat-value" style={{ marginTop: 0 }}>{fmtPrice(shown?.value)}</div>
              <div className="small faint">
                {shown && fmtDate(shown.time * 1000)}
                {!hover && rangePct !== null && (
                  <> · <span className={rangePnl >= 0 ? 'up' : 'down'}>{rangePnl >= 0 ? '+' : '−'}{fmtPrice(Math.abs(rangePnl))}</span> <Pct v={rangePct} /></>
                )}
              </div>
            </div>
            <div className="legend-inline">
              <span><i style={{ background: 'var(--accent)' }} />{t('pf.valueLine')}</span>
              <span><i style={{ background: 'var(--text-3)' }} />{t('pf.investedLine')} {shown && <b className="num">{fmtCompact(shown.invested)}</b>}</span>
            </div>
          </div>
          <div className="history-box" ref={boxRef} />
        </>
      )}
    </div>
  );
}

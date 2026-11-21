import {
  ColorType, CrosshairMode, LineStyle, createChart,
  type IChartApi, type ISeriesApi, type LogicalRange, type Time, type UTCTimestamp,
} from 'lightweight-charts';
import { useEffect, useMemo, useRef, useState } from 'react';
import { WS } from '../api/binance';
import { useT } from '../i18n';
import { bollinger, ema, macd, rsi, sma, type Series } from '../lib/indicators';
import { fmtCompact, fmtPrice } from '../lib/format';
import { useSettings } from '../store/settings';
import type { Candle, Interval } from '../types';

export type Overlay = 'ema20' | 'ema50' | 'sma200' | 'bb';
export type Lower = 'volume' | 'rsi' | 'macd';

const OVERLAY_COLORS: Record<string, string> = {
  ema20: '#f5a524',
  ema50: '#7c8cff',
  sma200: '#e45bd8',
  bb: '#38bdf8',
};

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function toLine(candles: Candle[], s: Series) {
  // Null values become whitespace points so every pane shares the same bar indices
  return s.map((v, i) => (v === null ? { time: candles[i].time as UTCTimestamp } : { time: candles[i].time as UTCTimestamp, value: v })) as { time: Time; value: number }[];
}

export interface ChartMarker {
  time: number; // seconds
  kind: 'buy' | 'sell' | 'bullish' | 'bearish' | 'neutral';
  text: string;
}
export interface ChartLine {
  price: number;
  color: string;
  title: string;
}

interface Props {
  candles: Candle[];
  /** User trades/notes drawn on the candles (must be memoized by the caller) */
  markers?: ChartMarker[];
  /** Horizontal levels such as alerts or the average buy price (memoized) */
  lines?: ChartLine[];
  pair?: string;
  interval: Interval;
  overlays: Overlay[];
  lower: Lower;
  onLiveCandle?: (c: Candle) => void;
}

export function CandleChart({ candles, markers, lines, pair, interval, overlays, lower, onLiveCandle }: Props) {
  const t = useT();
  const theme = useSettings((s) => s.theme);
  const mainRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const [legend, setLegend] = useState<Candle | null>(null);
  const liveRef = useRef(onLiveCandle);
  liveRef.current = onLiveCandle;

  const hasVolume = useMemo(() => candles.some((c) => c.volume > 0), [candles]);
  const lastCandle = candles[candles.length - 1];

  useEffect(() => {
    if (!mainRef.current || !candles.length) return;
    const up = cssVar('--up');
    const down = cssVar('--down');
    const text = cssVar('--text-2');
    const grid = cssVar('--border');
    const opts = {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: text, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 11 },
      grid: { vertLines: { color: grid, style: LineStyle.Dotted }, horzLines: { color: grid, style: LineStyle.Dotted } },
      rightPriceScale: { borderColor: grid, minimumWidth: 84 },
      timeScale: { borderColor: grid, timeVisible: interval !== '1d' && interval !== '1w', secondsVisible: false, rightOffset: 6 },
      crosshair: { mode: CrosshairMode.Normal },
      autoSize: true,
      localization: { priceFormatter: (p: number) => fmtPrice(p, false) },
    };

    const chart = createChart(mainRef.current, opts);
    chartRef.current = chart;
    const cs = chart.addCandlestickSeries({ upColor: up, downColor: down, borderUpColor: up, borderDownColor: down, wickUpColor: up, wickDownColor: down });
    cs.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close })));
    candleRef.current = cs;

    const closes = candles.map((c) => c.close);
    const addLine = (s: Series, color: string, width: 1 | 2 = 2, dashed = false) => {
      const l = chart.addLineSeries({ color, lineWidth: width, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, lineStyle: dashed ? LineStyle.Dashed : LineStyle.Solid });
      l.setData(toLine(candles, s));
    };
    if (overlays.includes('ema20')) addLine(ema(closes, 20), OVERLAY_COLORS.ema20);
    if (overlays.includes('ema50')) addLine(ema(closes, 50), OVERLAY_COLORS.ema50);
    if (overlays.includes('sma200')) addLine(sma(closes, 200), OVERLAY_COLORS.sma200);
    if (overlays.includes('bb')) {
      const b = bollinger(closes);
      addLine(b.upper, OVERLAY_COLORS.bb, 1);
      addLine(b.mid, OVERLAY_COLORS.bb, 1, true);
      addLine(b.lower, OVERLAY_COLORS.bb, 1);
    }

    // Volume as overlay at the bottom of the main pane
    if (hasVolume) {
      const vs = chart.addHistogramSeries({ priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      vs.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.volume, color: c.close >= c.open ? `${up}55` : `${down}55` })));
      volRef.current = vs;
    } else volRef.current = null;
    chart.priceScale('right').applyOptions({ scaleMargins: { top: 0.08, bottom: hasVolume ? 0.2 : 0.08 } });

    const visible = Math.min(candles.length, 140);
    chart.timeScale().setVisibleLogicalRange({ from: candles.length - visible, to: candles.length + 4 });

    const byTime = new Map(candles.map((c) => [c.time, c]));
    chart.subscribeCrosshairMove((p) => {
      if (!p.time) return setLegend(null);
      setLegend(byTime.get(p.time as number) ?? null);
    });

    /* ── Lower pane: RSI or MACD ── */
    let sub: IChartApi | null = null;
    if (subRef.current && lower !== 'volume') {
      sub = createChart(subRef.current, { ...opts, timeScale: { ...opts.timeScale, visible: false } });
      if (lower === 'rsi') {
        const r = sub.addLineSeries({ color: '#a78bfa', lineWidth: 2, priceLineVisible: false });
        r.setData(toLine(candles, rsi(closes)));
        r.createPriceLine({ price: 70, color: down, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: '' });
        r.createPriceLine({ price: 30, color: up, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: '' });
      } else {
        const m = macd(closes);
        const h = sub.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false });
        h.setData(m.hist.map((v, i) => (v === null ? { time: candles[i].time as UTCTimestamp } : { time: candles[i].time as UTCTimestamp, value: v, color: v >= 0 ? `${up}99` : `${down}99` })) as { time: UTCTimestamp; value: number; color?: string }[]);
        const ml = sub.addLineSeries({ color: '#38bdf8', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
        ml.setData(toLine(candles, m.line));
        const sl = sub.addLineSeries({ color: '#f5a524', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        sl.setData(toLine(candles, m.signal));
      }
      const sync = (r: LogicalRange | null) => r && sub!.timeScale().setVisibleLogicalRange(r);
      chart.timeScale().subscribeVisibleLogicalRangeChange(sync);
      sub.timeScale().subscribeVisibleLogicalRangeChange((r) => r && chart.timeScale().setVisibleLogicalRange(r));
      sync(chart.timeScale().getVisibleLogicalRange());
    }

    return () => {
      chart.remove();
      sub?.remove();
      chartRef.current = null;
      candleRef.current = null;
      volRef.current = null;
    };
  }, [candles, overlays, lower, theme, interval, hasVolume]);

  /* ── User markers & price lines (separate effect: no chart rebuild) ── */
  useEffect(() => {
    const cs = candleRef.current;
    if (!cs || !candles.length) return;
    const first = candles[0].time;
    // Snap each marker to the candle that contains it (markers must sit on an existing bar)
    const snap = (t: number) => {
      if (t < first) return null;
      let lo = 0;
      let hi = candles.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (candles[mid].time <= t) lo = mid;
        else hi = mid - 1;
      }
      return candles[lo].time;
    };
    const style = {
      buy: { position: 'belowBar', color: cssVar('--up'), shape: 'arrowUp' },
      sell: { position: 'aboveBar', color: cssVar('--down'), shape: 'arrowDown' },
      bullish: { position: 'belowBar', color: '#7c8cff', shape: 'circle' },
      bearish: { position: 'aboveBar', color: '#7c8cff', shape: 'circle' },
      neutral: { position: 'aboveBar', color: '#7c8cff', shape: 'circle' },
    } as const;
    const ms = (markers ?? [])
      .map((m) => ({ m, time: snap(m.time) }))
      .filter((x): x is { m: ChartMarker; time: number } => x.time !== null)
      .sort((a, b) => a.time - b.time)
      .map(({ m, time }) => ({ time: time as UTCTimestamp, text: m.text, ...style[m.kind] }));
    cs.setMarkers(ms);
    const created = (lines ?? []).map((l) =>
      cs.createPriceLine({ price: l.price, color: l.color, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: l.title }),
    );
    return () => {
      // If the chart was already torn down (page change / rebuild), touching the old series would
      // schedule a repaint on a disposed canvas → "Object is disposed". Only clean up a live chart.
      if (candleRef.current !== cs) return;
      created.forEach((pl) => cs.removePriceLine(pl));
      cs.setMarkers([]);
    };
  }, [markers, lines, candles, overlays, lower, theme, interval, hasVolume]);

  /* ── Live candle updates from Binance kline stream ── */
  useEffect(() => {
    if (!pair) return;
    let closed = false;
    let ws: WebSocket | null = null;
    const open = () => {
      ws = new WebSocket(`${WS}/ws/${pair.toLowerCase()}@kline_${interval}`);
      ws.onmessage = (ev) => {
        const k = JSON.parse(ev.data).k;
        const c: Candle = { time: Math.floor(k.t / 1000), open: +k.o, high: +k.h, low: +k.l, close: +k.c, volume: +k.q };
        try {
          candleRef.current?.update({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close });
          volRef.current?.update({ time: c.time as UTCTimestamp, value: c.volume, color: c.close >= c.open ? `${cssVar('--up')}55` : `${cssVar('--down')}55` });
        } catch {
          /* update older than last bar — ignore */
        }
        liveRef.current?.(c);
      };
      ws.onclose = () => !closed && setTimeout(open, 3000);
    };
    open();
    return () => {
      closed = true;
      ws?.close();
    };
  }, [pair, interval]);

  const shown = legend ?? lastCandle;
  const chg = shown ? ((shown.close - shown.open) / shown.open) * 100 : 0;

  return (
    <div>
      <div className="chart-box">
        {shown && (
          <div className="chart-legend">
            <span>O <b className={chg >= 0 ? 'up' : 'down'}>{fmtPrice(shown.open, false)}</b></span>
            <span>H <b className={chg >= 0 ? 'up' : 'down'}>{fmtPrice(shown.high, false)}</b></span>
            <span>L <b className={chg >= 0 ? 'up' : 'down'}>{fmtPrice(shown.low, false)}</b></span>
            <span>C <b className={chg >= 0 ? 'up' : 'down'}>{fmtPrice(shown.close, false)}</b></span>
            <b className={chg >= 0 ? 'up' : 'down'}>{chg >= 0 ? '+' : ''}{chg.toFixed(2)}%</b>
            {hasVolume && <span>{t('coin.volume')} <b>{fmtCompact(shown.volume)}</b></span>}
            {overlays.map((o) => (
              <span key={o} style={{ color: OVERLAY_COLORS[o] }}>● {o.toUpperCase()}</span>
            ))}
          </div>
        )}
        <div ref={mainRef} style={{ position: 'absolute', inset: 0 }} />
        {!candles.length && <div className="chart-empty">{t('common.noData')}</div>}
      </div>
      {lower !== 'volume' && (
        <div className="chart-sub">
          <div className="chart-legend">{lower === 'rsi' ? 'RSI (14)' : 'MACD (12, 26, 9)'}</div>
          <div ref={subRef} style={{ position: 'absolute', inset: 0 }} />
        </div>
      )}
    </div>
  );
}

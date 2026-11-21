import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { buildPairMap, fetchKlines, fetchUsdtSymbols } from '../api/binance';
import { fetchCgOhlc, fetchCoinDetail, fetchGlobal, fetchMarkets, fetchTrending } from '../api/coingecko';
import { fetchFearGreed } from '../api/feargreed';
import { useLive } from '../store/live';
import type { Candle, Interval, MarketCoin } from '../types';

const MIN = 60_000;

export function useMarkets() {
  return useQuery({
    queryKey: ['markets'],
    queryFn: () => fetchMarkets(1, 250),
    refetchInterval: 3 * MIN,
    staleTime: 2 * MIN,
  });
}

export function useBinanceSymbols() {
  return useQuery({ queryKey: ['binance-symbols'], queryFn: fetchUsdtSymbols, staleTime: 60 * MIN });
}

/** coinId → Binance pair ("BTCUSDT") */
export function usePairMap(): Record<string, string> {
  const { data: coins } = useMarkets();
  const { data: symbols } = useBinanceSymbols();
  return useMemo(() => (coins && symbols ? buildPairMap(coins, symbols) : {}), [coins, symbols]);
}

export const useGlobal = () =>
  useQuery({ queryKey: ['global'], queryFn: fetchGlobal, refetchInterval: 5 * MIN, staleTime: 4 * MIN });

export const useFearGreed = () =>
  useQuery({ queryKey: ['fng'], queryFn: fetchFearGreed, staleTime: 30 * MIN });

export const useTrending = () =>
  useQuery({ queryKey: ['trending'], queryFn: fetchTrending, staleTime: 10 * MIN });

export const useCoinDetail = (id: string) =>
  useQuery({ queryKey: ['coin', id], queryFn: () => fetchCoinDetail(id), staleTime: 5 * MIN, enabled: !!id });

const CG_DAYS: Record<Interval, number> = { '15m': 1, '1h': 7, '4h': 30, '1d': 180, '1w': 365 };

export function useCandles(coinId: string, pair: string | undefined, interval: Interval, enabled = true) {
  return useQuery<Candle[]>({
    queryKey: ['candles', coinId, pair ?? 'cg', interval],
    queryFn: () => (pair ? fetchKlines(pair, interval, 500) : fetchCgOhlc(coinId, CG_DAYS[interval])),
    staleTime: MIN,
    enabled: enabled && !!coinId,
  });
}

/** Live price & 24h change for a coin — Binance tick when available, CoinGecko otherwise. */
export function useLivePrice(coin: Pick<MarketCoin, 'current_price' | 'price_change_percentage_24h'> | undefined, pair?: string) {
  const tick = useLive((s) => (pair ? s.ticks[pair] : undefined));
  return {
    price: tick?.price ?? coin?.current_price ?? null,
    change24h: tick?.change24h ?? coin?.price_change_percentage_24h ?? null,
    live: !!tick,
  };
}

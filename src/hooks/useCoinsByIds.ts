import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchMarketsByIds } from '../api/coingecko';
import type { MarketCoin } from '../types';
import { useMarkets } from './data';

/** Market rows for arbitrary coin ids: top-250 cache first, CoinGecko for the rest. */
export function useCoinsByIds(ids: string[]) {
  const { data: top, isLoading } = useMarkets();
  const missing = useMemo(() => (top ? ids.filter((id) => !top.some((c) => c.id === id)) : []), [ids, top]);
  const extra = useQuery({
    queryKey: ['markets-ids', [...missing].sort().join(',')],
    queryFn: () => fetchMarketsByIds(missing),
    enabled: missing.length > 0,
    staleTime: 2 * 60_000,
    refetchInterval: 3 * 60_000,
  });
  const coins = useMemo(() => {
    const map = new Map<string, MarketCoin>();
    top?.forEach((c) => map.set(c.id, c));
    extra.data?.forEach((c) => map.set(c.id, c));
    return ids.map((id) => map.get(id)).filter(Boolean) as MarketCoin[];
  }, [ids, top, extra.data]);
  return { coins, isLoading: isLoading || extra.isLoading };
}

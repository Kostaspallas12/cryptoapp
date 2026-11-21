import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchNews, type Article } from '../api/news';
import { buildMatcher, tagArticle } from '../lib/newsMatch';
import { useMarkets } from './data';

export interface TaggedArticle extends Article {
  coins: string[];
}

/** News feed with every article tagged by the coins it mentions */
export function useNews() {
  const q = useQuery({ queryKey: ['news'], queryFn: fetchNews, staleTime: 10 * 60_000, refetchInterval: 15 * 60_000 });
  const { data: coins } = useMarkets();
  const matcher = useMemo(() => (coins ? buildMatcher(coins) : []), [coins]);
  const items = useMemo<TaggedArticle[]>(
    () => (q.data?.items ?? []).map((a) => ({ ...a, coins: matcher.length ? tagArticle(a, matcher) : [] })),
    [q.data, matcher],
  );
  return { ...q, items, updatedAt: q.data?.updatedAt, sources: q.data?.sources ?? [] };
}

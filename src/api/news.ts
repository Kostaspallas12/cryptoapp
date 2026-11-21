/* Crypto news collected every 30 min by a GitHub Action (scripts/fetch-news.mjs)
   and published as static JSON — no API keys, no server. */
import { safeUrl } from '../lib/format';

export const NEWS_URL = 'https://raw.githubusercontent.com/Kostaspallas12/cryptoapp/news-data/news.json';

export interface Article {
  id: string;
  title: string;
  link: string;
  source: string;
  published: string;
  summary: string;
  image: string | null;
  categories: string[];
}

export interface NewsFeed {
  updatedAt: string;
  sources: string[];
  items: Article[];
}

const CACHE_KEY = 'ci-news';

export async function fetchNews(): Promise<NewsFeed> {
  try {
    const res = await fetch(NEWS_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`news ${res.status}`);
    const raw = (await res.json()) as NewsFeed;
    // Third-party content: keep only http(s) links/images and plain strings
    const feed: NewsFeed = {
      updatedAt: raw.updatedAt,
      sources: raw.sources ?? [],
      items: (raw.items ?? [])
        .map((a) => ({
          ...a,
          title: String(a.title ?? ''),
          summary: String(a.summary ?? ''),
          link: safeUrl(a.link) ?? '',
          image: safeUrl(a.image) ?? null,
          categories: Array.isArray(a.categories) ? a.categories.map(String) : [],
        }))
        .filter((a) => a.link && a.title),
    };
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(feed));
    } catch {
      /* quota */
    }
    return feed;
  } catch (e) {
    // Offline / GitHub hiccup: show the last copy we had
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) return JSON.parse(cached) as NewsFeed;
    } catch {
      /* ignore */
    }
    throw e;
  }
}

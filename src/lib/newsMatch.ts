/* Tags news articles with the coins they mention. */
import type { Article } from '../api/news';

interface CoinLike {
  id: string;
  symbol: string;
  name: string;
  market_cap_rank: number;
}

// Words that are also coin names/symbols but usually mean something else in a headline
const STOP = new Set([
  'the', 'one', 'near', 'gas', 'pi', 'story', 'sonic', 'sky', 'move', 'world', 'just', 'based', 'echo', 'dog', 'cat',
  'usd', 'eur', 'ai', 'ceo', 'etf', 'sec', 'fed', 'gdp', 'cpi', 'nft', 'defi', 'dao', 'ath', 'api', 'usa', 'us', 'uk',
  'wall', 'bank', 'game', 'safe', 'pump', 'hype', 'sun', 'core', 'flow', 'mask', 'kava', 'stable', 'live', 'open',
  'trust', 'virtual', 'sign', 'plume', 'aster', 'zora', 'arc', 'beam', 'bonk', 'ice', 'magic', 'super', 'aave',
  'stacks', 'render', 'graph', 'theta', 'helium', 'jupiter',
]);
// Some coins are written differently in the news
const ALIASES: Record<string, string[]> = {
  bitcoin: ['Bitcoin', 'BTC'],
  ethereum: ['Ethereum', 'Ether', 'ETH'],
  ripple: ['XRP', 'Ripple'],
  binancecoin: ['BNB'],
  solana: ['Solana', 'SOL'],
  dogecoin: ['Dogecoin', 'DOGE'],
  'the-open-network': ['Toncoin', 'TON'],
  'avalanche-2': ['Avalanche', 'AVAX'],
  'matic-network': ['Polygon', 'POL'],
  'hyperliquid': ['Hyperliquid', 'HYPE'],
  'aave': ['Aave'],
};

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export type Matcher = { id: string; re: RegExp; reName: RegExp | null }[];

const bound = (list: string[], flags = '') => new RegExp(`(?<![\\w$])(?:${list.map(esc).join('|')})(?![\\w])`, flags);

export function buildMatcher(coins: CoinLike[], limit = 150): Matcher {
  return coins
    .filter((c) => c.market_cap_rank && c.market_cap_rank <= limit)
    .map((c) => {
      const terms = new Set<string>(ALIASES[c.id] ?? []);
      const name = c.name.replace(/\s*\(.*\)$/, '').trim();
      if (name.length >= 4 && !STOP.has(name.toLowerCase())) terms.add(name);
      const sym = c.symbol.toUpperCase();
      if (sym.length >= 3 && !STOP.has(sym.toLowerCase()) && /^[A-Z0-9]+$/.test(sym)) terms.add(sym);
      if (!terms.size) return null;
      // Case-sensitive: "Bitcoin", "BTC" — avoids matching ordinary lowercase words
      const re = bound([...terms]);
      // Long, distinctive names also match lowercase ("bitcoin's price")
      const long = [...terms].filter((x) => x.length >= 6 && /^[A-Z][a-z]+$/.test(x));
      return { id: c.id, re, reName: long.length ? bound(long, 'i') : null };
    })
    .filter((m): m is Matcher[number] => m !== null);
}

const hit = (m: Matcher[number], txt: string) => m.re.test(txt) || (m.reName !== null && m.reName.test(txt));

/** Coin ids an article mentions, title matches first */
export function tagArticle(a: Article, matcher: Matcher): string[] {
  const inTitle = matcher.filter((m) => hit(m, a.title)).map((m) => m.id);
  const inBody = matcher.filter((m) => !inTitle.includes(m.id) && hit(m, a.summary)).map((m) => m.id);
  return [...inTitle, ...inBody].slice(0, 6);
}

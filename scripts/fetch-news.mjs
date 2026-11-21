#!/usr/bin/env node
/* Collects crypto news from public RSS feeds into one JSON file.
   Runs in GitHub Actions every 30 minutes (see .github/workflows/news.yml);
   the site reads the result from the `news-data` branch. No dependencies.
   usage: node scripts/fetch-news.mjs > news.json */

import { createHash } from 'node:crypto';

const FEEDS = [
  { source: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { source: 'Cointelegraph', url: 'https://cointelegraph.com/rss' },
  { source: 'Decrypt', url: 'https://decrypt.co/feed' },
  { source: 'The Block', url: 'https://www.theblock.co/rss.xml' },
  { source: 'CryptoSlate', url: 'https://cryptoslate.com/feed/' },
  { source: 'CryptoPotato', url: 'https://cryptopotato.com/feed/' },
  { source: 'NewsBTC', url: 'https://www.newsbtc.com/feed/' },
  { source: 'Bitcoinist', url: 'https://bitcoinist.com/feed/' },
];
const MAX_ITEMS = 250;
const MAX_AGE_DAYS = 7;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
const decode = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
const cdata = (s) => s.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1');
const text = (html) =>
  decode(cdata(html).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? cdata(m[1]).trim() : '';
};
const attr = (xml, re) => xml.match(re)?.[1];
const httpUrl = (u) => {
  try {
    const url = new URL(decode(u ?? '').trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
};

function parse(xml, source) {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  return items.map((it) => {
    const title = text(tag(it, 'title'));
    const link = httpUrl(text(tag(it, 'link'))) ?? httpUrl(attr(it, /<guid[^>]*>([^<]+)<\/guid>/i));
    const dateStr = tag(it, 'pubDate') || tag(it, 'dc:date') || tag(it, 'published');
    const published = Date.parse(dateStr);
    const raw = tag(it, 'description') || tag(it, 'content:encoded');
    let summary = text(raw);
    if (summary.length > 300) summary = summary.slice(0, 297).replace(/\s+\S*$/, '') + '…';
    const image =
      httpUrl(attr(it, /<media:content[^>]+url="([^"]+)"[^>]*(?:medium="image"|type="image)/i)) ??
      httpUrl(attr(it, /<media:content[^>]+url="([^"]+)"/i)) ??
      httpUrl(attr(it, /<media:thumbnail[^>]+url="([^"]+)"/i)) ??
      httpUrl(attr(it, /<enclosure[^>]+url="([^"]+)"[^>]*type="image/i)) ??
      httpUrl(attr(cdata(tag(it, 'content:encoded') || raw), /<img[^>]+src="([^"]+)"/i));
    const categories = [...it.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)].map((m) => text(m[1])).filter(Boolean).slice(0, 8);
    return { title, link, source, published: isFinite(published) ? new Date(published).toISOString() : null, summary, image, categories };
  });
}

async function fetchFeed({ source, url }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CryptoIntelNewsBot/1.0)', Accept: 'application/rss+xml, application/xml, text/xml' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = parse(await res.text(), source);
    console.error(`✓ ${source}: ${items.length}`);
    return items;
  } catch (e) {
    console.error(`✗ ${source}: ${e.message}`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

const all = (await Promise.all(FEEDS.map(fetchFeed))).flat();
const cutoff = Date.now() - MAX_AGE_DAYS * 86400_000;
const seen = new Set();
const items = all
  .filter((a) => a.title && a.link && a.published && Date.parse(a.published) > cutoff && Date.parse(a.published) < Date.now() + 3600_000)
  .filter((a) => {
    const key = a.link.replace(/[?#].*$/, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  })
  .sort((a, b) => b.published.localeCompare(a.published))
  .slice(0, MAX_ITEMS)
  .map((a) => ({ id: createHash('sha1').update(a.link).digest('hex').slice(0, 16), ...a }));

if (items.length < 10) {
  console.error(`Only ${items.length} items — refusing to publish a near-empty feed`);
  process.exit(1);
}
process.stdout.write(JSON.stringify({ updatedAt: new Date().toISOString(), sources: FEEDS.map((f) => f.source), items }));
console.error(`→ ${items.length} articles`);

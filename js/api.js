/* ============================================
   api.js — Κλήσεις API
   CoinGecko + Alternative.me (Fear & Greed)
   ============================================ */

const API = {

  BASE_COINGECKO: 'https://api.coingecko.com/api/v3',
  BASE_FEAR_GREED: 'https://api.alternative.me/fng/',
  CORS_PROXY: 'https://corsproxy.io/?',

  /* Cache για να μην κάνουμε πολλά requests */
  cache: {},
  CACHE_TTL: 10 * 60 * 1000, // 10 λεπτά

  isCached(key) {
    const entry = this.cache[key];
    if (!entry) return false;
    return (Date.now() - entry.timestamp) < this.CACHE_TTL;
  },

  setCache(key, data) {
    this.cache[key] = { data, timestamp: Date.now() };
  },

  getCache(key) {
    return this.cache[key]?.data;
  },

  /* ── Φέρνει νομίσματα με pagination (max 250 ανά σελίδα) ── */
  async getTopCoins(total = 250) {
    const key = `top_coins_${total}`;
    if (this.isCached(key)) return this.getCache(key);

    try {
      const perPage = 250;
      const pages = Math.ceil(total / perPage);
      let allCoins = [];

      for (let page = 1; page <= pages; page++) {
        const url = this.CORS_PROXY + encodeURIComponent(`${this.BASE_COINGECKO}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=false&price_change_percentage=24h,7d`);
        const res = await fetch(url);

        if (res.status === 429) {
          await new Promise(r => setTimeout(r, 10000));
          const retry = await fetch(url);
          if (!retry.ok) throw new Error(`Rate limited`);
          const data = await retry.json();
          allCoins = allCoins.concat(data);
        } else if (!res.ok) {
          throw new Error(`CoinGecko error: ${res.status}`);
        } else {
          const data = await res.json();
          allCoins = allCoins.concat(data);
        }

        if (page < pages) await new Promise(r => setTimeout(r, 1000));
      }

      this.setCache(key, allCoins);
      return allCoins;
    } catch (err) {
      console.error('getTopCoins error:', err);
      return null;
    }
  },

  /* ── Φέρνει ιστορικές τιμές για τεχνική ανάλυση ── */
  async getCoinHistory(coinId, days = 30) {
    const key = `history_${coinId}_${days}`;
    if (this.isCached(key)) return this.getCache(key);

    try {
      const url = this.CORS_PROXY + encodeURIComponent(`${this.BASE_COINGECKO}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`);
      const res = await fetch(url);

      if (!res.ok) throw new Error(`History error: ${res.status}`);

      const data = await res.json();
      const prices = data.prices.map(p => p[1]);
      const volumes = data.total_volumes.map(v => v[1]);

      const result = { prices, volumes };
      this.setCache(key, result);
      return result;
    } catch (err) {
      console.error(`getCoinHistory error for ${coinId}:`, err);
      return null;
    }
  },

  /* ── Fear & Greed Index ── */
  async getFearGreedIndex() {
    const key = 'fear_greed';
    if (this.isCached(key)) return this.getCache(key);

    try {
      const res = await fetch(`${this.BASE_FEAR_GREED}?limit=1`);
      if (!res.ok) throw new Error(`Fear & Greed error: ${res.status}`);

      const data = await res.json();
      const result = {
        value: parseInt(data.data[0].value),
        label: data.data[0].value_classification
      };

      this.setCache(key, result);
      return result;
    } catch (err) {
      console.error('getFearGreedIndex error:', err);
      return { value: 50, label: 'Neutral' };
    }
  },

  /* ── Global Market Data ── */
  async getGlobalData() {
    const key = 'global';
    if (this.isCached(key)) return this.getCache(key);

    try {
      await new Promise(r => setTimeout(r, 800));
      const url = this.CORS_PROXY + encodeURIComponent(`${this.BASE_COINGECKO}/global`);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Global error: ${res.status}`);

      const data = await res.json();
      this.setCache(key, data.data);
      return data.data;
    } catch (err) {
      console.error('getGlobalData error:', err);
      return null;
    }
  },

  /* ── Υπολογίζει global stats από τα coins αν το API αποτύχει ── */
  calculateGlobalFromCoins(coins) {
    if (!coins || coins.length === 0) return null;
    const totalMcap = coins.reduce((sum, c) => sum + (c.market_cap || 0), 0);
    const totalVol  = coins.reduce((sum, c) => sum + (c.total_volume || 0), 0);
    const btcMcap   = coins.find(c => c.id === 'bitcoin')?.market_cap || 0;
    const btcDom    = totalMcap > 0 ? (btcMcap / totalMcap * 100) : 0;
    return {
      total_market_cap: { usd: totalMcap },
      total_volume: { usd: totalVol },
      market_cap_percentage: { btc: btcDom },
      active_cryptocurrencies: coins.length
    };
  },

  /* ── Φέρνει και αναλύει ένα νόμισμα ── */
  async analyzeCoin(coin, fearGreedValue) {
    const history = await this.getCoinHistory(coin.id, 30);

    if (!history) {
      return Analysis.analyzecoin({
        prices: [],
        currentPrice: coin.current_price,
        change24h: coin.price_change_percentage_24h,
        change7d: coin.price_change_percentage_7d_in_currency,
        volume24h: coin.total_volume,
        avgVolume: coin.total_volume,
        fearGreedIndex: fearGreedValue,
        marketCapRank: coin.market_cap_rank
      });
    }

    const avgVolume = history.volumes.length > 0
      ? history.volumes.reduce((a, b) => a + b, 0) / history.volumes.length
      : coin.total_volume;

    return Analysis.analyzecoin({
      prices: history.prices,
      currentPrice: coin.current_price,
      change24h: coin.price_change_percentage_24h,
      change7d: coin.price_change_percentage_7d_in_currency,
      volume24h: coin.total_volume,
      avgVolume,
      fearGreedIndex: fearGreedValue,
      marketCapRank: coin.market_cap_rank
    });
  },

  /* ── Φορμάτ αριθμών ── */
  formatPrice(price) {
    if (!price && price !== 0) return '--';
    if (price >= 1000) return '$' + price.toLocaleString('el-GR', { maximumFractionDigits: 2 });
    if (price >= 1) return '$' + price.toFixed(4);
    if (price >= 0.01) return '$' + price.toFixed(6);
    return '$' + price.toFixed(8);
  },

  formatLargeNumber(num) {
    if (!num) return '--';
    if (num >= 1e12) return '$' + (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9)  return '$' + (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6)  return '$' + (num / 1e6).toFixed(2) + 'M';
    return '$' + num.toLocaleString();
  }

};
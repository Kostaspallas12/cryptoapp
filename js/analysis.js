/* ============================================
   analysis.js — Αλγόριθμοι Τεχνικής Ανάλυσης
   RSI, MACD, Bollinger Bands, Moving Averages
   ============================================ */

const Analysis = {

  /* ── RSI (Relative Strength Index) ──
     Μετρά αν ένα νόμισμα είναι overbought (>70) ή oversold (<30)
     Περίοδος: 14 κεριά (standard) */
  calculateRSI(prices, period = 14) {
    if (!prices || prices.length < period + 1) return null;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      const gain = diff >= 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  },

  /* ── Moving Average ── */
  calculateMA(prices, period) {
    if (!prices || prices.length < period) return null;
    const slice = prices.slice(-period);
    return slice.reduce((sum, p) => sum + p, 0) / period;
  },

  /* ── MACD (Moving Average Convergence Divergence) ──
     Μετρά momentum. Signal: MACD > Signal line = bullish */
  calculateMACD(prices) {
    if (!prices || prices.length < 26) return null;

    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);

    if (!ema12 || !ema26) return null;

    const macdLine = ema12 - ema26;

    // Signal line = 9-period EMA of MACD
    // Simplified: use last 9 MACD values
    const macdValues = [];
    for (let i = prices.length - 9; i < prices.length; i++) {
      if (i < 26) continue;
      const e12 = this.calculateEMA(prices.slice(0, i + 1), 12);
      const e26 = this.calculateEMA(prices.slice(0, i + 1), 26);
      if (e12 && e26) macdValues.push(e12 - e26);
    }

    const signalLine = macdValues.length > 0
      ? this.calculateEMA(macdValues, Math.min(9, macdValues.length))
      : macdLine * 0.9;

    const histogram = macdLine - signalLine;

    return {
      macd: macdLine,
      signal: signalLine,
      histogram: histogram,
      bullish: macdLine > signalLine
    };
  },

  /* ── EMA (Exponential Moving Average) ── */
  calculateEMA(prices, period) {
    if (!prices || prices.length < period) return null;

    const k = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((sum, p) => sum + p, 0) / period;

    for (let i = period; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }

    return ema;
  },

  /* ── Bollinger Bands ──
     Μετρά volatility. Τιμή κοντά στο lower band = πιθανή ανάκαμψη */
  calculateBollingerBands(prices, period = 20, multiplier = 2) {
    if (!prices || prices.length < period) return null;

    const slice = prices.slice(-period);
    const ma = slice.reduce((sum, p) => sum + p, 0) / period;

    const variance = slice.reduce((sum, p) => sum + Math.pow(p - ma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    const upper = ma + multiplier * stdDev;
    const lower = ma - multiplier * stdDev;
    const currentPrice = prices[prices.length - 1];

    // %B: πού βρίσκεται η τιμή μέσα στις bands (0 = lower, 1 = upper)
    const percentB = (currentPrice - lower) / (upper - lower);

    return {
      upper,
      middle: ma,
      lower,
      percentB,
      bandwidth: (upper - lower) / ma * 100
    };
  },

  /* ── Volume Analysis ──
     Συγκρίνει τρέχον volume με μέσο όρο */
  analyzeVolume(currentVolume, avgVolume) {
    if (!currentVolume || !avgVolume) return null;
    const ratio = currentVolume / avgVolume;
    return {
      ratio,
      strong: ratio > 1.5,
      weak: ratio < 0.7,
      signal: ratio > 1.5 ? 'Υψηλό' : ratio < 0.7 ? 'Χαμηλό' : 'Κανονικό'
    };
  },

  /* ── ΚΕΝΤΡΙΚΗ ΣΥΝΑΡΤΗΣΗ ΑΝΑΛΥΣΗΣ ──
     Παίρνει όλα τα δεδομένα και βγάζει το τελικό σκορ */
  analyzecoin(data) {
    const {
      prices,          // array τιμών (30 ημέρες)
      currentPrice,
      change24h,
      change7d,
      volume24h,
      avgVolume,
      fearGreedIndex,  // 0-100
      marketCapRank
    } = data;

    let score = 50; // Ξεκινάμε από neutral
    const signals = [];
    const details = {};

    // ── RSI Analysis (βάρος: 25%) ──
    const rsi = this.calculateRSI(prices);
    if (rsi !== null) {
      details.rsi = rsi;
      if (rsi < 30) {
        score += 15;
        signals.push({ name: 'RSI', value: rsi.toFixed(1), signal: 'Oversold → Bullish', positive: true });
      } else if (rsi < 45) {
        score += 7;
        signals.push({ name: 'RSI', value: rsi.toFixed(1), signal: 'Χαμηλό', positive: true });
      } else if (rsi > 70) {
        score -= 15;
        signals.push({ name: 'RSI', value: rsi.toFixed(1), signal: 'Overbought → Bearish', positive: false });
      } else if (rsi > 60) {
        score -= 5;
        signals.push({ name: 'RSI', value: rsi.toFixed(1), signal: 'Υψηλό', positive: false });
      } else {
        signals.push({ name: 'RSI', value: rsi.toFixed(1), signal: 'Neutral', positive: null });
      }
    }

    // ── MACD Analysis (βάρος: 20%) ──
    const macd = this.calculateMACD(prices);
    if (macd) {
      details.macd = macd;
      if (macd.bullish && macd.histogram > 0) {
        score += 12;
        signals.push({ name: 'MACD', value: macd.histogram.toFixed(4), signal: 'Bullish Crossover', positive: true });
      } else if (!macd.bullish && macd.histogram < 0) {
        score -= 12;
        signals.push({ name: 'MACD', value: macd.histogram.toFixed(4), signal: 'Bearish Crossover', positive: false });
      } else {
        signals.push({ name: 'MACD', value: macd.histogram.toFixed(4), signal: 'Mixed', positive: null });
      }
    }

    // ── Moving Averages (βάρος: 20%) ──
    if (prices && prices.length >= 20) {
      const ma7  = this.calculateMA(prices, Math.min(7, prices.length));
      const ma20 = this.calculateMA(prices, Math.min(20, prices.length));

      details.ma7 = ma7;
      details.ma20 = ma20;

      if (ma7 && ma20 && currentPrice) {
        if (currentPrice > ma20 && ma7 > ma20) {
          score += 10;
          signals.push({ name: 'Moving Avg', value: `${currentPrice > ma20 ? 'Πάνω' : 'Κάτω'} από MA20`, signal: 'Uptrend', positive: true });
        } else if (currentPrice < ma20 && ma7 < ma20) {
          score -= 10;
          signals.push({ name: 'Moving Avg', value: `${currentPrice > ma20 ? 'Πάνω' : 'Κάτω'} από MA20`, signal: 'Downtrend', positive: false });
        } else {
          signals.push({ name: 'Moving Avg', value: 'Κοντά στο MA20', signal: 'Sideways', positive: null });
        }
      }
    }

    // ── Bollinger Bands (βάρος: 15%) ──
    const bb = this.calculateBollingerBands(prices);
    if (bb) {
      details.bb = bb;
      if (bb.percentB < 0.2) {
        score += 10;
        signals.push({ name: 'Bollinger', value: `%B: ${(bb.percentB * 100).toFixed(0)}%`, signal: 'Κοντά στο Lower Band', positive: true });
      } else if (bb.percentB > 0.8) {
        score -= 8;
        signals.push({ name: 'Bollinger', value: `%B: ${(bb.percentB * 100).toFixed(0)}%`, signal: 'Κοντά στο Upper Band', positive: false });
      } else {
        signals.push({ name: 'Bollinger', value: `%B: ${(bb.percentB * 100).toFixed(0)}%`, signal: 'Μέσα στις Bands', positive: null });
      }
    }

    // ── 24h & 7d Change (βάρος: 25% για γρήγορη ανάλυση) ──
    if (change24h !== undefined && change24h !== null) {
      details.change24h = change24h;
      if (change24h < -15) {
        score += 8;
        signals.push({ name: '24h Αλλαγή', value: `${change24h.toFixed(2)}%`, signal: 'Μεγάλη Πτώση → Oversold', positive: true });
      } else if (change24h < -5) {
        score += 4;
        signals.push({ name: '24h Αλλαγή', value: `${change24h.toFixed(2)}%`, signal: 'Πτώση', positive: true });
      } else if (change24h < -2) {
        score += 2;
        signals.push({ name: '24h Αλλαγή', value: `${change24h.toFixed(2)}%`, signal: 'Μικρή Πτώση', positive: null });
      } else if (change24h > 20) {
        score -= 10;
        signals.push({ name: '24h Αλλαγή', value: `${change24h.toFixed(2)}%`, signal: 'Overbought', positive: false });
      } else if (change24h > 10) {
        score -= 6;
        signals.push({ name: '24h Αλλαγή', value: `${change24h.toFixed(2)}%`, signal: 'Μεγάλη Άνοδος → Caution', positive: false });
      } else if (change24h > 3) {
        score -= 2;
        signals.push({ name: '24h Αλλαγή', value: `${change24h.toFixed(2)}%`, signal: 'Άνοδος', positive: null });
      } else {
        signals.push({ name: '24h Αλλαγή', value: `${change24h.toFixed(2)}%`, signal: 'Σταθερό', positive: null });
      }
    }

    // ── 7d Change ──
    if (change7d !== undefined && change7d !== null) {
      details.change7d = change7d;
      if (change7d < -20) {
        score += 8;
        signals.push({ name: '7d Αλλαγή', value: `${change7d.toFixed(2)}%`, signal: 'Εβδομαδιαία Πτώση → Opportunity', positive: true });
      } else if (change7d < -10) {
        score += 4;
        signals.push({ name: '7d Αλλαγή', value: `${change7d.toFixed(2)}%`, signal: 'Αδύναμη Εβδομάδα', positive: true });
      } else if (change7d > 30) {
        score -= 8;
        signals.push({ name: '7d Αλλαγή', value: `${change7d.toFixed(2)}%`, signal: 'Overbought 7d', positive: false });
      } else if (change7d > 15) {
        score -= 4;
        signals.push({ name: '7d Αλλαγή', value: `${change7d.toFixed(2)}%`, signal: 'Δυνατή Εβδομάδα → Caution', positive: false });
      } else if (change7d > 0) {
        score += 1;
        signals.push({ name: '7d Αλλαγή', value: `${change7d.toFixed(2)}%`, signal: 'Θετική Εβδομάδα', positive: null });
      } else {
        signals.push({ name: '7d Αλλαγή', value: `${change7d.toFixed(2)}%`, signal: 'Αρνητική Εβδομάδα', positive: null });
      }
    }

    // ── Market Cap Rank Bonus ──
    if (marketCapRank) {
      if (marketCapRank <= 5) {
        score += 3;
        signals.push({ name: 'Market Rank', value: `#${marketCapRank}`, signal: 'Blue Chip', positive: true });
      } else if (marketCapRank <= 20) {
        score += 1;
        signals.push({ name: 'Market Rank', value: `#${marketCapRank}`, signal: 'Top 20', positive: null });
      } else if (marketCapRank > 100) {
        score -= 3;
        signals.push({ name: 'Market Rank', value: `#${marketCapRank}`, signal: 'Μικρό Cap', positive: false });
      } else {
        signals.push({ name: 'Market Rank', value: `#${marketCapRank}`, signal: 'Mid Cap', positive: null });
      }
    }

    // ── Fear & Greed Index (βάρος: 10%) ──
    if (fearGreedIndex !== null && fearGreedIndex !== undefined) {
      details.fearGreed = fearGreedIndex;
      if (fearGreedIndex < 25) {
        score += 10;
        signals.push({ name: 'Fear & Greed', value: fearGreedIndex, signal: 'Extreme Fear → Buy Opportunity', positive: true });
      } else if (fearGreedIndex < 40) {
        score += 5;
        signals.push({ name: 'Fear & Greed', value: fearGreedIndex, signal: 'Fear', positive: true });
      } else if (fearGreedIndex > 75) {
        score -= 10;
        signals.push({ name: 'Fear & Greed', value: fearGreedIndex, signal: 'Extreme Greed → Caution', positive: false });
      } else if (fearGreedIndex > 60) {
        score -= 4;
        signals.push({ name: 'Fear & Greed', value: fearGreedIndex, signal: 'Greed', positive: false });
      } else {
        signals.push({ name: 'Fear & Greed', value: fearGreedIndex, signal: 'Neutral', positive: null });
      }
    }

    // Clamp score 0-100
    score = Math.max(0, Math.min(100, score));

    // ── Risk Score ──
    const risk = this.calculateRisk(data, details);

    // ── Signal από Score ──
    const signal = this.scoreToSignal(score);

    // ── Reasoning ──
    const reasoning = this.generateReasoning(score, signals, data);

    return {
      score: Math.round(score),
      signal,
      risk,
      signals,
      details,
      reasoning
    };
  },

  /* Υπολογισμός ρίσκου βάσει volatility και rank */
  calculateRisk(data, details) {
    let riskScore = 0;

    // Market cap rank: μικρότερο rank = λιγότερο ρίσκο
    if (data.marketCapRank) {
      if (data.marketCapRank <= 10) riskScore += 1;
      else if (data.marketCapRank <= 50) riskScore += 2;
      else if (data.marketCapRank <= 100) riskScore += 3;
      else riskScore += 4;
    }

    // Bollinger bandwidth: υψηλό bandwidth = υψηλό ρίσκο
    if (details.bb) {
      if (details.bb.bandwidth > 20) riskScore += 2;
      else if (details.bb.bandwidth > 10) riskScore += 1;
    }

    // RSI extremes = ρίσκο
    if (details.rsi) {
      if (details.rsi < 20 || details.rsi > 80) riskScore += 2;
      else if (details.rsi < 30 || details.rsi > 70) riskScore += 1;
    }

    if (riskScore <= 2) return { level: 'low', label: 'Χαμηλό' };
    if (riskScore <= 4) return { level: 'med', label: 'Μέτριο' };
    if (riskScore <= 6) return { level: 'high', label: 'Υψηλό' };
    return { level: 'vhigh', label: 'Πολύ Υψηλό' };
  },

  /* Μετατροπή score σε signal */
  scoreToSignal(score) {
    if (score >= 70) return { key: 'strong-buy',  label: 'STRONG BUY',  emoji: '🟢' };
    if (score >= 58) return { key: 'buy',          label: 'BUY',         emoji: '🟢' };
    if (score >= 42) return { key: 'neutral',      label: 'NEUTRAL',     emoji: '🟡' };
    if (score >= 30) return { key: 'sell',         label: 'SELL',        emoji: '🔴' };
    return               { key: 'strong-sell',  label: 'STRONG SELL', emoji: '🔴' };
  },

  /* Παράγει εξήγηση ανθρώπινη */
  generateReasoning(score, signals, data) {
    const positiveCount = signals.filter(s => s.positive === true).length;
    const negativeCount = signals.filter(s => s.positive === false).length;

    let text = '';

    if (score >= 65) {
      text = `${positiveCount} από ${signals.length} τεχνικούς δείκτες είναι bullish. `;
      if (data.fearGreedIndex < 40) text += 'Το market sentiment δείχνει φόβο — ιστορικά καλή στιγμή για είσοδο. ';
      text += 'Οι συνθήκες ευνοούν αγορά, αλλά πάντα διαχειρίζεσαι το ρίσκο σου.';
    } else if (score >= 50) {
      text = `Μικτά σήματα — ${positiveCount} bullish και ${negativeCount} bearish δείκτες. `;
      text += 'Η αγορά είναι uncertain. Σκέψου να περιμένεις καλύτερη είσοδο.';
    } else if (score >= 35) {
      text = `${negativeCount} από ${signals.length} δείκτες είναι bearish. `;
      text += 'Η τάση είναι αρνητική. Καλύτερα να περιμένεις αντιστροφή.';
    } else {
      text = `Ισχυρά bearish σήματα. ${negativeCount} δείκτες δείχνουν πτώση. `;
      text += 'Αποφυγή αγοράς — η αγορά βρίσκεται σε downtrend.';
    }

    return text;
  }

};
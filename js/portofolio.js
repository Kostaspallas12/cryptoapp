/* ============================================
   portfolio.js — Portfolio Tracker
   Αποθηκεύει θέσεις και υπολογίζει P&L
   ============================================ */

const Portfolio = {

  STORAGE_KEY: 'cryptointel_portfolio',

  // { coinId: { symbol, name, image, entries: [{amount, buyPrice, date}] } }
  data: {},

  /* ── Φόρτωση από localStorage ── */
  load() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      this.data = saved ? JSON.parse(saved) : {};
    } catch (e) {
      this.data = {};
    }
  },

  /* ── Αποθήκευση ── */
  save() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
  },

  /* ── Προσθήκη θέσης ── */
  addEntry(coin, amount, buyPrice) {
    if (!this.data[coin.id]) {
      this.data[coin.id] = {
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        image: coin.image,
        entries: []
      };
    }
    this.data[coin.id].entries.push({
      amount: parseFloat(amount),
      buyPrice: parseFloat(buyPrice),
      date: new Date().toISOString()
    });
    this.save();
  },

  /* ── Διαγραφή entry ── */
  removeEntry(coinId, index) {
    if (!this.data[coinId]) return;
    this.data[coinId].entries.splice(index, 1);
    if (this.data[coinId].entries.length === 0) {
      delete this.data[coinId];
    }
    this.save();
  },

  /* ── Υπολογισμός stats για ένα coin ── */
  getCoinStats(coinId, currentPrice) {
    const holding = this.data[coinId];
    if (!holding || holding.entries.length === 0) return null;

    const totalAmount = holding.entries.reduce((sum, e) => sum + e.amount, 0);
    const totalCost   = holding.entries.reduce((sum, e) => sum + (e.amount * e.buyPrice), 0);
    const avgBuyPrice = totalCost / totalAmount;
    const currentValue = totalAmount * currentPrice;
    const pnl = currentValue - totalCost;
    const pnlPercent = (pnl / totalCost) * 100;

    return {
      totalAmount,
      totalCost,
      avgBuyPrice,
      currentValue,
      pnl,
      pnlPercent
    };
  },

  /* ── Συνολικά stats portfolio ── */
  getTotalStats(coins) {
    let totalCost    = 0;
    let totalValue   = 0;

    Object.keys(this.data).forEach(coinId => {
      const coin = coins.find(c => c.id === coinId);
      if (!coin) return;
      const stats = this.getCoinStats(coinId, coin.current_price);
      if (!stats) return;
      totalCost  += stats.totalCost;
      totalValue += stats.currentValue;
    });

    const totalPnl = totalValue - totalCost;
    const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

    return { totalCost, totalValue, totalPnl, totalPnlPercent };
  },

  /* ── Έχει θέσεις; ── */
  hasHoldings() {
    return Object.keys(this.data).length > 0;
  },

  /* ── Έχει θέση σε συγκεκριμένο coin; ── */
  hasHolding(coinId) {
    return !!this.data[coinId] && this.data[coinId].entries.length > 0;
  }

};
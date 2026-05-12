/* ============================================
   app.js — Κεντρική Λογική Εφαρμογής
   ============================================ */

const App = {

  allCoins: [],
  filteredCoins: [],
  currentFilter: 'all',
  currentSort: 'market_cap',
  fearGreedValue: 50,

  /* ── Εκκίνηση ── */
  async init() {
    // Φόρτωσε portfolio και alerts από localStorage
    Portfolio.load();
    Alerts.load();

    this.bindEvents();
    await this.loadData();

    // Ξεκίνα live prices — ελέγχει και alerts
    LivePrices.start((update) => {
      UI.updateLivePrice(update.symbol, update.price, update.change24h);

      // Έλεγξε alerts για αυτό το νόμισμα
      const triggered = Alerts.checkAlerts(update.symbol, update.price);
      triggered.forEach(alert => Alerts.sendNotification(alert));
    });

    // Auto-refresh κάθε 10 λεπτά
    setInterval(() => this.loadData(), 10 * 60 * 1000);
  },

  /* ── Φόρτωση δεδομένων ── */
  async loadData() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) refreshBtn.classList.add('spinning');

    UI.showLoading();

    try {
      // Φόρτωσε coins και fear&greed πρώτα
      const [fearGreed, coins] = await Promise.all([
        API.getFearGreedIndex(),
        API.getTopCoins(250)
      ]);

      if (!coins) {
        UI.showError('Αδυναμία σύνδεσης με CoinGecko API. Ελέγξτε τη σύνδεσή σας.');
        return;
      }

      // Fear & Greed
      if (fearGreed) {
        this.fearGreedValue = fearGreed.value;
        UI.updateFearGreed(fearGreed);
      }

      // Global stats — δοκίμασε API, αν αποτύχει υπολόγισε από coins
      const globalData = await API.getGlobalData();
      if (globalData) {
        UI.updateGlobalStats(globalData);
      } else {
        // Fallback: υπολογισμός από τα coins που έχουμε
        const fallbackStats = API.calculateGlobalFromCoins(coins);
        if (fallbackStats) UI.updateGlobalStats(fallbackStats);
      }

      // Ανάλυση νομισμάτων
      const analyzedCoins = await this.analyzeCoins(coins);

      this.allCoins = analyzedCoins;
      this.applyFiltersAndSort();
      UI.updateTimestamp();

    } catch (err) {
      console.error('loadData error:', err);
      UI.showError('Κάτι πήγε στραβά. Δοκίμασε ανανέωση.');
    } finally {
      if (refreshBtn) refreshBtn.classList.remove('spinning');
    }
  },

  /* ── Ανάλυση νομισμάτων ── */
  async analyzeCoins(coins) {
    // Τα πρώτα 20 παίρνουν πλήρη ανάλυση με ιστορικά
    // Τα υπόλοιπα παίρνουν γρήγορη ανάλυση
    const FULL_ANALYSIS_LIMIT = 10;

    const results = [];

    for (let i = 0; i < coins.length; i++) {
      const coin = coins[i];

      let analysis;

      if (i < FULL_ANALYSIS_LIMIT) {
        // Πλήρης ανάλυση με ιστορικά δεδομένα
        analysis = await API.analyzeCoin(coin, this.fearGreedValue);
        // Μικρή καθυστέρηση για να μη βομβαρδίζουμε το API
        if (i > 0 && i % 5 === 0) {
          await this.sleep(500);
        }
      } else {
        // Γρήγορη ανάλυση χωρίς ιστορικά
        analysis = Analysis.analyzecoin({
          prices: [],
          currentPrice: coin.current_price,
          change24h: coin.price_change_percentage_24h,
          change7d: coin.price_change_percentage_7d_in_currency,
          volume24h: coin.total_volume,
          avgVolume: coin.total_volume,
          fearGreedIndex: this.fearGreedValue,
          marketCapRank: coin.market_cap_rank
        });
      }

      results.push({ ...coin, _analysis: analysis });
    }

    return results;
  },

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /* ── Filters & Sort ── */
  applyFiltersAndSort() {
    let coins = [...this.allCoins];

    // Filter κατά signal
    if (this.currentFilter !== 'all') {
      coins = coins.filter(coin => {
        const sig = coin._analysis?.signal?.key ?? '';
        if (this.currentFilter === 'buy')     return sig.includes('buy');
        if (this.currentFilter === 'sell')    return sig.includes('sell');
        if (this.currentFilter === 'neutral') return sig === 'neutral';
        return true;
      });
    }

    // Search filter
    const searchVal = document.getElementById('searchInput')?.value?.toLowerCase() ?? '';
    if (searchVal) {
      coins = coins.filter(coin =>
        coin.name.toLowerCase().includes(searchVal) ||
        coin.symbol.toLowerCase().includes(searchVal)
      );
    }

    // Sort
    switch (this.currentSort) {
      case 'market_cap':
        coins.sort((a, b) => (a.market_cap_rank ?? 999) - (b.market_cap_rank ?? 999));
        break;
      case 'score_desc':
        coins.sort((a, b) => (b._analysis?.score ?? 0) - (a._analysis?.score ?? 0));
        break;
      case 'score_asc':
        coins.sort((a, b) => (a._analysis?.score ?? 0) - (b._analysis?.score ?? 0));
        break;
      case 'change_desc':
        coins.sort((a, b) => (b.price_change_percentage_24h ?? 0) - (a.price_change_percentage_24h ?? 0));
        break;
      case 'change_asc':
        coins.sort((a, b) => (a.price_change_percentage_24h ?? 0) - (b.price_change_percentage_24h ?? 0));
        break;
    }

    this.filteredCoins = coins;
    UI.renderCoinList(coins);
  },

  /* ── Events ── */
  bindEvents() {
    // Refresh button
    document.getElementById('refreshBtn')?.addEventListener('click', () => {
      // Clear cache για fresh data
      API.cache = {};
      this.loadData();
    });

    // Search
    document.getElementById('searchInput')?.addEventListener('input', () => {
      this.applyFiltersAndSort();
    });

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.getAttribute('data-filter') ?? 'all';
        this.applyFiltersAndSort();
      });
    });

    // Sort
    document.getElementById('sortSelect')?.addEventListener('change', (e) => {
      this.currentSort = e.target.value;
      this.applyFiltersAndSort();
    });

    // Coin row click → modal
    document.getElementById('coinList')?.addEventListener('click', (e) => {
      const row = e.target.closest('.coin-row');
      if (!row) return;
      const coinId = row.getAttribute('data-id');
      const coin = this.allCoins.find(c => c.id === coinId);
      if (coin) UI.openModal(coin);
    });

    // Close modal
    document.getElementById('modalClose')?.addEventListener('click', () => UI.closeModal());
    document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) UI.closeModal();
    });

    // ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') UI.closeModal();
    });

    // Main tabs
    document.querySelectorAll('.main-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab');
        document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        document.getElementById('tab-market').style.display    = tabName === 'market'    ? 'block' : 'none';
        document.getElementById('tab-portfolio').style.display = tabName === 'portfolio' ? 'block' : 'none';
        document.getElementById('tab-alerts').style.display    = tabName === 'alerts'    ? 'block' : 'none';

        if (tabName === 'portfolio') UI.renderPortfolioTab(this.allCoins);
        if (tabName === 'alerts')    this.renderAlertsTab();
      });
    });
  },

  /* ── Alerts Tab ── */
  renderAlertsTab() {
    const container = document.getElementById('alertsContent');
    if (!container) return;

    const allAlerts = Object.values(Alerts.data);

    if (allAlerts.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:3rem;">
          <p style="font-size:24px;margin-bottom:12px;">🔔</p>
          <p style="margin-bottom:6px;">Δεν έχεις ενεργά alerts.</p>
          <p style="font-size:12px;">Πάτα σε ένα νόμισμα για να προσθέσεις alert.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="table-section" style="margin-top:0;">
        <div class="table-header" style="grid-template-columns:2fr 1fr 1fr 1fr 80px;">
          <div>Νόμισμα</div>
          <div>Τύπος</div>
          <div>Τιμή Στόχος</div>
          <div>Κατάσταση</div>
          <div></div>
        </div>
        ${allAlerts.map(a => `
          <div class="coin-row" style="grid-template-columns:2fr 1fr 1fr 1fr 80px;">
            <div class="coin-info">
              <img class="coin-thumb" src="${a.image}" alt="${a.name}" />
              <div class="coin-name-wrap">
                <div class="coin-name">${a.name}</div>
                <div class="coin-symbol">${a.symbol}</div>
              </div>
            </div>
            <div style="font-size:13px;">${a.type === 'above' ? '📈 Πάνω από' : '📉 Κάτω από'}</div>
            <div style="font-family:var(--font-mono);font-size:13px;">${API.formatPrice(a.targetPrice)}</div>
            <div>
              ${a.triggered
                ? `<span class="signal-badge buy">✓ Triggered</span>`
                : `<span class="signal-badge neutral">⏳ Ενεργό</span>`
              }
            </div>
            <div style="display:flex;gap:6px;">
              ${a.triggered ? `<button class="add-btn" style="font-size:10px;" onclick="Alerts.resetAlert('${a.id}');App.renderAlertsTab();">Reset</button>` : ''}
              <button class="cancel-btn" style="font-size:11px;padding:4px 8px;" onclick="Alerts.removeAlert('${a.id}');App.renderAlertsTab();">×</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

};

/* ── Εκκίνηση όταν φορτωθεί η σελίδα ── */
document.addEventListener('DOMContentLoaded', () => App.init());
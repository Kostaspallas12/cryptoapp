/* ============================================
   ui.js — Εμφάνιση δεδομένων στην οθόνη
   ============================================ */

const UI = {

  /* ── Auth UI ── */
  updateAuthUI(user) {
    const authBtn  = document.getElementById('authBtn');
    const userInfo = document.getElementById('userInfo');
    const avatar   = document.getElementById('userAvatar');
    const name     = document.getElementById('userName');

    if (user) {
      if (authBtn)  authBtn.style.display  = 'none';
      if (userInfo) userInfo.style.display = 'flex';
      if (avatar)   avatar.src = user.photoURL || '';
      if (name)     name.textContent = user.displayName?.split(' ')[0] || 'User';
    } else {
      if (authBtn)  authBtn.style.display  = 'flex';
      if (userInfo) userInfo.style.display = 'none';
    }
  },

  /* ── Fear & Greed Widget ── */
  updateFearGreed(data) {
    const valueEl = document.getElementById('fgValue');
    const textEl  = document.getElementById('fgText');
    if (!valueEl || !textEl) return;

    valueEl.textContent = data.value;
    textEl.textContent  = data.label;

    // Χρώμα βάσει τιμής
    if (data.value <= 25)      valueEl.style.color = '#ff4d6d';
    else if (data.value <= 45) valueEl.style.color = '#ff7043';
    else if (data.value <= 55) valueEl.style.color = '#f5a623';
    else if (data.value <= 75) valueEl.style.color = '#66bb6a';
    else                       valueEl.style.color = '#00c896';
  },

  /* ── Last Update ── */
  updateTimestamp() {
    const el = document.getElementById('lastUpdate');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
  },

  /* ── Global Market Stats ── */
  updateGlobalStats(globalData) {
    if (!globalData) return;

    const mcap = document.getElementById('totalMarketCap');
    const vol  = document.getElementById('totalVolume');
    const btcd = document.getElementById('btcDominance');
    const act  = document.getElementById('activeCryptos');

    if (mcap) mcap.textContent = API.formatLargeNumber(globalData.total_market_cap?.usd);
    if (vol)  vol.textContent  = API.formatLargeNumber(globalData.total_volume?.usd);
    if (btcd) btcd.textContent = globalData.market_cap_percentage?.btc
      ? globalData.market_cap_percentage.btc.toFixed(1) + '%'
      : '--';
    if (act) act.textContent = globalData.active_cryptocurrencies?.toLocaleString() ?? '--';
  },

  /* ── Live Price Update από WebSocket ── */
  updateLivePrice(symbol, price, change24h) {
    // Βρες όλες τις γραμμές με αυτό το symbol
    const rows = document.querySelectorAll(`.coin-row[data-symbol="${symbol}"]`);
    rows.forEach(row => {
      const priceEl  = row.querySelector('.coin-price');
      const changeEl = row.querySelector('.coin-change');
      if (!priceEl) return;

      const oldPrice = parseFloat(priceEl.getAttribute('data-raw') || '0');
      const newPrice = price;

      // Ενημέρωσε τιμή
      priceEl.textContent = API.formatPrice(newPrice);
      priceEl.setAttribute('data-raw', newPrice);

      // Flash effect
      if (oldPrice > 0) {
        const flashClass = newPrice > oldPrice ? 'flash-up' : newPrice < oldPrice ? 'flash-down' : '';
        if (flashClass) {
          priceEl.classList.remove('flash-up', 'flash-down');
          void priceEl.offsetWidth; // reflow
          priceEl.classList.add(flashClass);
          setTimeout(() => priceEl.classList.remove(flashClass), 600);
        }
      }

      // Ενημέρωσε 24h%
      if (changeEl && change24h !== null && change24h !== undefined && !isNaN(change24h)) {
        const changeStr = (change24h >= 0 ? '+' : '') + change24h.toFixed(2) + '%';
        changeEl.textContent = changeStr;
        changeEl.className = 'coin-change ' + (change24h >= 0 ? 'up' : 'down');
      }
    });
  },


  renderCoinList(coins) {
    const container = document.getElementById('coinList');
    if (!container) return;

    if (!coins || coins.length === 0) {
      container.innerHTML = '<div class="empty-state">Δεν βρέθηκαν νομίσματα.</div>';
      return;
    }

    container.innerHTML = coins.map((coin, index) => this.renderCoinRow(coin, index)).join('');

    // Animate score bars μετά το render
    requestAnimationFrame(() => {
      document.querySelectorAll('.score-bar-fill').forEach(bar => {
        const width = bar.getAttribute('data-width');
        if (width) bar.style.width = width + '%';
      });
    });
  },

  renderCoinRow(coin, index) {
    const analysis = coin._analysis;
    if (!analysis) return '';

    const change = coin.price_change_percentage_24h ?? 0;
    const changeClass = change >= 0 ? 'up' : 'down';
    const changeStr = (change >= 0 ? '+' : '') + change.toFixed(2) + '%';

    const scoreColor = this.scoreToColor(analysis.score);

    return `
      <div class="coin-row" data-id="${coin.id}" data-symbol="${coin.symbol?.toLowerCase()}" data-signal="${analysis.signal.key}">
        <div class="col-rank">${coin.market_cap_rank ?? index + 1}</div>

        <div class="coin-info">
          <img class="coin-thumb" src="${coin.image}" alt="${coin.name}" loading="lazy" />
          <div class="coin-name-wrap">
            <div class="coin-name">${coin.name}</div>
            <div class="coin-symbol">${coin.symbol}</div>
          </div>
        </div>

        <div class="coin-price" data-raw="${coin.current_price}">${API.formatPrice(coin.current_price)}</div>

        <div class="coin-change ${changeClass}">${changeStr}</div>

        <div class="coin-mcap">${API.formatLargeNumber(coin.market_cap)}</div>

        <div class="score-cell">
          <div class="score-bar-wrap">
            <div class="score-bar-fill" data-width="${analysis.score}" style="width:0%; background:${scoreColor};"></div>
          </div>
          <div class="score-num" style="color:${scoreColor};">${analysis.score}</div>
        </div>

        <div>
          <span class="signal-badge ${analysis.signal.key}">${analysis.signal.label}</span>
        </div>

        <div>
          <span class="risk-badge ${analysis.risk.level}">${analysis.risk.label}</span>
        </div>
      </div>
    `;
  },

  scoreToColor(score) {
    if (score >= 65) return '#00c896';
    if (score >= 55) return '#66bb6a';
    if (score >= 42) return '#f5a623';
    if (score >= 30) return '#ff7043';
    return '#ff4d6d';
  },

  /* ── Modal Detail ── */
  openModal(coin) {
    const overlay = document.getElementById('modalOverlay');
    const content = document.getElementById('modalContent');
    if (!overlay || !content) return;

    const analysis = coin._analysis;

    content.innerHTML = `
      <div class="modal-header">
        <img class="modal-coin-img" src="${coin.image}" alt="${coin.name}" />
        <div>
          <div class="modal-coin-name">${coin.name}</div>
          <div class="modal-coin-symbol">${coin.symbol.toUpperCase()}</div>
        </div>
        <span class="modal-signal-large signal-badge ${analysis.signal.key}">
          ${analysis.signal.emoji} ${analysis.signal.label}
        </span>
      </div>

      <div class="analysis-grid">
        <div class="analysis-card">
          <div class="ac-label">Τιμή</div>
          <div class="ac-value">${API.formatPrice(coin.current_price)}</div>
          <div class="ac-sub" style="color: ${coin.price_change_percentage_24h >= 0 ? 'var(--buy)' : 'var(--sell)'}">
            ${coin.price_change_percentage_24h >= 0 ? '▲' : '▼'} ${Math.abs(coin.price_change_percentage_24h ?? 0).toFixed(2)}% (24h)
          </div>
        </div>
        <div class="analysis-card">
          <div class="ac-label">Σκορ Ανάλυσης</div>
          <div class="ac-value" style="color: ${this.scoreToColor(analysis.score)}">${analysis.score}/100</div>
          <div class="ac-sub">Βάσει ${analysis.signals.length} δεικτών</div>
        </div>
        <div class="analysis-card">
          <div class="ac-label">Market Cap</div>
          <div class="ac-value" style="font-size:16px">${API.formatLargeNumber(coin.market_cap)}</div>
          <div class="ac-sub">Rank #${coin.market_cap_rank}</div>
        </div>
        <div class="analysis-card">
          <div class="ac-label">Ρίσκο</div>
          <div class="ac-value" style="font-size:16px; color: var(--risk-${analysis.risk.level})">${analysis.risk.label}</div>
          <div class="ac-sub">Volume: ${API.formatLargeNumber(coin.total_volume)}</div>
        </div>
      </div>

      <!-- CHART SECTION -->
      <div class="chart-section">
        <div class="chart-header">
          <span class="chart-title">Πορεία Τιμής</span>
          <div class="chart-periods">
            <button class="period-btn active" data-days="7">7Η</button>
            <button class="period-btn" data-days="30">1Μ</button>
            <button class="period-btn" data-days="90">3Μ</button>
            <button class="period-btn" data-days="180">6Μ</button>
            <button class="period-btn" data-days="365">1Χ</button>
          </div>
        </div>
        <div class="chart-wrap">
          <div class="chart-loading" id="chartLoading">
            <div class="loading-spinner" style="width:24px;height:24px;"></div>
          </div>
          <canvas id="priceChart" style="display:none;"></canvas>
        </div>
      </div>

      <div class="indicators-section">
        <div class="indicators-title">Τεχνικοί Δείκτες</div>
        ${analysis.signals.map(s => `
          <div class="indicator-row">
            <span class="ind-name">${s.name}</span>
            <span class="ind-value">${s.value}</span>
            <span class="ind-signal" style="color: ${s.positive === true ? 'var(--buy)' : s.positive === false ? 'var(--sell)' : 'var(--neutral)'}">
              ${s.signal}
            </span>
          </div>
        `).join('')}
      </div>

      <div class="reasoning-section">
        <div class="reasoning-title">💡 Ανάλυση</div>
        <div class="reasoning-text">${analysis.reasoning}</div>
      </div>

      ${this.renderPortfolioSection(coin)}
    `;

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Φόρτωσε chart με 30 μέρες default
    this.loadChart(coin.id, 30);

    // Period buttons
    content.querySelectorAll('.period-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        content.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.loadChart(coin.id, parseInt(btn.getAttribute('data-days')));
      });
    });

    // Portfolio form
    document.getElementById('addPortfolioBtn')?.addEventListener('click', () => {
      document.getElementById('addPortfolioForm').style.display = 'flex';
    });
    document.getElementById('cancelPortfolioBtn')?.addEventListener('click', () => {
      document.getElementById('addPortfolioForm').style.display = 'none';
    });
    document.getElementById('savePortfolioBtn')?.addEventListener('click', () => {
      const amount = document.getElementById('portfolioAmount').value;
      const price  = document.getElementById('portfolioBuyPrice').value;
      if (!amount || !price || amount <= 0 || price <= 0) return;
      Portfolio.addEntry(coin, amount, price);
      UI.openModal(coin); // refresh modal
    });

    // Remove portfolio entry
    content.querySelectorAll('.remove-entry-btn[data-coin]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        Portfolio.removeEntry(btn.getAttribute('data-coin'), parseInt(btn.getAttribute('data-index')));
        UI.openModal(coin);
      });
    });

    // Alert form
    document.getElementById('addAlertBtn')?.addEventListener('click', async () => {
      await Alerts.requestPermission();
      document.getElementById('addAlertForm').style.display = 'flex';
      document.getElementById('alertPrice').value = coin.current_price;
    });
    document.getElementById('cancelAlertBtn')?.addEventListener('click', () => {
      document.getElementById('addAlertForm').style.display = 'none';
    });
    document.getElementById('saveAlertBtn')?.addEventListener('click', () => {
      const type  = document.getElementById('alertType').value;
      const price = document.getElementById('alertPrice').value;
      if (!price || price <= 0) return;
      Alerts.addAlert(coin, type, price);
      UI.openModal(coin);
    });

    // Remove alert
    content.querySelectorAll('.remove-entry-btn[data-alert]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        Alerts.removeAlert(btn.getAttribute('data-alert'));
        UI.openModal(coin);
      });
    });
  },

  /* ── Φόρτωση Chart ── */
  _chartInstance: null,

  async loadChart(coinId, days) {
    const canvas = document.getElementById('priceChart');
    const loading = document.getElementById('chartLoading');
    if (!canvas || !loading) return;

    // Δείξε loading
    canvas.style.display = 'none';
    loading.style.display = 'flex';

    // Destroy παλιό chart
    if (this._chartInstance) {
      this._chartInstance.destroy();
      this._chartInstance = null;
    }

    try {
      const history = await API.getCoinHistory(coinId, days);
      if (!history || !history.prices.length) {
        loading.innerHTML = '<p style="color:var(--text-muted);font-size:12px;">Δεν υπάρχουν δεδομένα</p>';
        return;
      }

      loading.style.display = 'none';
      canvas.style.display = 'block';

      // Δημιούργησε labels (ημερομηνίες)
      const labels = history.prices.map((_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (history.prices.length - 1 - i));
        if (days <= 30) return date.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit' });
        if (days <= 90) return date.toLocaleDateString('el-GR', { day: '2-digit', month: 'short' });
        return date.toLocaleDateString('el-GR', { month: 'short', year: '2-digit' });
      });

      const prices = history.prices;
      const firstPrice = prices[0];
      const lastPrice  = prices[prices.length - 1];
      const isUp = lastPrice >= firstPrice;
      const lineColor = isUp ? '#00c896' : '#ff4d6d';
      const fillColor = isUp ? 'rgba(0,200,150,0.08)' : 'rgba(255,77,109,0.08)';

      const ctx = canvas.getContext('2d');
      this._chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            data: prices,
            borderColor: lineColor,
            backgroundColor: fillColor,
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: lineColor,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              mode: 'index',
              intersect: false,
              backgroundColor: '#16161f',
              borderColor: '#2a2a3a',
              borderWidth: 1,
              titleColor: '#888899',
              bodyColor: '#e8e8f0',
              callbacks: {
                label: (ctx) => ' ' + API.formatPrice(ctx.parsed.y)
              }
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(42,42,58,0.5)', drawBorder: false },
              ticks: {
                color: '#555566',
                font: { family: 'JetBrains Mono', size: 10 },
                maxTicksLimit: 6,
                maxRotation: 0
              }
            },
            y: {
              position: 'right',
              grid: { color: 'rgba(42,42,58,0.5)', drawBorder: false },
              ticks: {
                color: '#555566',
                font: { family: 'JetBrains Mono', size: 10 },
                callback: (v) => API.formatPrice(v)
              }
            }
          },
          interaction: { mode: 'nearest', axis: 'x', intersect: false }
        }
      });

    } catch (err) {
      loading.innerHTML = '<p style="color:var(--text-muted);font-size:12px;">Σφάλμα φόρτωσης</p>';
      console.error('Chart error:', err);
    }
  },

  closeModal() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
    if (this._chartInstance) {
      this._chartInstance.destroy();
      this._chartInstance = null;
    }
  },

  /* ── Portfolio & Alert sections στο modal ── */
  renderPortfolioSection(coin) {
    const stats = Portfolio.getCoinStats(coin.id, coin.current_price);
    const alerts = Alerts.getAlertsForCoin(coin.id);
    const hasHolding = Portfolio.hasHolding(coin.id);

    return `
      <!-- PORTFOLIO SECTION -->
      <div class="modal-section">
        <div class="modal-section-header">
          <span class="modal-section-title">💼 Portfolio</span>
          <button class="add-btn" id="addPortfolioBtn">+ Προσθήκη θέσης</button>
        </div>

        <div id="addPortfolioForm" style="display:none;" class="inline-form">
          <input type="number" id="portfolioAmount" placeholder="Ποσότητα (π.χ. 0.5)" step="any" min="0" />
          <input type="number" id="portfolioBuyPrice" placeholder="Τιμή αγοράς $" step="any" min="0" />
          <button class="confirm-btn" id="savePortfolioBtn">Αποθήκευση</button>
          <button class="cancel-btn" id="cancelPortfolioBtn">Ακύρωση</button>
        </div>

        ${hasHolding && stats ? `
          <div class="holding-stats">
            <div class="holding-stat">
              <span class="hs-label">Ποσότητα</span>
              <span class="hs-value">${stats.totalAmount.toFixed(6)} ${coin.symbol.toUpperCase()}</span>
            </div>
            <div class="holding-stat">
              <span class="hs-label">Μέση τιμή</span>
              <span class="hs-value">${API.formatPrice(stats.avgBuyPrice)}</span>
            </div>
            <div class="holding-stat">
              <span class="hs-label">Τρέχουσα αξία</span>
              <span class="hs-value">${API.formatPrice(stats.currentValue)}</span>
            </div>
            <div class="holding-stat">
              <span class="hs-label">P&L</span>
              <span class="hs-value" style="color:${stats.pnl >= 0 ? 'var(--buy)' : 'var(--sell)'}">
                ${stats.pnl >= 0 ? '+' : ''}${stats.pnl.toFixed(2)}$ (${stats.pnlPercent.toFixed(2)}%)
              </span>
            </div>
          </div>
          <div class="entries-list">
            ${Portfolio.data[coin.id].entries.map((e, i) => `
              <div class="entry-row">
                <span style="font-family:var(--font-mono);font-size:12px;color:var(--text-secondary);">
                  ${e.amount} × ${API.formatPrice(e.buyPrice)}
                  <span style="color:var(--text-muted);margin-left:6px;">${new Date(e.date).toLocaleDateString('el-GR')}</span>
                </span>
                <button class="remove-entry-btn" data-coin="${coin.id}" data-index="${i}">×</button>
              </div>
            `).join('')}
          </div>
        ` : `<p class="empty-section-text">Δεν έχεις θέση σε αυτό το νόμισμα.</p>`}
      </div>

      <!-- ALERTS SECTION -->
      <div class="modal-section">
        <div class="modal-section-header">
          <span class="modal-section-title">🔔 Price Alerts</span>
          <button class="add-btn" id="addAlertBtn">+ Νέο alert</button>
        </div>

        <div id="addAlertForm" style="display:none;" class="inline-form">
          <select id="alertType" style="flex:0 0 auto;width:130px;">
            <option value="above">📈 Πάνω από</option>
            <option value="below">📉 Κάτω από</option>
          </select>
          <input type="number" id="alertPrice" placeholder="Τιμή $" step="any" min="0" />
          <button class="confirm-btn" id="saveAlertBtn">Αποθήκευση</button>
          <button class="cancel-btn" id="cancelAlertBtn">Ακύρωση</button>
        </div>

        ${alerts.length > 0 ? `
          <div class="alerts-list">
            ${alerts.map(a => `
              <div class="alert-row ${a.triggered ? 'triggered' : ''}">
                <span style="font-size:14px;">${a.type === 'above' ? '📈' : '📉'}</span>
                <span style="font-family:var(--font-mono);font-size:12px;color:var(--text-secondary);flex:1;">
                  ${a.type === 'above' ? 'Πάνω από' : 'Κάτω από'} ${API.formatPrice(a.targetPrice)}
                  ${a.triggered ? `<span style="color:var(--buy);margin-left:6px;">✓ Triggered</span>` : ''}
                </span>
                <button class="remove-entry-btn" data-alert="${a.id}">×</button>
              </div>
            `).join('')}
          </div>
        ` : `<p class="empty-section-text">Δεν έχεις ενεργά alerts.</p>`}
      </div>
    `;
  },

  /* ── Portfolio Tab ── */
  renderPortfolioTab(coins) {
    const container = document.getElementById('portfolioContent');
    if (!container) return;

    if (!Portfolio.hasHoldings()) {
      container.innerHTML = `
        <div class="empty-state" style="padding:3rem;">
          <p style="font-size:24px;margin-bottom:12px;">💼</p>
          <p style="margin-bottom:6px;">Το portfolio σου είναι άδειο.</p>
          <p style="font-size:12px;">Πάτα σε ένα νόμισμα και πρόσθεσε θέση.</p>
        </div>
      `;
      return;
    }

    const totals = Portfolio.getTotalStats(coins);

    container.innerHTML = `
      <div class="portfolio-summary">
        <div class="ps-card">
          <div class="ps-label">Συνολική Αξία</div>
          <div class="ps-value">${API.formatPrice(totals.totalValue)}</div>
        </div>
        <div class="ps-card">
          <div class="ps-label">Κόστος Αγοράς</div>
          <div class="ps-value">${API.formatPrice(totals.totalCost)}</div>
        </div>
        <div class="ps-card">
          <div class="ps-label">P&L</div>
          <div class="ps-value" style="color:${totals.totalPnl >= 0 ? 'var(--buy)' : 'var(--sell)'}">
            ${totals.totalPnl >= 0 ? '+' : ''}${totals.totalPnl.toFixed(2)}$
          </div>
        </div>
        <div class="ps-card">
          <div class="ps-label">Απόδοση</div>
          <div class="ps-value" style="color:${totals.totalPnlPercent >= 0 ? 'var(--buy)' : 'var(--sell)'}">
            ${totals.totalPnlPercent >= 0 ? '+' : ''}${totals.totalPnlPercent.toFixed(2)}%
          </div>
        </div>
      </div>

      <div class="portfolio-list">
        ${Object.values(Portfolio.data).map(holding => {
          const coin = coins.find(c => c.id === holding.id);
          if (!coin) return '';
          const stats = Portfolio.getCoinStats(holding.id, coin.current_price);
          if (!stats) return '';
          return `
            <div class="portfolio-row" data-id="${holding.id}">
              <div class="coin-info">
                <img class="coin-thumb" src="${holding.image}" alt="${holding.name}" />
                <div class="coin-name-wrap">
                  <div class="coin-name">${holding.name}</div>
                  <div class="coin-symbol">${holding.symbol.toUpperCase()}</div>
                </div>
              </div>
              <div style="font-family:var(--font-mono);font-size:13px;">
                ${stats.totalAmount.toFixed(4)} ${holding.symbol.toUpperCase()}
              </div>
              <div style="font-family:var(--font-mono);font-size:13px;">
                ${API.formatPrice(stats.avgBuyPrice)}
              </div>
              <div style="font-family:var(--font-mono);font-size:13px;">
                ${API.formatPrice(stats.currentValue)}
              </div>
              <div style="font-family:var(--font-mono);font-size:13px;color:${stats.pnl >= 0 ? 'var(--buy)' : 'var(--sell)'};">
                ${stats.pnl >= 0 ? '+' : ''}${stats.pnlPercent.toFixed(2)}%
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Click για modal
    container.querySelectorAll('.portfolio-row').forEach(row => {
      row.addEventListener('click', () => {
        const coinId = row.getAttribute('data-id');
        const coin = coins.find(c => c.id === coinId);
        if (coin) UI.openModal(coin);
      });
    });
  },

  /* ── Loading state ── */
  showLoading() {
    const container = document.getElementById('coinList');
    if (container) container.innerHTML = `
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>Φόρτωση δεδομένων αγοράς...</p>
      </div>
    `;
  },

  showError(message) {
    const container = document.getElementById('coinList');
    if (container) container.innerHTML = `
      <div class="empty-state">
        <p>⚠️ ${message}</p>
        <p style="margin-top: 8px; font-size: 12px;">Δοκίμασε να ανανεώσεις τη σελίδα.</p>
      </div>
    `;
  }

};
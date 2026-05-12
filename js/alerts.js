/* ============================================
   alerts.js — Price Alerts
   Take Profit / Stop Loss / % Change alerts
   ============================================ */

const Alerts = {

  STORAGE_KEY: 'cryptointel_alerts',

  // { alertId: { coinId, symbol, name, type, price, triggered, createdAt } }
  data: {},

  /* ── Φόρτωση ── */
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

  /* ── Προσθήκη alert ── */
  addAlert(coin, type, targetPrice) {
    const id = `${coin.id}_${type}_${Date.now()}`;
    this.data[id] = {
      id,
      coinId: coin.id,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      image: coin.image,
      type,           // 'above' | 'below'
      targetPrice: parseFloat(targetPrice),
      currentPriceAtCreation: coin.current_price,
      triggered: false,
      createdAt: new Date().toISOString()
    };
    this.save();
    return id;
  },

  /* ── Διαγραφή alert ── */
  removeAlert(alertId) {
    delete this.data[alertId];
    this.save();
  },

  /* ── Επαναφορά triggered alert ── */
  resetAlert(alertId) {
    if (this.data[alertId]) {
      this.data[alertId].triggered = false;
      this.save();
    }
  },

  /* ── Έλεγχος alerts με live τιμές ── */
  checkAlerts(symbol, currentPrice) {
    const triggered = [];

    Object.values(this.data).forEach(alert => {
      if (alert.triggered) return;
      if (alert.symbol.toLowerCase() !== symbol.toLowerCase()) return;

      let shouldTrigger = false;
      if (alert.type === 'above' && currentPrice >= alert.targetPrice) shouldTrigger = true;
      if (alert.type === 'below' && currentPrice <= alert.targetPrice) shouldTrigger = true;

      if (shouldTrigger) {
        alert.triggered = true;
        alert.triggeredAt = new Date().toISOString();
        alert.triggeredPrice = currentPrice;
        triggered.push(alert);
      }
    });

    if (triggered.length > 0) this.save();
    return triggered;
  },

  /* ── Alerts για συγκεκριμένο coin ── */
  getAlertsForCoin(coinId) {
    return Object.values(this.data).filter(a => a.coinId === coinId);
  },

  /* ── Όλα τα active alerts ── */
  getActiveAlerts() {
    return Object.values(this.data).filter(a => !a.triggered);
  },

  /* ── Συνολικός αριθμός ── */
  count() {
    return Object.keys(this.data).length;
  },

  /* ── Browser notification ── */
  async requestPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  },

  sendNotification(alert) {
    const direction = alert.type === 'above' ? '📈 Ανέβηκε πάνω από' : '📉 Έπεσε κάτω από';
    const title = `CryptoIntel Alert — ${alert.symbol}`;
    const body  = `${direction} ${API.formatPrice(alert.targetPrice)}\nΤρέχουσα τιμή: ${API.formatPrice(alert.triggeredPrice)}`;

    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
    }

    // Visual notification στην οθόνη
    this.showVisualAlert(alert);
  },

  showVisualAlert(alert) {
    const container = document.getElementById('alertToasts');
    if (!container) return;

    const direction = alert.type === 'above' ? '📈' : '📉';
    const color = alert.type === 'above' ? 'var(--buy)' : 'var(--sell)';
    const bgColor = alert.type === 'above' ? 'rgba(0,200,150,0.12)' : 'rgba(255,77,109,0.12)';
    const borderColor = alert.type === 'above' ? 'rgba(0,200,150,0.4)' : 'rgba(255,77,109,0.4)';

    const toast = document.createElement('div');
    toast.className = 'alert-toast';
    toast.style.cssText = `background:${bgColor};border:1px solid ${borderColor};border-radius:8px;padding:12px 16px;margin-bottom:8px;animation:slideIn 0.3s ease;`;
    toast.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:18px;">${direction}</span>
        <div>
          <div style="font-weight:600;font-size:13px;color:${color};">${alert.symbol} Alert</div>
          <div style="font-size:11px;color:var(--text-secondary);font-family:var(--font-mono);">
            ${alert.type === 'above' ? 'Πάνω από' : 'Κάτω από'} ${API.formatPrice(alert.targetPrice)}
          </div>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" style="margin-left:auto;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;">×</button>
      </div>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.remove(), 8000);
  }

};
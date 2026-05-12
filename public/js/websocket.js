/* ============================================
   websocket.js — Binance WebSocket Live Prices
   Ενημερώνει τιμές κάθε 1-2 δευτερόλεπτα
   ============================================ */

const LivePrices = {

  socket: null,
  isConnected: false,
  reconnectTimer: null,
  reconnectAttempts: 0,
  MAX_RECONNECTS: 5,

  // Mapping: CoinGecko symbol → Binance symbol
  // Μόνο νομίσματα που υπάρχουν στο Binance με USDT pair
  SYMBOL_MAP: {
    'btc':   'btcusdt',
    'eth':   'ethusdt',
    'bnb':   'bnbusdt',
    'xrp':   'xrpusdt',
    'sol':   'solusdt',
    'doge':  'dogeusdt',
    'ada':   'adausdt',
    'trx':   'trxusdt',
    'avax':  'avaxusdt',
    'shib':  'shibusdt',
    'dot':   'dotusdt',
    'link':  'linkusdt',
    'matic': 'maticusdt',
    'ltc':   'ltcusdt',
    'uni':   'uniusdt',
    'atom':  'atomusdt',
    'etc':   'etcusdt',
    'xlm':   'xlmusdt',
    'near':  'nearusdt',
    'algo':  'algousdt',
    'icp':   'icpusdt',
    'fil':   'filusdt',
    'vet':   'vetusdt',
    'hbar':  'hbarusdt',
    'sand':  'sandusdt',
    'mana':  'manausdt',
    'axs':   'axsusdt',
    'aave':  'aaveusdt',
    'grt':   'grtusdt',
    'mkr':   'mkrusdt',
    'snx':   'snxusdt',
    'comp':  'compusdt',
    'crv':   'crvusdt',
    'ldo':   'ldousdt',
    'apt':   'aptusdt',
    'arb':   'arbusdt',
    'op':    'opusdt',
    'sui':   'suiusdt',
    'sei':   'seiusdt',
    'inj':   'injusdt',
    'pepe':  'pepeusdt',
    'floki': 'flokiusdt',
    'wif':   'wifusdt',
    'bonk':  'bonkusdt',
    'ton':   'tonusdt',
    'not':   'notusdt',
  },

  // Reverse map: binance symbol → coingecko symbol
  reverseMap: {},

  // Callback που καλείται όταν έρθει νέα τιμή
  onPriceUpdate: null,

  /* ── Εκκίνηση ── */
  start(onPriceUpdate) {
    this.onPriceUpdate = onPriceUpdate;

    // Φτιάξε reverse map
    this.reverseMap = {};
    Object.entries(this.SYMBOL_MAP).forEach(([cg, bn]) => {
      this.reverseMap[bn] = cg;
    });

    this.connect();
  },

  /* ── Σύνδεση WebSocket ── */
  connect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    // Παίρνουμε όλα τα streams σε μια σύνδεση
    const symbols = Object.values(this.SYMBOL_MAP);
    const streams = symbols.map(s => `${s}@miniTicker`).join('/');
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;

    try {
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.updateIndicator('live');
        console.log('✅ Binance WebSocket συνδέθηκε');
      };

      this.socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.data) this.handleTicker(msg.data);
        } catch (e) {
          // ignore parse errors
        }
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.updateIndicator('disconnected');
        console.log('WebSocket αποσυνδέθηκε');
        this.scheduleReconnect();
      };

      this.socket.onerror = () => {
        this.isConnected = false;
        this.updateIndicator('error');
      };

    } catch (err) {
      console.error('WebSocket error:', err);
      this.updateIndicator('error');
    }
  },

  /* ── Επεξεργασία ticker δεδομένων ── */
  handleTicker(ticker) {
    const binanceSymbol = ticker.s?.toLowerCase();
    const cgSymbol = this.reverseMap[binanceSymbol];
    if (!cgSymbol || !this.onPriceUpdate) return;

    // Debug: log πρώτο ticker για να δούμε τα fields
    if (!this._debugged) {
      console.log('Binance ticker fields:', JSON.stringify(ticker));
      this._debugged = true;
    }

    const price    = parseFloat(ticker.c);
    const open24h  = parseFloat(ticker.o);
    const change24h = open24h > 0 ? ((price - open24h) / open24h) * 100 : null;

    if (isNaN(price)) return;

    this.onPriceUpdate({
      symbol: cgSymbol,
      price,
      change24h: (change24h !== null && !isNaN(change24h)) ? change24h : null
    });
  },

  /* ── Reconnect logic ── */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.MAX_RECONNECTS) {
      console.log('Max reconnect attempts reached');
      this.updateIndicator('error');
      return;
    }

    const delay = Math.min(3000 * (this.reconnectAttempts + 1), 15000);
    this.reconnectAttempts++;

    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);
      this.connect();
    }, delay);
  },

  /* ── Stop ── */
  stop() {
    clearTimeout(this.reconnectTimer);
    if (this.socket) {
      this.socket.onclose = null; // Αποτρέπει reconnect
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
  },

  /* ── Live indicator στο header ── */
  updateIndicator(status) {
    const dot = document.getElementById('liveDot');
    const text = document.getElementById('liveText');
    if (!dot || !text) return;

    if (status === 'live') {
      dot.style.background = '#00c896';
      text.textContent = 'LIVE';
      text.style.color = '#00c896';
    } else if (status === 'disconnected') {
      dot.style.background = '#f5a623';
      text.textContent = 'Αποσύνδεση';
      text.style.color = '#f5a623';
    } else {
      dot.style.background = '#ff4d6d';
      text.textContent = 'Offline';
      text.style.color = '#ff4d6d';
    }
  }

};
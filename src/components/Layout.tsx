import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useMarkets, usePairMap } from '../hooks/data';
import { useT } from '../i18n';
import { logOut, signIn, useAuth } from '../lib/firebase';
import { fmtPrice } from '../lib/format';
import { useLive } from '../store/live';
import { useSettings } from '../store/settings';
import { useUser } from '../store/user';
import {
  BrandMark, GoogleLogo, IconBell, IconBook, IconJournal, IconChart, IconCloud, IconLogout, IconMoon, IconSearch, IconStar, IconSun, IconWallet,
} from './Icons';
import { ErrorBoundary } from './ErrorBoundary';
import { SearchPalette } from './SearchPalette';
import { CoinImg, Pct } from './ui';

function LiveStatus() {
  const t = useT();
  const status = useLive((s) => s.status);
  return (
    <div className="live-pill" title={t(`common.${status}`)}>
      <span className={`dot ${status}`} />
      <span>{t(`common.${status}`)}</span>
    </div>
  );
}

function UserMenu() {
  const t = useT();
  const { user, sync } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (!user)
    return (
      <button className="btn" onClick={() => signIn().catch(() => alert(t('common.error')))}>
        <GoogleLogo /> <span className="hide-sm">{t('common.signIn')}</span>
      </button>
    );

  return (
    <div className="user-menu" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-label="account" style={{ display: 'flex' }}>
        {user.photoURL ? <img className="avatar" src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : <CoinImg alt={user.displayName ?? 'U'} size={30} />}
      </button>
      {open && (
        <div className="menu">
          <div className="menu-head">
            <div className="bold ellipsis">{user.displayName}</div>
            <div className="faint small ellipsis">{user.email}</div>
            <div className="row small muted" style={{ marginTop: 8 }}>
              <IconCloud size={14} />{' '}
              <span className={sync === 'error' ? 'down' : ''}>
                {sync === 'syncing' ? t('common.syncing') : sync === 'synced' ? t('common.synced') : t('common.syncFailed')}
              </span>
            </div>
          </div>
          <button className="menu-item" onClick={() => { logOut(); setOpen(false); }}>
            <IconLogout size={15} /> {t('common.signOut')}
          </button>
        </div>
      )}
    </div>
  );
}

function TickerTape() {
  const { data: coins } = useMarkets();
  const pairs = usePairMap();
  const ticks = useLive((s) => s.ticks);
  const top = (coins ?? []).filter((c) => pairs[c.id]).slice(0, 20);
  if (!top.length) return <div className="tape" style={{ height: 35 }} />;
  const items = (suffix: string) => top.map((c) => {
    const tk = ticks[pairs[c.id]];
    return (
      <Link key={c.id + suffix} to={`/coin/${c.id}`} className="tape-item" tabIndex={-1}>
        <CoinImg src={c.image} alt={c.symbol} size={16} />
        <b style={{ textTransform: 'uppercase' }}>{c.symbol}</b>
        <span className="num">{fmtPrice(tk?.price ?? c.current_price)}</span>
        <Pct v={tk?.change24h ?? c.price_change_percentage_24h} />
      </Link>
    );
  });
  return (
    <div className="tape" aria-hidden>
      <div className="tape-inner">
        {items('')}
        {items('-dup')}
      </div>
    </div>
  );
}

export function Layout() {
  const t = useT();
  const { lang, setLang, theme, setTheme } = useSettings();
  const watchCount = useUser((s) => s.watchlist.length);
  const activeAlerts = useUser((s) => s.alerts.filter((a) => !a.triggered).length);
  const [searchOpen, setSearchOpen] = useState(false);
  const loc = useLocation();

  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollTo, which React would treat as a cleanup function
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const links = [
    { to: '/', label: t('nav.market'), icon: <IconChart size={16} />, end: true },
    { to: '/watchlist', label: t('nav.watchlist'), icon: <IconStar size={16} />, count: watchCount },
    { to: '/portfolio', label: t('nav.portfolio'), icon: <IconWallet size={16} /> },
    { to: '/alerts', label: t('nav.alerts'), icon: <IconBell size={16} />, count: activeAlerts },
    { to: '/journal', label: t('nav.journal'), icon: <IconJournal size={16} /> },
    { to: '/learn', label: t('nav.learn'), icon: <IconBook size={16} /> },
  ];

  return (
    <div className="app">
      <header className="topbar">
        <div className="container topbar-inner">
          <Link to="/" className="brand">
            <BrandMark />
            <span>Crypto<b>Intel</b></span>
          </Link>
          <nav className="nav">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end}>
                {l.icon}
                {l.label}
                {!!l.count && <span className="count">{l.count}</span>}
              </NavLink>
            ))}
          </nav>
          <div className="topbar-right">
            <button className="search-trigger" onClick={() => setSearchOpen(true)} aria-label={t('common.search')}>
              <IconSearch size={15} />
              <span className="label">{t('common.search')}</span>
              <span className="kbd">Ctrl K</span>
            </button>
            <LiveStatus />
            <button className="icon-btn lang-btn" onClick={() => setLang(lang === 'el' ? 'en' : 'el')} title={t('common.language')}>
              {lang === 'el' ? 'EN' : 'ΕΛ'}
            </button>
            <button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title={t('common.theme')}>
              {theme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
            </button>
            <UserMenu />
          </div>
        </div>
      </header>
      <TickerTape />

      <main className="page">
        <div className="container">
          <ErrorBoundary resetKey={loc.pathname}>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>

      <footer className="footer">
        <div className="container">
          <p>{t('footer.disclaimer')}</p>
          <p>{t('footer.data')} · © {new Date().getFullYear()} CryptoIntel</p>
        </div>
      </footer>

      <nav className="bottom-nav">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end}>
            {l.icon}
            {l.label}
          </NavLink>
        ))}
      </nav>

      {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} />}
    </div>
  );
}

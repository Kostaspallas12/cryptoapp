import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { HttpError } from './api/coingecko';
import { AlertEngine } from './components/AlertEngine';
import { Layout } from './components/Layout';
import { Toasts } from './components/Toasts';
import { useT } from './i18n';
import { initAuth } from './lib/firebase';
import { setFormatLocale } from './lib/format';
import { AlertsPage } from './pages/Alerts';
import { CoinPage } from './pages/Coin';
import { JournalPage } from './pages/Journal';
import { LearnPage } from './pages/Learn';
import { MarketPage } from './pages/Market';
import { NewsPage } from './pages/News';
import { PortfolioPage } from './pages/Portfolio';
import { WatchlistPage } from './pages/Watchlist';
import { startLive } from './store/live';
import { useSettings } from './store/settings';
import './styles/global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (n, e) => n < 3 && !(e instanceof HttpError && e.status === 404),
      retryDelay: (n) => Math.min(30_000, 4000 * 2 ** n),
      refetchOnWindowFocus: false,
    },
  },
});

function NotFound() {
  const t = useT();
  return (
    <div className="empty">
      <h3>{t('404.title')}</h3>
      <Link to="/" className="btn btn-primary">{t('404.back')}</Link>
    </div>
  );
}

function App() {
  const lang = useSettings((s) => s.lang);
  setFormatLocale(lang);
  useEffect(() => {
    startLive();
    initAuth();
    document.documentElement.dataset.theme = useSettings.getState().theme;
  }, []);

  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<MarketPage />} />
          <Route path="coin/:id" element={<CoinPage />} />
          <Route path="watchlist" element={<WatchlistPage />} />
          <Route path="portfolio" element={<PortfolioPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="news" element={<NewsPage />} />
          <Route path="journal" element={<JournalPage />} />
          <Route path="learn" element={<LearnPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <AlertEngine />
      <Toasts />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);

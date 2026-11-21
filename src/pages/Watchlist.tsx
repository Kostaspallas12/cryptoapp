import { Link } from 'react-router-dom';
import { CoinTable } from '../components/CoinTable';
import { IconStar } from '../components/Icons';
import { useCoinsByIds } from '../hooks/useCoinsByIds';
import { useT } from '../i18n';
import { useUser } from '../store/user';

export function WatchlistPage() {
  const t = useT();
  const ids = useUser((s) => s.watchlist);
  const { coins, isLoading } = useCoinsByIds(ids);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('watch.title')}</h1>
          <p className="page-sub">{t('watch.subtitle')}</p>
        </div>
      </div>
      {ids.length === 0 ? (
        <div className="card empty">
          <div className="ico"><IconStar size={24} /></div>
          <h3>{t('watch.empty')}</h3>
          <p>{t('watch.emptyHint')}</p>
          <Link to="/" className="btn btn-primary">{t('watch.browse')}</Link>
        </div>
      ) : (
        <CoinTable coins={coins} loading={isLoading && coins.length === 0} pageSize={100} />
      )}
    </>
  );
}

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { t } from '../../i18n';
import { clearTokens, readTokens } from './api';
import { useMe } from './hooks';

/** Route guard: no token → /login; invalid token → clear + /login. */
export function RequireAuth(): JSX.Element {
  const location = useLocation();
  const { access } = readTokens();
  const me = useMe(access !== null);

  if (!access) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (me.isPending) {
    return (
      <div className="mx-auto max-w-md py-24 text-center text-sm text-slate-500">{t('common.loading')}</div>
    );
  }
  if (me.isError) {
    clearTokens();
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

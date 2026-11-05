import { Link } from 'react-router-dom';
import { t } from '../../i18n';
import { useUnreadCount } from './hooks';

/** Header bell: unread badge (30s polling) linking to the inbox. */
export function NotificationBell(): JSX.Element {
  const { data } = useUnreadCount();
  const unread = data?.unread ?? 0;
  return (
    <Link
      to="/notifications"
      aria-label={t('notifications.title')}
      className="relative rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-700"
    >
      🔔
      {unread > 0 && (
        <span className="absolute -left-1 -top-1 min-w-5 rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-5 text-white">
          {unread > 99 ? '۹۹+' : unread}
        </span>
      )}
    </Link>
  );
}

import { useState } from 'react';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '../features/notifications/hooks';

const typeLabels: Record<string, string> = {
  'review.submitted': 'درخواست بررسی',
  'review.approved': 'تأیید بررسی',
  'review.rejected': 'رد بررسی',
  'review.cancelled': 'لغو بررسی',
};

export function NotificationsPage(): JSX.Element {
  const [onlyUnread, setOnlyUnread] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const list = useNotifications({ ...(onlyUnread ? { isRead: false } : {}), page, pageSize: 20 });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const total = list.data?.total ?? 0;
  const pageSize = list.data?.pageSize ?? 20;
  const maxPage = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t('notifications.title')}</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setOnlyUnread((v) => !v);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-1 text-xs dark:border-slate-700"
          >
            {onlyUnread ? t('notifications.showAll') : t('notifications.unreadOnly')}
          </button>
          <button
            type="button"
            disabled={markAll.isPending}
            onClick={() => void markAll.mutateAsync()}
            className="rounded-lg bg-brand-500 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
          >
            {t('notifications.markAllRead')}
          </button>
        </div>
      </div>

      {list.isPending && <p className="text-sm text-slate-500">{t('common.loading')}</p>}
      {list.isError && <p className="text-sm text-red-600">{toApiMessage(list.error, t('common.error'))}</p>}
      {list.data && list.data.items.length === 0 && (
        <p className="text-sm text-slate-500">{t('common.empty')}</p>
      )}
      {list.data && list.data.items.length > 0 && (
        <ul className="space-y-3">
          {list.data.items.map((n) => (
            <li
              key={n.id}
              className={`rounded-xl border p-4 dark:border-slate-700 ${
                n.isRead ? 'border-slate-200 opacity-75' : 'border-brand-300 bg-brand-50/40 dark:border-brand-900'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{n.title}</p>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  {typeLabels[n.type] ?? n.type}
                </span>
              </div>
              {n.body && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{n.body}</p>}
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500">{new Date(n.createdAt).toLocaleString('fa-IR')}</p>
                {!n.isRead && (
                  <button
                    type="button"
                    disabled={markRead.isPending}
                    onClick={() => void markRead.mutateAsync(n.id)}
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs dark:border-slate-700 disabled:opacity-60"
                  >
                    {t('notifications.markRead')}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {maxPage > 1 && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-slate-300 px-3 py-1 text-xs dark:border-slate-700 disabled:opacity-60"
          >
            {t('search.prev')}
          </button>
          <span className="text-xs text-slate-500">
            {page} / {maxPage}
          </span>
          <button
            type="button"
            disabled={page >= maxPage}
            onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
            className="rounded-lg border border-slate-300 px-3 py-1 text-xs dark:border-slate-700 disabled:opacity-60"
          >
            {t('search.next')}
          </button>
        </div>
      )}
    </section>
  );
}

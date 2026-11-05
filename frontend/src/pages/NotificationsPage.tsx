import { useState } from 'react';
import { BellOff, CheckCheck, MailOpen } from 'lucide-react';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { useToast } from '../shared/ui/Toast';
import { PageHeader } from '../shared/ui/Chrome';
import { Button } from '../shared/ui/Button';
import { Badge } from '../shared/ui/Badge';
import { EmptyState, InlineError, Skeleton } from '../shared/ui/Feedback';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '../features/notifications/hooks';
import { formatFaDate, formatFaNumber } from '../shared/lib/format-fa';

const typeLabels: Record<string, string> = {
  'review.submitted': 'درخواست بررسی',
  'review.approved': 'تأیید بررسی',
  'review.rejected': 'رد بررسی',
  'review.cancelled': 'لغو بررسی',
};

export function NotificationsPage(): JSX.Element {
  const toast = useToast();
  const [onlyUnread, setOnlyUnread] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const list = useNotifications({ ...(onlyUnread ? { isRead: false } : {}), page, pageSize: 20 });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const total = list.data?.total ?? 0;
  const pageSize = list.data?.pageSize ?? 20;
  const maxPage = Math.max(1, Math.ceil(total / pageSize));

  async function onMarkRead(id: string): Promise<void> {
    try {
      await markRead.mutateAsync(id);
    } catch (err) {
      toast.error(toApiMessage(err, t('common.error')));
    }
  }

  async function onMarkAll(): Promise<void> {
    try {
      const res = await markAll.mutateAsync();
      toast.success(t('notifications.markedToast', { count: formatFaNumber(res.updated) }));
    } catch (err) {
      toast.error(toApiMessage(err, t('common.error')));
    }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title={t('notifications.title')}
        description={onlyUnread ? t('notifications.unreadOnlyDesc') : t('notifications.allDesc')}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => { setOnlyUnread((v) => !v); setPage(1); }} aria-pressed={onlyUnread}>
              <MailOpen size={15} />
              {onlyUnread ? t('notifications.showAll') : t('notifications.unreadOnly')}
            </Button>
            <Button variant="secondary" size="sm" disabled={markAll.isPending} onClick={() => void onMarkAll()}>
              <CheckCheck size={15} />
              {t('notifications.markAllRead')}
            </Button>
          </>
        }
      />

      {list.isPending && (
        <div className="space-y-2.5">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      )}
      {list.isError && <InlineError message={toApiMessage(list.error, t('common.error'))} onRetry={() => void list.refetch()} />}
      {list.data && list.data.items.length === 0 && (
        <div className="surface">
          <EmptyState icon={BellOff} title={t('notifications.emptyTitle')} hint={t('notifications.emptyHint')} />
        </div>
      )}
      {list.data && list.data.items.length > 0 && (
        <ul className="surface divide-y overflow-hidden" style={{ borderColor: 'var(--line)' }}>
          {list.data.items.map((n) => (
            <li key={n.id} className={`px-5 py-4 transition-colors ${n.isRead ? '' : 'bg-brand-50/50 dark:bg-brand-900/10'}`}>
              <div className="flex flex-wrap items-center gap-2">
                {!n.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-label="unread" />}
                <p className={`min-w-0 flex-1 text-sm ${n.isRead ? 'font-medium text-slate-600 dark:text-slate-300' : 'font-bold'}`}>{n.title}</p>
                <Badge tone="slate" dot={false}>{typeLabels[n.type] ?? n.type}</Badge>
              </div>
              {n.body && <p className="mt-1 text-[13px] leading-6 text-slate-500 dark:text-slate-400">{n.body}</p>}
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <p className="meta">{formatFaDate(n.createdAt)}</p>
                {!n.isRead && (
                  <Button variant="ghost" size="sm" disabled={markRead.isPending} onClick={() => void onMarkRead(n.id)} className="h-7 text-xs">
                    {t('notifications.markRead')}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {maxPage > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            {t('search.prev')}
          </Button>
          <span className="meta tabular-nums">
            {formatFaNumber(page)} / {formatFaNumber(maxPage)}
          </span>
          <Button variant="secondary" size="sm" disabled={page >= maxPage} onClick={() => setPage((p) => Math.min(maxPage, p + 1))}>
            {t('search.next')}
          </Button>
        </div>
      )}
    </section>
  );
}

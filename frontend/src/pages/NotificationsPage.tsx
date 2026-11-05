import { useState } from 'react';
import { BellOff, CheckCheck, CircleCheck, CircleSlash, CircleX, Bell, Send, type LucideIcon } from 'lucide-react';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { cn } from '../shared/lib/cn';
import { formatFaNumber, formatFaRelative } from '../shared/lib/format-fa';
import { useToast } from '../shared/ui/Toast';
import { PageHeader } from '../shared/ui/Chrome';
import { Button } from '../shared/ui/Button';
import { EmptyState, InlineError, Skeleton } from '../shared/ui/Feedback';
import { Pager } from '../shared/ui/Pager';
import { Segmented } from '../shared/ui/Segmented';
import { notificationTypeKey } from '../features/notifications/labels';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '../features/notifications/hooks';

const PAGE_SIZE = 20;

const typeIcon: Record<string, { icon: LucideIcon; tone: string }> = {
  'review.submitted': { icon: Send, tone: 'bg-accent-soft text-accent' },
  'review.approved': { icon: CircleCheck, tone: 'bg-success-soft text-success' },
  'review.rejected': { icon: CircleX, tone: 'bg-danger-soft text-danger' },
  'review.cancelled': { icon: CircleSlash, tone: 'bg-surface-sunken text-ink-3' },
};

export function NotificationsPage(): JSX.Element {
  const toast = useToast();
  const [onlyUnread, setOnlyUnread] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const list = useNotifications({ ...(onlyUnread ? { isRead: false } : {}), page, pageSize: PAGE_SIZE });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function changeFilter(unread: boolean): void {
    setOnlyUnread(unread);
    setPage(1);
  }

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
    <div className="space-y-6">
      <PageHeader
        title={t('notifications.title')}
        description={onlyUnread ? t('notifications.unreadOnlyDesc') : t('notifications.allDesc')}
        actions={
          <Button variant="secondary" disabled={markAll.isPending} onClick={() => void onMarkAll()}>
            <CheckCheck size={16} />
            {t('notifications.markAllRead')}
          </Button>
        }
      />

      <Segmented
        label={t('notifications.title')}
        value={onlyUnread ? 'unread' : 'all'}
        onChange={(v) => changeFilter(v === 'unread')}
        options={[
          { value: 'all', label: t('notifications.showAll') },
          { value: 'unread', label: t('notifications.unreadOnly') },
        ]}
      />

      {list.isPending && (
        <div className="surface space-y-3 p-5">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      )}
      {list.isError && <InlineError message={toApiMessage(list.error, t('common.error'))} onRetry={() => void list.refetch()} />}

      {list.data && list.data.items.length === 0 && (
        <section className="surface">
          <EmptyState
            icon={BellOff}
            title={onlyUnread ? t('notifications.emptyUnreadTitle') : t('notifications.emptyTitle')}
            hint={onlyUnread ? undefined : t('notifications.emptyHint')}
          />
        </section>
      )}

      {list.data && list.data.items.length > 0 && (
        <ul className="surface divide-y divide-line overflow-hidden">
          {list.data.items.map((n) => {
            const style = typeIcon[n.type];
            const Icon = style?.icon ?? Bell;
            return (
              <li key={n.id} className={cn('flex items-start gap-4 px-5 py-4 transition-colors', !n.isRead && 'bg-accent-soft/40')}>
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-control',
                    style?.tone ?? 'bg-surface-sunken text-ink-3',
                  )}
                  aria-hidden
                >
                  <Icon size={17} strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className={cn('min-w-0 text-[14px] leading-6', n.isRead ? 'text-ink-2' : 'font-semibold text-ink')}>{n.title}</p>
                    <span className="meta text-[12px]">{t(notificationTypeKey(n.type))}</span>
                    {!n.isRead && <span className="badge-accent h-5 px-1.5 text-[11px]">{t('notifications.unreadBadge')}</span>}
                  </div>
                  {n.body && <p className="mt-1 text-[13.5px] leading-7 text-ink-3">{n.body}</p>}
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="meta text-[12.5px]">{formatFaRelative(n.createdAt)}</span>
                    {!n.isRead && (
                      <Button variant="ghost" size="sm" disabled={markRead.isPending} onClick={() => void onMarkRead(n.id)}>
                        {t('notifications.markRead')}
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Pager page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  );
}

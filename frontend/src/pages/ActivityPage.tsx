import { useState } from 'react';
import { Activity, History } from 'lucide-react';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { PageHeader } from '../shared/ui/Chrome';
import { Button } from '../shared/ui/Button';
import { Select } from '../shared/ui/Field';
import { Badge } from '../shared/ui/Badge';
import { EmptyState, InlineError, Skeleton } from '../shared/ui/Feedback';
import { useMe } from '../features/auth/hooks';
import { useAuditLogs } from '../features/audit/hooks';
import { formatFaDate, formatFaNumber } from '../shared/lib/format-fa';

const actionLabels: Record<string, string> = {
  'auth.register': 'ثبت‌نام',
  'auth.login': 'ورود',
  'auth.logout': 'خروج',
  'auth.change-password': 'تغییر گذرواژه',
  'kb.create': 'ساخت پایگاه دانش',
  'kb.update': 'ویرایش پایگاه دانش',
  'kb.delete': 'حذف پایگاه دانش',
  'kb.member.add': 'افزودن عضو',
  'kb.member.update': 'تغییر نقش عضو',
  'kb.member.remove': 'حذف عضو',
  'article.create': 'ساخت مقاله',
  'article.update': 'ویرایش مقاله',
  'article.delete': 'حذف مقاله',
  'article.attach': 'پیوست فایل',
  'article.detach': 'جدا کردن پیوست',
  'article.draft': 'بازگشت به پیش‌نویس',
  'article.published': 'انتشار',
  'article.archived': 'بایگانی',
  'review.submitted': 'ارسال برای بررسی',
  'review.approved': 'تأیید بررسی',
  'review.rejected': 'رد بررسی',
  'review.cancelled': 'لغو بررسی',
};

const actionTone: Record<string, 'blue' | 'green' | 'amber' | 'rose' | 'slate'> = {
  'auth.register': 'green',
  'auth.login': 'slate',
  'auth.logout': 'slate',
  'auth.change-password': 'amber',
  'kb.create': 'blue',
  'kb.delete': 'rose',
  'article.create': 'blue',
  'article.delete': 'rose',
  'article.published': 'green',
  'article.archived': 'amber',
  'review.submitted': 'blue',
  'review.approved': 'green',
  'review.rejected': 'rose',
};

export function ActivityPage(): JSX.Element {
  const me = useMe();
  const isAdmin = me.data?.memberships.some((m) => m.role === 'org-admin') ?? false;
  const [action, setAction] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const list = useAuditLogs({ ...(action ? { action } : {}), page, pageSize: 20 }, isAdmin);

  const total = list.data?.total ?? 0;
  const pageSize = list.data?.pageSize ?? 20;
  const maxPage = Math.max(1, Math.ceil(total / pageSize));

  if (!me.isPending && !isAdmin) {
    return (
      <section className="mx-auto max-w-4xl">
        <PageHeader title={t('activity.title')} />
        <div className="surface mt-4 p-5 text-sm text-amber-800 dark:text-amber-200">
          {t('admin.forbidden')}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title={t('activity.title')}
        description={t('activity.desc', { count: formatFaNumber(total) })}
        actions={
          <Select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className="w-auto"
            aria-label={t('activity.allActions')}
          >
            <option value="">{t('activity.allActions')}</option>
            {Object.entries(actionLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        }
      />

      {list.isPending && (
        <div className="space-y-2.5">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      )}
      {list.isError && <InlineError message={toApiMessage(list.error, t('common.error'))} onRetry={() => void list.refetch()} />}
      {list.data && list.data.items.length === 0 && (
        <div className="surface">
          <EmptyState icon={History} title={t('activity.emptyTitle')} hint={t('activity.emptyHint')} />
        </div>
      )}
      {list.data && list.data.items.length > 0 && (
        <ol className="surface divide-y overflow-hidden" style={{ borderColor: 'var(--line)' }}>
          {list.data.items.map((a) => (
            <li key={a.id} className="flex items-start gap-3 px-5 py-3.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <Activity size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={actionTone[a.action] ?? 'slate'}>{actionLabels[a.action] ?? a.action}</Badge>
                  <span className="meta" dir="ltr">{a.resourceType} · {a.resourceId.slice(0, 8)}…</span>
                </div>
                <p className="meta mt-1">
                  {formatFaDate(a.createdAt)}
                  {a.actorId ? ` · ${t('activity.actor')}: ${a.actorId.slice(0, 8)}…` : ''}
                  {a.ip ? ` · ${a.ip}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ol>
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

import { useState } from 'react';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { useMe } from '../features/auth/hooks';
import { useAuditLogs } from '../features/audit/hooks';

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
        <h1 className="text-2xl font-bold">{t('activity.title')}</h1>
        <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {t('admin.forbidden')}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t('activity.title')}</h1>
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="">{t('activity.allActions')}</option>
          {Object.entries(actionLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {list.isPending && <p className="text-sm text-slate-500">{t('common.loading')}</p>}
      {list.isError && <p className="text-sm text-red-600">{toApiMessage(list.error, t('common.error'))}</p>}
      {list.data && list.data.items.length === 0 && (
        <p className="text-sm text-slate-500">{t('common.empty')}</p>
      )}
      {list.data && list.data.items.length > 0 && (
        <ul className="space-y-3">
          {list.data.items.map((a) => (
            <li key={a.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{actionLabels[a.action] ?? a.action}</p>
                <span className="text-xs text-slate-500">{new Date(a.createdAt).toLocaleString('fa-IR')}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {a.resourceType} · {a.resourceId.slice(0, 8)}…
                {a.actorId ? ` · ${t('activity.actor')}: ${a.actorId.slice(0, 8)}…` : ''}
                {a.ip ? ` · ${a.ip}` : ''}
              </p>
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

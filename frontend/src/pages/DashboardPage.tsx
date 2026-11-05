import { Link } from 'react-router-dom';
import { Bell, BookOpenText, ClipboardCheck, Plus, Search, Server } from 'lucide-react';
import { t } from '../i18n';
import { useKbs } from '../features/knowledge-bases/hooks';
import { useReviewInbox } from '../features/approval/hooks';
import { useUnreadCount } from '../features/notifications/hooks';
import { useHealth } from '../features/health/hooks';
import { PageHeader } from '../shared/ui/Chrome';
import { EmptyState, InlineError, Skeleton } from '../shared/ui/Feedback';
import { formatFaNumber } from '../shared/lib/format-fa';

function StatCard({ icon: Icon, label, value, to, pending }: {
  icon: typeof Bell;
  label: string;
  value: string;
  to: string;
  pending?: boolean;
}): JSX.Element {
  return (
    <Link to={to} className="surface group flex items-center gap-3.5 p-4 transition-shadow hover:shadow-lift">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand-50 text-brand-600 dark:bg-brand-900/25 dark:text-brand-200">
        <Icon size={19} strokeWidth={1.9} />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] text-slate-500 dark:text-slate-400">{label}</span>
        {pending ? (
          <span className="skeleton mt-1 block h-6 w-12" />
        ) : (
          <span className="block text-xl font-bold leading-8 tabular-nums">{value}</span>
        )}
      </span>
    </Link>
  );
}

export function DashboardPage(): JSX.Element {
  const kbs = useKbs();
  const inbox = useReviewInbox({ role: 'reviewer', status: 'pending', pageSize: 5 });
  const unread = useUnreadCount();
  const health = useHealth();

  const pendingCount = inbox.data?.total ?? 0;

  return (
    <section className="space-y-6">
      <PageHeader
        title={t('dashboard.title')}
        description={t('dashboard.subtitle')}
        actions={
          <Link to="/kbs" className="btn-primary btn-sm">
            <Plus size={15} />
            {t('kb.create')}
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={BookOpenText} label={t('nav.knowledgeBases')} value={formatFaNumber(kbs.data?.length ?? 0)} to="/kbs" pending={kbs.isPending} />
        <StatCard icon={ClipboardCheck} label={t('dashboard.pendingReviews')} value={formatFaNumber(pendingCount)} to="/reviews" pending={inbox.isPending} />
        <StatCard icon={Bell} label={t('nav.notifications')} value={formatFaNumber(unread.data?.unread ?? 0)} to="/notifications" pending={unread.isPending} />
        <StatCard
          icon={Server}
          label={t('common.backendStatus')}
          value={health.data ? t('dashboard.connected') : health.isPending ? '…' : t('dashboard.disconnected')}
          to="/search"
          pending={false}
        />
      </div>

      {kbs.isError && <InlineError message={t('common.error')} onRetry={() => void kbs.refetch()} />}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="surface overflow-hidden">
          <div className="hairline-b flex items-center justify-between px-5 py-3.5">
            <h2 className="section-title">{t('dashboard.myReviews')}</h2>
            <Link to="/reviews" className="text-[13px] font-medium text-brand-700 hover:underline dark:text-brand-200">
              {t('review.inboxTitle')}
            </Link>
          </div>
          {inbox.isPending && (
            <div className="space-y-2.5 p-5">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          )}
          {inbox.isError && <p className="p-5 text-sm text-rose-600">{t('common.error')}</p>}
          {inbox.data && inbox.data.items.length === 0 && (
            <EmptyState icon={ClipboardCheck} title={t('dashboard.noPendingReviews')} hint={t('dashboard.noPendingReviewsHint')} />
          )}
          {inbox.data && inbox.data.items.length > 0 && (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {inbox.data.items.map((r) => (
                <li key={r.id}>
                  <Link to={`/kbs/${r.kbSlug}/articles/${r.articleSlug}`} className="block px-5 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <p className="truncate text-sm font-semibold">{r.articleTitle}</p>
                    <p className="meta mt-0.5 truncate">{r.kbTitle}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="surface overflow-hidden">
          <div className="hairline-b flex items-center justify-between px-5 py-3.5">
            <h2 className="section-title">{t('dashboard.recentKbs')}</h2>
            <Link to="/kbs" className="text-[13px] font-medium text-brand-700 hover:underline dark:text-brand-200">
              {t('nav.knowledgeBases')}
            </Link>
          </div>
          {kbs.isPending && (
            <div className="space-y-2.5 p-5">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          )}
          {kbs.data && kbs.data.length === 0 && (
            <EmptyState
              icon={BookOpenText}
              title={t('dashboard.noKbs')}
              hint={t('dashboard.noKbsHint')}
              action={
                <Link to="/kbs" className="btn-primary btn-sm">
                  <Plus size={15} />
                  {t('kb.create')}
                </Link>
              }
            />
          )}
          {kbs.data && kbs.data.length > 0 && (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {kbs.data.slice(0, 5).map((kb) => (
                <li key={kb.id}>
                  <Link to={`/kbs/${kb.slug}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-slate-100 text-sm font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                      {kb.title.trim().charAt(0)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{kb.title}</span>
                      <span className="meta block truncate">
                        {t('kb.members')}: {formatFaNumber(kb.memberCount)} · {t('kb.categories')}: {formatFaNumber(kb.categoryCount)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="surface flex flex-wrap items-center gap-2 p-4">
        <Search size={16} className="text-slate-400" />
        <p className="text-[13px] text-slate-500 dark:text-slate-400">{t('dashboard.searchHint')}</p>
        <Link to="/search" className="btn-secondary btn-sm ms-auto">
          {t('nav.search')}
        </Link>
      </div>
    </section>
  );
}

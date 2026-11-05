import { useQueries } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bell, BookOpenText, ClipboardCheck, FileText, FolderTree, Plus, Users, type LucideIcon } from 'lucide-react';
import { t } from '../i18n';
import { cn } from '../shared/lib/cn';
import { formatFaNumber, formatFaRelative } from '../shared/lib/format-fa';
import { PageHeader } from '../shared/ui/Chrome';
import { EmptyState, InlineError, Skeleton } from '../shared/ui/Feedback';
import { useKbs } from '../features/knowledge-bases/hooks';
import { kbTileClass } from '../features/knowledge-bases/tone';
import { useReviewInbox } from '../features/approval/hooks';
import { useNotifications, useUnreadCount } from '../features/notifications/hooks';
import { useHealth } from '../features/health/hooks';
import { listArticles, type ArticleListParams } from '../features/articles/api';
import { articleKeys } from '../features/articles/hooks';
import { ArticleStatusBadge } from '../features/articles/components/ArticleStatusBadge';

const RECENT: ArticleListParams = { sort: 'updated', pageSize: 6 };
const PUBLISHED: ArticleListParams = { status: 'published', pageSize: 1 };

interface Stat {
  to: string;
  label: string;
  value: number | null;
  icon: LucideIcon;
}

function SectionCard({ title, to, linkLabel, children }: {
  title: string;
  to?: string;
  linkLabel?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section className="surface overflow-hidden">
      <div className="panel-head justify-between">
        <h2 className="section-title">{title}</h2>
        {to && linkLabel && (
          <Link to={to} className="text-[13px] font-medium text-accent hover:underline">
            {linkLabel}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function DashboardPage(): JSX.Element {
  const kbs = useKbs();
  const inbox = useReviewInbox({ role: 'reviewer', status: 'pending', pageSize: 5 });
  const inFlight = useReviewInbox({ role: 'requester', status: 'pending', pageSize: 1 });
  const unread = useUnreadCount();
  const notifications = useNotifications({ pageSize: 5 });
  const health = useHealth();

  const kbList = kbs.data ?? [];
  const hasKbs = kbList.length > 0;
  const recentQueries = useQueries({
    queries: kbList.map((kb) => ({
      queryKey: articleKeys.list(kb.id, RECENT),
      queryFn: () => listArticles(kb.id, RECENT),
    })),
  });
  const publishedQueries = useQueries({
    queries: kbList.map((kb) => ({
      queryKey: articleKeys.list(kb.id, PUBLISHED),
      queryFn: () => listArticles(kb.id, PUBLISHED),
    })),
  });

  const kbById = new Map(kbList.map((kb) => [kb.id, kb] as const));
  const latest = recentQueries
    .flatMap((q) => q.data?.items ?? [])
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 8);
  const articlesLoading = hasKbs && recentQueries.some((q) => q.isPending);
  const publishedCount = publishedQueries.reduce((sum, q) => sum + (q.data?.total ?? 0), 0);

  const stats: Stat[] = [
    { to: '/kbs', label: t('dashboard.statKbs'), value: kbs.isPending ? null : kbList.length, icon: BookOpenText },
    {
      to: '/kbs',
      label: t('dashboard.statPublished'),
      value: hasKbs && publishedQueries.some((q) => q.isPending) ? null : publishedCount,
      icon: FileText,
    },
    { to: '/reviews', label: t('dashboard.statPending'), value: inbox.data?.total ?? null, icon: ClipboardCheck },
    { to: '/notifications', label: t('dashboard.statUnread'), value: unread.data?.unread ?? null, icon: Bell },
  ];

  const healthy = health.isSuccess;

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('dashboard.title')}
        description={t('dashboard.subtitle')}
        actions={
          <>
            <span className="meta me-2 hidden items-center gap-2 md:inline-flex">
              <span className={cn('h-2 w-2 rounded-full', healthy ? 'bg-success' : health.isError ? 'bg-danger' : 'bg-ink-4')} aria-hidden />
              {healthy ? t('dashboard.backendOk') : health.isError ? t('dashboard.backendDown') : t('common.loading')}
            </span>
            <Link to="/kbs?new=1" className="btn-primary">
              <Plus size={16} />
              {t('kb.create')}
            </Link>
          </>
        }
      />

      <section className="surface grid grid-cols-2 overflow-hidden lg:grid-cols-4" aria-label={t('dashboard.title')}>
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              to={stat.to}
              className={cn(
                'group flex flex-col gap-4 px-5 py-4 transition-colors hover:bg-surface-muted',
                index > 0 && 'border-s border-line',
                index > 1 && 'border-t border-line lg:border-t-0',
              )}
            >
              <span className="flex items-center gap-2 text-[13px] text-ink-3">
                <Icon size={15} strokeWidth={1.75} aria-hidden />
                {stat.label}
              </span>
              {stat.value === null ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <span className="text-[26px] font-bold leading-none tabular-nums">{formatFaNumber(stat.value)}</span>
              )}
            </Link>
          );
        })}
      </section>

      {kbs.isError && <InlineError message={t('common.error')} onRetry={() => void kbs.refetch()} />}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {!kbs.isPending && !hasKbs ? (
            <section className="surface">
              <EmptyState
                icon={BookOpenText}
                title={t('dashboard.noKbs')}
                hint={t('dashboard.noKbsHint')}
                action={
                  <Link to="/kbs?new=1" className="btn-primary">
                    <Plus size={16} />
                    {t('kb.create')}
                  </Link>
                }
              />
            </section>
          ) : (
            <SectionCard title={t('dashboard.recentUpdates')} to="/kbs" linkLabel={t('dashboard.viewAll')}>
              {articlesLoading && (
                <div className="space-y-3 p-5">
                  <Skeleton className="h-11" />
                  <Skeleton className="h-11" />
                  <Skeleton className="h-11" />
                </div>
              )}
              {!articlesLoading && latest.length === 0 && (
                <EmptyState icon={FileText} title={t('dashboard.noRecentUpdates')} hint={t('dashboard.noRecentUpdatesHint')} />
              )}
              {latest.length > 0 && (
                <ul className="divide-y divide-line">
                  {latest.map((article) => {
                    const kb = kbById.get(article.knowledgeBaseId);
                    return (
                      <li key={article.id}>
                        <Link
                          to={`/kbs/${kb?.slug ?? ''}/articles/${article.slug}`}
                          className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-muted"
                        >
                          <span className={cn('tile h-9 w-9 text-[14px]', kbTileClass(kb?.slug ?? ''))} aria-hidden>
                            {(kb?.title ?? '؟').trim().charAt(0)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span dir="auto" className="block truncate text-[14px] font-semibold">
                              {article.title}
                            </span>
                            <span className="meta block truncate">{kb?.title}</span>
                          </span>
                          <span className="hidden sm:block">
                            <ArticleStatusBadge status={article.status} />
                          </span>
                          <span className="meta hidden w-24 shrink-0 text-end md:block">{formatFaRelative(article.updatedAt)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>
          )}
        </div>

        <div className="space-y-6">
          <SectionCard title={t('dashboard.pendingReviews')} to="/reviews" linkLabel={t('dashboard.viewAll')}>
            {inbox.isPending && (
              <div className="space-y-3 p-5">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            )}
            {inbox.isError && <p className="p-5 text-[13px] text-danger">{t('common.error')}</p>}
            {inbox.data && inbox.data.items.length === 0 && (
              <EmptyState icon={ClipboardCheck} title={t('dashboard.noPendingReviews')} hint={t('dashboard.noPendingReviewsHint')} />
            )}
            {inbox.data && inbox.data.items.length > 0 && (
              <ul className="divide-y divide-line">
                {inbox.data.items.map((r) => (
                  <li key={r.id}>
                    <Link to={`/kbs/${r.kbSlug}/articles/${r.articleSlug}`} className="block px-5 py-3 transition-colors hover:bg-surface-muted">
                      <span dir="auto" className="block truncate text-[14px] font-semibold">
                        {r.articleTitle}
                      </span>
                      <span className="meta mt-0.5 flex items-center justify-between gap-3">
                        <span className="truncate">{r.kbTitle}</span>
                        <span className="shrink-0">{formatFaRelative(r.createdAt)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {inFlight.data && inFlight.data.total > 0 && (
              <p className="border-t border-line px-5 py-3 text-[13px] text-ink-3">
                {t('dashboard.statInFlight')}: {formatFaNumber(inFlight.data.total)}
              </p>
            )}
          </SectionCard>

          <SectionCard title={t('dashboard.activity')} to="/notifications" linkLabel={t('dashboard.viewAll')}>
            {notifications.isPending && (
              <div className="space-y-3 p-5">
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
              </div>
            )}
            {notifications.data && notifications.data.items.length === 0 && (
              <EmptyState icon={Bell} title={t('dashboard.noActivity')} hint={t('dashboard.noActivityHint')} />
            )}
            {notifications.data && notifications.data.items.length > 0 && (
              <ul className="divide-y divide-line">
                {notifications.data.items.map((n) => (
                  <li key={n.id} className="flex items-start gap-3 px-5 py-3">
                    <span className={cn('mt-2 h-2 w-2 shrink-0 rounded-full', n.isRead ? 'bg-ink-4/40' : 'bg-accent')} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-[13.5px] leading-6', !n.isRead && 'font-semibold')}>{n.title}</span>
                      <span className="meta block">{formatFaRelative(n.createdAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        {hasKbs && (
          <section className="xl:col-span-3" aria-label={t('dashboard.recentKbs')}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="section-title">{t('dashboard.recentKbs')}</h2>
              <Link to="/kbs" className="text-[13px] font-medium text-accent hover:underline">
                {t('dashboard.viewAll')}
              </Link>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {kbList.slice(0, 6).map((kb) => (
                <li key={kb.id}>
                  <Link to={`/kbs/${kb.slug}`} className="surface group flex items-center gap-4 p-4 transition-colors hover:border-accent/50">
                    <span className={cn('tile h-11 w-11 text-[17px]', kbTileClass(kb.slug))} aria-hidden>
                      {kb.title.trim().charAt(0) || '؟'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold group-hover:text-accent">{kb.title}</span>
                      <span className="meta mt-1 flex items-center gap-4">
                        <span className="inline-flex items-center gap-1.5">
                          <Users size={13} aria-hidden />
                          {formatFaNumber(kb.memberCount)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <FolderTree size={13} aria-hidden />
                          {formatFaNumber(kb.categoryCount)}
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Archive, Eye, FileEdit, History, Megaphone, RotateCcw, Send, Trash2, Undo2 } from 'lucide-react';
import { t, type I18nKey } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { cn } from '../shared/lib/cn';
import { formatFaDate, formatFaNumber, formatFaRelative } from '../shared/lib/format-fa';
import { useToast } from '../shared/ui/Toast';
import { Avatar, Breadcrumbs, type Crumb } from '../shared/ui/Chrome';
import { Button } from '../shared/ui/Button';
import { ConfirmDialog } from '../shared/ui/Dialog';
import { Badge, TagChip, type Tone } from '../shared/ui/Badge';
import { EmptyState, InlineError, Skeleton } from '../shared/ui/Feedback';
import { ArticleViewer } from '../features/articles/components/ArticleViewer';
import { ArticleStatusBadge } from '../features/articles/components/ArticleStatusBadge';
import { headingOutline } from '../features/articles/outline';
import { AttachmentsCard } from '../features/documents/AttachmentsCard';
import { HistoryCard } from '../features/article-versions/HistoryCard';
import { SubmitReviewDialog } from '../features/approval/SubmitReviewDialog';
import { useArticleReviews, useCancelReview } from '../features/approval/hooks';
import { useMe } from '../features/auth/hooks';
import {
  useArchiveArticle,
  useArticle,
  useDeleteArticle,
  usePublishArticle,
  useRelatedArticles,
  useRestoreArticle,
  useUnpublishArticle,
} from '../features/articles/hooks';
import { useKb, useKbMembers } from '../features/knowledge-bases/hooks';

const reviewTone: Record<string, Tone> = { pending: 'warn', approved: 'success', rejected: 'danger', cancelled: 'neutral' };

export function ArticleViewPage(): JSX.Element {
  const { kbId = '', articleId = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const kb = useKb(kbId);
  const article = useArticle(kbId, articleId);
  const related = useRelatedArticles(kbId, articleId);
  const members = useKbMembers(kbId);
  const publish = usePublishArticle(kbId, articleId);
  const unpublish = useUnpublishArticle(kbId, articleId);
  const archive = useArchiveArticle(kbId, articleId);
  const restore = useRestoreArticle(kbId, articleId);
  const del = useDeleteArticle(kbId);
  const me = useMe();
  const reviews = useArticleReviews(kbId, articleId);
  const cancelReview = useCancelReview(kbId, articleId);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const role = kb.data?.role ?? null;
  const canWrite = role === 'manager' || role === 'contributor' || role === 'org-admin';
  const canManage = role === 'manager' || role === 'org-admin';
  const a = article.data;
  const outline = useMemo(() => (a ? headingOutline(a.contentJson) : []), [a]);

  if (article.isPending) {
    return (
      <div className="mx-auto max-w-[44rem] space-y-6 pt-6">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-72" />
      </div>
    );
  }
  if (article.isError || !a) {
    return <InlineError message={toApiMessage(article.error, t('common.error'))} onRetry={() => void article.refetch()} />;
  }

  const meId = me.data?.user.id ?? null;
  const pendingReview = reviews.data?.find((r) => r.status === 'pending') ?? null;
  const canCancelReview = pendingReview !== null && (pendingReview.requesterId === meId || canManage);
  const author = members.data?.find((m) => m.userId === a.authorId) ?? null;
  const crumbs: Crumb[] = [
    { label: t('nav.knowledgeBases'), to: '/kbs' },
    ...(kb.data ? [{ label: kb.data.title, to: `/kbs/${kbId}` }] : []),
    { label: t('article.listTitle'), to: `/kbs/${kbId}/articles` },
  ];

  async function run(promise: Promise<unknown>, ok: string): Promise<void> {
    try {
      await promise;
      toast.success(ok);
    } catch (err) {
      toast.error(toApiMessage(err, t('common.error')));
    }
  }

  async function onDelete(): Promise<void> {
    try {
      await del.mutateAsync(a!.id);
      toast.success(t('article.deletedToast'));
      navigate(`/kbs/${kbId}/articles`, { replace: true });
    } catch (err) {
      toast.error(toApiMessage(err, t('common.error')));
      setConfirmDelete(false);
    }
  }

  function jumpTo(index: number): void {
    const headings = bodyRef.current?.querySelectorAll('h2, h3');
    headings?.item(index)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const statusHint =
    a.status === 'draft' ? t('article.draftHint') : a.status === 'in_review' ? t('article.inReviewHint') : null;

  return (
    <div className="grid gap-12 pb-8 lg:grid-cols-[minmax(0,1fr)_15rem]">
      <article className="min-w-0 max-w-[44rem]">
        <Breadcrumbs items={crumbs} className="mb-6 md:hidden" />

        <header className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <ArticleStatusBadge status={a.status} />
            <span className="meta">{t('article.versionLabel', { version: formatFaNumber(a.version) })}</span>
            <span className="meta flex items-center gap-1.5">
              <Eye size={14} aria-hidden />
              {t('article.readerCount', { count: formatFaNumber(a.viewCount) })}
            </span>
          </div>
          <h1 dir="auto" className="text-[32px] font-bold leading-[1.5] tracking-normal text-ink">
            {a.title}
          </h1>
          {a.summary ? (
            <p dir="auto" className="text-[17px] leading-9 text-ink-2">
              {a.summary}
            </p>
          ) : (
            <p className="meta">{t('article.noSummary')}</p>
          )}
          {a.tagNames.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {a.tagNames.map((tagName) => (
                <TagChip key={tagName}>{tagName}</TagChip>
              ))}
            </div>
          )}
        </header>

        {(canWrite || canManage) && (
          <div className="mt-6 flex flex-wrap items-center gap-2 border-y border-line py-3">
            {canWrite && (
              <Link to={`/kbs/${kbId}/articles/${a.slug}/edit`} className="btn-secondary btn-sm">
                <FileEdit size={15} />
                {t('common.edit')}
              </Link>
            )}
            {canWrite && a.status === 'draft' && (
              <Button variant="primary" size="sm" onClick={() => setSubmitOpen(true)}>
                <Send size={15} />
                {t('review.submit')}
              </Button>
            )}
            {canManage && a.status !== 'published' && a.status !== 'archived' && (
              <Button variant="secondary" size="sm" disabled={publish.isPending} onClick={() => void run(publish.mutateAsync(), t('article.publishedToast'))}>
                <Megaphone size={15} />
                {t('article.publish')}
              </Button>
            )}
            {canManage && a.status === 'published' && (
              <Button variant="secondary" size="sm" disabled={unpublish.isPending} onClick={() => void run(unpublish.mutateAsync(), t('article.unpublishedToast'))}>
                <Undo2 size={15} />
                {t('article.unpublish')}
              </Button>
            )}
            {canManage && a.status !== 'archived' && (
              <Button variant="secondary" size="sm" disabled={archive.isPending} onClick={() => void run(archive.mutateAsync(), t('article.archivedToast'))}>
                <Archive size={15} />
                {t('article.archive')}
              </Button>
            )}
            {canManage && a.status === 'archived' && (
              <Button variant="secondary" size="sm" disabled={restore.isPending} onClick={() => void run(restore.mutateAsync(), t('article.restoredToast'))}>
                <RotateCcw size={15} />
                {t('article.restore')}
              </Button>
            )}
            {canManage && (
              <Button variant="ghost" size="sm" className="ms-auto text-ink-3 hover:text-danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={15} />
                {t('kb.delete')}
              </Button>
            )}
          </div>
        )}

        {statusHint && !pendingReview && <p className="meta mt-4">{statusHint}</p>}

        {pendingReview && (
          <div className="mt-6 rounded-card border border-warn/30 bg-warn-soft p-5">
            <p className="text-[14px] font-semibold text-warn">{t('review.pendingTitle')}</p>
            {pendingReview.comment && <p className="mt-1.5 text-[13.5px] leading-7 text-ink-2">{pendingReview.comment}</p>}
            {canCancelReview && (
              <Button
                variant="secondary"
                size="sm"
                disabled={cancelReview.isPending}
                onClick={() => void run(cancelReview.mutateAsync(pendingReview.id), t('review.cancelledToast'))}
                className="mt-4"
              >
                {t('review.cancel')}
              </Button>
            )}
          </div>
        )}

        <div ref={bodyRef} className="mt-10">
          <ArticleViewer content={a.contentJson} />
        </div>

        <div className="mt-14 space-y-6">
          <AttachmentsCard kbId={kbId} articleId={articleId} canWrite={canWrite} />
          <HistoryCard kbId={kbId} articleId={articleId} canWrite={canWrite} />

          {reviews.data && reviews.data.length > 0 && (
            <section className="surface overflow-hidden" aria-label={t('review.historyTitle')}>
              <div className="panel-head">
                <History size={16} className="text-ink-3" aria-hidden />
                <h2 className="section-title">{t('review.historyTitle')}</h2>
              </div>
              <ul className="divide-y divide-line">
                {reviews.data.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3 text-[13.5px]">
                    <Badge tone={reviewTone[r.status] ?? 'neutral'} dot>
                      {t(`review.status_${r.status}` as I18nKey)}
                    </Badge>
                    {r.comment && <span className="min-w-0 flex-1 truncate text-ink-2">{r.comment}</span>}
                    <span className="meta ms-auto">{formatFaDate(r.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {related.data && related.data.length > 0 && (
            <section className="surface overflow-hidden" aria-label={t('article.related')}>
              <div className="panel-head">
                <h2 className="section-title">{t('article.related')}</h2>
              </div>
              <ul className="divide-y divide-line">
                {related.data.map((r) => (
                  <li key={r.id}>
                    <Link
                      to={`/kbs/${kbId}/articles/${r.slug}`}
                      dir="auto"
                      className="flex items-center justify-between gap-3 px-5 py-3 text-[14px] font-medium transition-colors hover:bg-surface-muted hover:text-accent"
                    >
                      <span className="min-w-0 truncate">{r.title}</span>
                      <ArticleStatusBadge status={r.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {related.data && related.data.length === 0 && (
            <EmptyState icon={FileEdit} title={t('article.related')} hint={t('article.noRelatedHint')} className="surface" />
          )}
        </div>

        <SubmitReviewDialog kbId={kbId} articleId={articleId} open={submitOpen} onClose={() => setSubmitOpen(false)} />
        <ConfirmDialog
          open={confirmDelete}
          title={t('kb.delete')}
          body={t('article.deleteConfirm', { title: a.title })}
          confirmLabel={t('kb.delete')}
          danger
          pending={del.isPending}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => void onDelete()}
        />
      </article>

      <aside className="space-y-10 lg:sticky lg:top-24 lg:self-start">
        <section className="space-y-3" aria-label={t('article.author')}>
          <p className="meta">{t('article.author')}</p>
          <div className="flex items-center gap-3">
            <Avatar name={author?.fullName ?? '؟'} />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold">{author?.fullName ?? t('article.authorUnknown')}</p>
              {author && <p dir="ltr" className="truncate text-start text-[12px] text-ink-3">{author.email}</p>}
            </div>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 pt-2 text-[13px]">
            <dt className="text-ink-3">{t('article.lastEdited')}</dt>
            <dd title={formatFaDate(a.updatedAt)}>{formatFaRelative(a.updatedAt)}</dd>
            {a.publishedAt && (
              <>
                <dt className="text-ink-3">{t('article.statusLabel')}</dt>
                <dd>{t('article.publishedOn', { date: formatFaDate(a.publishedAt) })}</dd>
              </>
            )}
          </dl>
        </section>

        {outline.length >= 2 && (
          <nav aria-label={t('article.tocTitle')} className="space-y-3">
            <p className="meta">{t('article.tocTitle')}</p>
            <ol className="space-y-1 border-s border-line">
              {outline.map((item, index) =>
                item.text ? (
                  <li key={index}>
                    <button
                      type="button"
                      onClick={() => jumpTo(index)}
                      className={cn(
                        'block w-full truncate py-1 text-start text-[13px] leading-6 text-ink-3 transition-colors hover:text-accent',
                        item.level === 2 ? 'ps-4 font-medium text-ink-2' : 'ps-7',
                      )}
                    >
                      {item.text}
                    </button>
                  </li>
                ) : null,
              )}
            </ol>
          </nav>
        )}
      </aside>
    </div>
  );
}

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Archive,
  Eye,
  FileEdit,
  History,
  Megaphone,
  RotateCcw,
  Send,
  Trash2,
  Undo2,
} from 'lucide-react';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { useToast } from '../shared/ui/Toast';
import { PageHeader } from '../shared/ui/Chrome';
import { Button } from '../shared/ui/Button';
import { ConfirmDialog } from '../shared/ui/Dialog';
import { Badge, TagChip } from '../shared/ui/Badge';
import { EmptyState, InlineError, Skeleton } from '../shared/ui/Feedback';
import { ArticleViewer } from '../features/articles/components/ArticleViewer';
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
import { useKb } from '../features/knowledge-bases/hooks';
import { formatFaDate, formatFaNumber } from '../shared/lib/format-fa';

const statusTone = { draft: 'slate', in_review: 'amber', published: 'green', archived: 'blue' } as const;

export function ArticleViewPage(): JSX.Element {
  const { kbId = '', articleId = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const kb = useKb(kbId);
  const article = useArticle(kbId, articleId);
  const related = useRelatedArticles(kbId, articleId);
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

  const role = kb.data?.role ?? null;
  const canWrite = role === 'manager' || role === 'contributor' || role === 'org-admin';
  const canManage = role === 'manager' || role === 'org-admin';

  const statusLabel: Record<string, string> = {
    draft: t('article.status_draft'),
    in_review: t('article.status_in_review'),
    published: t('article.status_published'),
    archived: t('article.status_archived'),
  };
  const reviewStatusLabel: Record<string, string> = {
    pending: t('review.status_pending'),
    approved: t('review.status_approved'),
    rejected: t('review.status_rejected'),
    cancelled: t('review.status_cancelled'),
  };

  if (article.isPending) {
    return (
      <section className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-9 w-3/4" />
        <div className="surface p-8"><Skeleton className="h-64" /></div>
      </section>
    );
  }
  if (article.isError || !article.data) {
    return (
      <section className="mx-auto max-w-3xl">
        <InlineError message={toApiMessage(article.error, t('common.error'))} onRetry={() => void article.refetch()} />
      </section>
    );
  }

  const a = article.data;
  const meId = me.data?.user.id ?? null;
  const pendingReview = reviews.data?.find((r) => r.status === 'pending') ?? null;
  const canCancelReview = pendingReview !== null && (pendingReview.requesterId === meId || canManage);

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
      await del.mutateAsync(a.id);
      toast.success(t('article.deletedToast'));
      navigate(`/kbs/${kbId}/articles`, { replace: true });
    } catch (err) {
      toast.error(toApiMessage(err, t('common.error')));
      setConfirmDelete(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title={a.title}
        breadcrumbs={[
          { label: t('nav.knowledgeBases'), to: '/kbs' },
          ...(kb.data ? [{ label: kb.data.title, to: `/kbs/${kbId}` }] : []),
          { label: t('article.listTitle'), to: `/kbs/${kbId}/articles` },
          { label: a.title },
        ]}
        actions={
          <>
            {canWrite && (
              <Link to={`/kbs/${kbId}/articles/${a.slug}/edit`} className="btn-secondary btn-sm">
                <FileEdit size={15} />
                {t('common.edit')}
              </Link>
            )}
            {canManage && (
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} className="text-rose-600 hover:text-rose-700 dark:text-rose-400">
                <Trash2 size={15} />
                {t('kb.delete')}
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Badge tone={statusTone[a.status as keyof typeof statusTone] ?? 'slate'}>
          {statusLabel[a.status] ?? a.status}
        </Badge>
        <span className="meta">{t('article.versionLabel', { version: formatFaNumber(a.version) })}</span>
        <span className="meta flex items-center gap-1">
          <Eye size={13} />
          {formatFaNumber(a.viewCount)} {t('article.views')}
        </span>
        <span className="meta">{formatFaDate(a.updatedAt)}</span>
      </div>

      {a.summary && (
        <p className="border-s-2 border-brand-400 ps-4 text-[15px] leading-8 text-slate-600 dark:text-slate-300">
          {a.summary}
        </p>
      )}

      {a.tagNames.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {a.tagNames.map((tagName) => (
            <TagChip key={tagName}>{tagName}</TagChip>
          ))}
        </div>
      )}

      {(canWrite || canManage) && (
        <div className="surface flex flex-wrap items-center gap-2 p-3">
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
        </div>
      )}

      <article className="surface px-6 py-7 sm:px-9">
        <ArticleViewer content={a.contentJson} />
      </article>

      <AttachmentsCard kbId={kbId} articleId={articleId} canWrite={canWrite} />
      <HistoryCard kbId={kbId} articleId={articleId} canWrite={canWrite} />

      {pendingReview && (
        <div className="surface border-amber-300 bg-amber-50/60 p-5 dark:border-amber-800 dark:bg-amber-950/40">
          <p className="text-sm font-bold">{t('review.pendingTitle')}</p>
          {pendingReview.comment && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{pendingReview.comment}</p>}
          {canCancelReview && (
            <Button variant="secondary" size="sm" disabled={cancelReview.isPending} onClick={() => void run(cancelReview.mutateAsync(pendingReview.id), t('review.cancelledToast'))} className="mt-3">
              {t('review.cancel')}
            </Button>
          )}
        </div>
      )}

      {reviews.data && reviews.data.length > 0 && (
        <section className="surface overflow-hidden" aria-label={t('review.historyTitle')}>
          <div className="hairline-b flex items-center gap-2 px-5 py-3.5">
            <History size={16} className="text-slate-400" />
            <h2 className="section-title">{t('review.historyTitle')}</h2>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {reviews.data.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-5 py-2.5 text-sm">
                <Badge tone={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'rose' : r.status === 'cancelled' ? 'slate' : 'amber'}>
                  {reviewStatusLabel[r.status] ?? r.status}
                </Badge>
                {r.comment && <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">{r.comment}</span>}
                <span className="meta ms-auto">{formatFaDate(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {related.data && related.data.length > 0 && (
        <section className="surface overflow-hidden" aria-label={t('article.related')}>
          <div className="hairline-b px-5 py-3.5">
            <h2 className="section-title">{t('article.related')}</h2>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {related.data.map((r) => (
              <li key={r.id}>
                <Link to={`/kbs/${kbId}/articles/${r.slug}`} className="block px-5 py-2.5 text-sm font-medium transition-colors hover:bg-slate-50 hover:text-brand-700 dark:hover:bg-slate-800/40 dark:hover:text-brand-200">
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {related.data && related.data.length === 0 && (
        <EmptyState icon={FileEdit} title={t('article.related')} hint={t('article.noRelatedHint')} />
      )}

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
    </section>
  );
}

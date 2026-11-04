import { Link, useNavigate, useParams } from 'react-router-dom';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { ArticleViewer } from '../features/articles/components/ArticleViewer';
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

export function ArticleViewPage(): JSX.Element {
  const { kbId = '', articleId = '' } = useParams();
  const navigate = useNavigate();
  const kb = useKb(kbId);
  const article = useArticle(kbId, articleId);
  const related = useRelatedArticles(kbId, articleId);
  const publish = usePublishArticle(kbId, articleId);
  const unpublish = useUnpublishArticle(kbId, articleId);
  const archive = useArchiveArticle(kbId, articleId);
  const restore = useRestoreArticle(kbId, articleId);
  const del = useDeleteArticle(kbId);

  const role = kb.data?.role ?? null;
  const canWrite = role === 'manager' || role === 'contributor' || role === 'org-admin';
  const canManage = role === 'manager' || role === 'org-admin';

  const statusLabel: Record<string, string> = {
    draft: t('article.status_draft'),
    in_review: t('article.status_in_review'),
    published: t('article.status_published'),
    archived: t('article.status_archived'),
  };

  if (article.isPending) return <p className="py-16 text-center text-sm text-slate-500">{t('common.loading')}</p>;
  if (article.isError || !article.data) {
    return <p className="py-16 text-center text-sm text-red-600">{toApiMessage(article.error, t('common.error'))}</p>;
  }

  const a = article.data;

  async function onDelete(): Promise<void> {
    await del.mutateAsync(a.id);
    navigate(`/kbs/${kbId}/articles`, { replace: true });
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <Link to={`/kbs/${kbId}/articles`} className="text-sm text-brand-600 underline">
        {t('article.backToArticles')}
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{a.title}</h1>
            <p className="mt-1 text-xs text-slate-500">
              {statusLabel[a.status] ?? a.status} · v{a.version} · {t('article.views')}: {a.viewCount}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canWrite && (
              <Link
                to={`/kbs/${kbId}/articles/${a.slug}/edit`}
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm dark:border-slate-700"
              >
                {t('common.edit')}
              </Link>
            )}
            {canManage && a.status !== 'published' && a.status !== 'archived' && (
              <button
                type="button"
                disabled={publish.isPending}
                onClick={() => void publish.mutateAsync()}
                className="rounded-lg bg-brand-500 px-3 py-1 text-sm font-semibold text-white"
              >
                {t('article.publish')}
              </button>
            )}
            {canManage && a.status === 'published' && (
              <button
                type="button"
                disabled={unpublish.isPending}
                onClick={() => void unpublish.mutateAsync()}
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm dark:border-slate-700"
              >
                {t('article.unpublish')}
              </button>
            )}
            {canManage && a.status !== 'archived' && (
              <button
                type="button"
                disabled={archive.isPending}
                onClick={() => void archive.mutateAsync()}
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm dark:border-slate-700"
              >
                {t('article.archive')}
              </button>
            )}
            {canManage && a.status === 'archived' && (
              <button
                type="button"
                disabled={restore.isPending}
                onClick={() => void restore.mutateAsync()}
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm dark:border-slate-700"
              >
                {t('article.restore')}
              </button>
            )}
            {canManage && (
              <button
                type="button"
                disabled={del.isPending}
                onClick={() => void onDelete()}
                className="rounded-lg border border-red-300 px-3 py-1 text-sm text-red-600 dark:border-red-900"
              >
                {t('kb.delete')}
              </button>
            )}
          </div>
        </div>
        {a.summary && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{a.summary}</p>}
        {a.tagNames.length > 0 && <p className="mt-2 text-xs text-slate-500">{a.tagNames.join('، ')}</p>}
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
        <ArticleViewer content={a.contentJson} />
      </div>

      {related.data && related.data.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold">{t('article.related')}</h2>
          <ul className="mt-2 space-y-1">
            {related.data.map((r) => (
              <li key={r.id}>
                <Link to={`/kbs/${kbId}/articles/${r.slug}`} className="text-sm text-brand-600 hover:underline">
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

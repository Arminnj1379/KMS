import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { useKb } from '../features/knowledge-bases/hooks';
import { useArticles, useDeleteArticle, useKbTags } from '../features/articles/hooks';

const STATUS_OPTIONS = ['', 'draft', 'in_review', 'published', 'archived'];

export function ArticleListPage(): JSX.Element {
  const { kbId = '' } = useParams();
  const kb = useKb(kbId);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [tag, setTag] = useState('');
  const list = useArticles(kbId, {
    ...(status ? { status } : {}),
    ...(appliedSearch ? { search: appliedSearch } : {}),
    ...(tag ? { tag } : {}),
    sort: 'newest',
    pageSize: 20,
  });
  const tags = useKbTags(kbId);
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

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to={`/kbs/${kbId}`} className="text-sm text-brand-600 underline">
            {t('kb.backToList')}
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{t('article.listTitle')}</h1>
        </div>
        {canWrite && (
          <Link
            to={`/kbs/${kbId}/articles/new`}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
          >
            {t('article.create')}
          </Link>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setAppliedSearch(search);
        }}
        className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('article.searchPh')}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === '' ? t('article.allStatuses') : (statusLabel[s] ?? s)}
            </option>
          ))}
        </select>
        <select
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
        >
          <option value="">{t('article.allTags')}</option>
          {(tags.data ?? []).map((tg) => (
            <option key={tg.id} value={tg.slug}>
              {tg.name} ({tg.articleCount})
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm dark:border-slate-700"
        >
          {t('article.searchBtn')}
        </button>
      </form>

      {list.isPending && <p className="text-sm text-slate-500">{t('common.loading')}</p>}
      {list.isError && <p className="text-sm text-red-600">{toApiMessage(list.error, t('common.error'))}</p>}
      {list.data && list.data.items.length === 0 && <p className="text-sm text-slate-500">{t('common.empty')}</p>}
      {list.data && list.data.items.length > 0 && (
        <ul className="space-y-3">
          {list.data.items.map((a) => (
            <li
              key={a.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link to={`/kbs/${kbId}/articles/${a.slug}`} className="font-semibold hover:underline">
                    {a.title}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">
                    <span dir="ltr">{a.slug}</span> · {statusLabel[a.status] ?? a.status} · v{a.version}
                  </p>
                  {a.summary && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{a.summary}</p>}
                  {a.tagNames.length > 0 && (
                    <p className="mt-2 text-xs text-slate-500">{a.tagNames.join('، ')}</p>
                  )}
                </div>
                {canManage && (
                  <button
                    type="button"
                    disabled={del.isPending}
                    onClick={() => void del.mutateAsync(a.id)}
                    className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-600 dark:border-red-900"
                  >
                    {t('kb.delete')}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { useSearch } from '../features/search/hooks';
import { useKbs } from '../features/knowledge-bases/hooks';

const STATUS_OPTIONS = ['', 'draft', 'in_review', 'published', 'archived'];
const SORT_OPTIONS = ['relevance', 'newest', 'updated'] as const;

function useDebounced(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export function SearchPage(): JSX.Element {
  const [input, setInput] = useState('');
  const [kbId, setKbId] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<(typeof SORT_OPTIONS)[number]>('relevance');
  const [page, setPage] = useState(1);
  const debounced = useDebounced(input, 300);

  const kbs = useKbs();
  const result = useSearch({
    q: debounced,
    ...(kbId ? { kbId } : {}),
    ...(status ? { status } : {}),
    sort,
    page,
    pageSize: 20,
  });

  // New query/filters restart from page 1 (page itself excluded to avoid loops).
  useEffect(() => {
    setPage(1);
  }, [debounced, kbId, status, sort]);

  const statusLabel: Record<string, string> = {
    draft: t('article.status_draft'),
    in_review: t('article.status_in_review'),
    published: t('article.status_published'),
    archived: t('article.status_archived'),
  };
  const sortLabel: Record<string, string> = {
    relevance: t('search.sort_relevance'),
    newest: t('search.sort_newest'),
    updated: t('search.sort_updated'),
  };

  const totalPages = result.data ? Math.max(1, Math.ceil(result.data.total / result.data.pageSize)) : 1;

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">{t('search.title')}</h1>

      <form
        onSubmit={(e) => e.preventDefault()}
        className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('search.placeholder')}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
        />
        <select
          value={kbId}
          onChange={(e) => setKbId(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
        >
          <option value="">{t('search.allKbs')}</option>
          {(kbs.data ?? []).map((kb) => (
            <option key={kb.id} value={kb.slug}>
              {kb.title}
            </option>
          ))}
        </select>
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
          value={sort}
          onChange={(e) => setSort(e.target.value as (typeof SORT_OPTIONS)[number])}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {sortLabel[s] ?? s}
            </option>
          ))}
        </select>
      </form>

      {debounced.trim().length > 0 && debounced.trim().length < 2 && (
        <p className="text-sm text-slate-500">{t('search.minLength')}</p>
      )}
      {result.isPending && debounced.trim().length >= 2 && (
        <p className="text-sm text-slate-500">{t('common.loading')}</p>
      )}
      {result.isError && <p className="text-sm text-red-600">{toApiMessage(result.error, t('common.error'))}</p>}
      {result.data && result.data.items.length === 0 && (
        <p className="text-sm text-slate-500">{t('common.empty')}</p>
      )}

      {result.data && result.data.items.length > 0 && (
        <>
          <p className="text-xs text-slate-500">
            {t('search.resultCount').replace('{count}', String(result.data.total))}
            {result.data.mode === 'regex' ? ` · ${t('search.fallbackNote')}` : ''}
          </p>
          <ul className="space-y-3">
            {result.data.items.map((hit) => (
              <li
                key={hit.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <Link to={`/kbs/${hit.kbSlug}/articles/${hit.slug}`} className="font-semibold hover:underline">
                  {hit.title}
                </Link>
                <p className="mt-1 text-xs text-slate-500">
                  {hit.kbTitle} · {statusLabel[hit.status] ?? hit.status}
                </p>
                {hit.snippet && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{hit.snippet}</p>}
                {hit.tagNames.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">{hit.tagNames.join('، ')}</p>
                )}
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-slate-700"
              >
                {t('search.prev')}
              </button>
              <span className="text-xs text-slate-500">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-slate-700"
              >
                {t('search.next')}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

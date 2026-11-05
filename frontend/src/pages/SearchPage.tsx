import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search, SearchX } from 'lucide-react';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { PageHeader } from '../shared/ui/Chrome';
import { Button } from '../shared/ui/Button';
import { Select, TextInput } from '../shared/ui/Field';
import { Badge, TagChip } from '../shared/ui/Badge';
import { EmptyState, InlineError, Skeleton } from '../shared/ui/Feedback';
import { useSearch } from '../features/search/hooks';
import { useKbs } from '../features/knowledge-bases/hooks';
import { formatFaNumber } from '../shared/lib/format-fa';

const STATUS_OPTIONS = ['', 'draft', 'in_review', 'published', 'archived'];
const SORT_OPTIONS = ['relevance', 'newest', 'updated'] as const;

const statusTone = { draft: 'slate', in_review: 'amber', published: 'green', archived: 'blue' } as const;

function useDebounced(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export function SearchPage(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(params.get('q') ?? '');
  const [kbId, setKbId] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<(typeof SORT_OPTIONS)[number]>('relevance');
  const [page, setPage] = useState(1);
  const debounced = useDebounced(input, 300);

  // Header search lands here with ?q= — adopt it once per param change.
  useEffect(() => {
    const q = params.get('q') ?? '';
    setInput((prev) => (prev === q ? prev : q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const kbs = useKbs();
  const trimmed = debounced.trim();
  const result = useSearch({
    q: trimmed,
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
  const active = trimmed.length >= 2;

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <PageHeader title={t('search.title')} description={t('search.desc')} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setParams(input.trim() ? { q: input.trim() } : {});
        }}
        className="surface space-y-3 p-4"
        role="search"
      >
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <TextInput
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('search.placeholder')}
            aria-label={t('search.placeholder')}
            className="h-11 ps-9 text-[15px]"
            autoFocus
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={kbId} onChange={(e) => setKbId(e.target.value)} className="w-auto" aria-label={t('search.allKbs')}>
            <option value="">{t('search.allKbs')}</option>
            {(kbs.data ?? []).map((kb) => (
              <option key={kb.id} value={kb.slug}>
                {kb.title}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto" aria-label={t('article.allStatuses')}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === '' ? t('article.allStatuses') : (statusLabel[s] ?? s)}
              </option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as (typeof SORT_OPTIONS)[number])} className="w-auto" aria-label={t('search.sortLabel')}>
            {SORT_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {sortLabel[s] ?? s}
              </option>
            ))}
          </Select>
        </div>
      </form>

      {trimmed.length > 0 && trimmed.length < 2 && <p className="meta">{t('search.minLength')}</p>}
      {result.isPending && active && (
        <div className="space-y-2.5">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      )}
      {result.isError && active && <InlineError message={toApiMessage(result.error, t('common.error'))} onRetry={() => void result.refetch()} />}
      {result.data && active && result.data.items.length === 0 && (
        <div className="surface">
          <EmptyState icon={SearchX} title={t('search.noResults')} hint={t('search.noResultsHint')} />
        </div>
      )}

      {!active && trimmed.length === 0 && (
        <div className="surface">
          <EmptyState icon={Search} title={t('search.idleTitle')} hint={t('search.idleHint')} />
        </div>
      )}

      {result.data && result.data.items.length > 0 && (
        <>
          <p className="meta">
            {t('search.resultCount', { count: formatFaNumber(result.data.total) })}
            {result.data.mode === 'regex' ? ` · ${t('search.fallbackNote')}` : ''}
          </p>
          <ul className="surface divide-y overflow-hidden" style={{ borderColor: 'var(--line)' }}>
            {result.data.items.map((hit) => (
              <li key={hit.id} className="px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/kbs/${hit.kbSlug}/articles/${hit.slug}`} className="text-[15px] font-bold hover:text-brand-700 dark:hover:text-brand-200">
                    {hit.title}
                  </Link>
                  <Badge tone={statusTone[hit.status as keyof typeof statusTone] ?? 'slate'}>
                    {statusLabel[hit.status] ?? hit.status}
                  </Badge>
                </div>
                <p className="meta mt-1">{hit.kbTitle}</p>
                {hit.snippet && <p className="mt-1.5 line-clamp-2 text-[13px] leading-7 text-slate-600 dark:text-slate-300">{hit.snippet}</p>}
                {hit.tagNames.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {hit.tagNames.map((tagName) => (
                      <TagChip key={tagName}>{tagName}</TagChip>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronRight size={15} />
                {t('search.prev')}
              </Button>
              <span className="meta tabular-nums">
                {formatFaNumber(page)} / {formatFaNumber(totalPages)}
              </span>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                {t('search.next')}
                <ChevronLeft size={15} />
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

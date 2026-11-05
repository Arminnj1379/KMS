import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, SearchX } from 'lucide-react';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { formatFaNumber, formatFaRelative } from '../shared/lib/format-fa';
import { PageHeader } from '../shared/ui/Chrome';
import { Select, TextInput } from '../shared/ui/Field';
import { Badge, TagChip } from '../shared/ui/Badge';
import { EmptyState, InlineError, Skeleton } from '../shared/ui/Feedback';
import { Pager } from '../shared/ui/Pager';
import { Segmented, type SegmentOption } from '../shared/ui/Segmented';
import { ArticleStatusBadge, articleStatusLabel } from '../features/articles/components/ArticleStatusBadge';
import { useSearch } from '../features/search/hooks';
import { useKbs } from '../features/knowledge-bases/hooks';

const STATUS_OPTIONS = ['', 'draft', 'in_review', 'published', 'archived'];
const PAGE_SIZE = 20;

type SortValue = 'relevance' | 'newest' | 'updated';

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
  const [kbSlug, setKbSlug] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<SortValue>('relevance');
  const [page, setPage] = useState(1);
  const debounced = useDebounced(input, 300);
  const kbs = useKbs();

  // Header search lands here with ?q= — adopt it once per param change.
  useEffect(() => {
    const q = params.get('q') ?? '';
    setInput((prev) => (prev === q ? prev : q));
  }, [params]);

  const trimmed = debounced.trim();
  const active = trimmed.length >= 2;
  const result = useSearch({
    q: trimmed,
    ...(kbSlug ? { kbId: kbSlug } : {}),
    ...(status ? { status } : {}),
    sort,
    page,
    pageSize: PAGE_SIZE,
  });

  // New query or filters restart from the first page.
  useEffect(() => {
    setPage(1);
  }, [debounced, kbSlug, status, sort]);

  const totalPages = result.data ? Math.max(1, Math.ceil(result.data.total / result.data.pageSize)) : 1;
  const sortOptions: SegmentOption<SortValue>[] = [
    { value: 'relevance', label: t('search.sort_relevance') },
    { value: 'newest', label: t('search.sort_newest') },
    { value: 'updated', label: t('search.sort_updated') },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t('search.title')} description={t('search.desc')} />

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setParams(input.trim() ? { q: input.trim() } : {});
        }}
        className="surface space-y-4 p-4 sm:p-5"
      >
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-ink-4" aria-hidden />
          <TextInput
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('search.placeholder')}
            aria-label={t('search.placeholder')}
            className="input-lg ps-11"
            autoFocus
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={kbSlug}
            onChange={(e) => setKbSlug(e.target.value)}
            className="h-9 w-auto min-w-44 text-[13px]"
            aria-label={t('search.allKbs')}
          >
            <option value="">{t('search.allKbs')}</option>
            {(kbs.data ?? []).map((kb) => (
              <option key={kb.id} value={kb.slug}>
                {kb.title}
              </option>
            ))}
          </Select>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 w-auto min-w-36 text-[13px]"
            aria-label={t('article.allStatuses')}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === '' ? t('article.allStatuses') : articleStatusLabel(s)}
              </option>
            ))}
          </Select>
          <Segmented label={t('search.sortLabel')} value={sort} onChange={setSort} options={sortOptions} className="ms-auto" />
        </div>
      </form>

      {trimmed.length === 1 && <p className="meta px-1">{t('search.minLength')}</p>}

      {!active && trimmed.length === 0 && (
        <section className="surface">
          <EmptyState icon={Search} title={t('search.idleTitle')} hint={t('search.idleHint')} />
        </section>
      )}

      {active && result.isPending && (
        <section className="surface divide-y divide-line overflow-hidden" aria-label={t('common.loading')}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-3 px-5 py-4">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3.5 w-4/5" />
            </div>
          ))}
        </section>
      )}

      {active && result.isError && (
        <InlineError message={toApiMessage(result.error, t('common.error'))} onRetry={() => void result.refetch()} />
      )}

      {active && result.data && result.data.items.length === 0 && (
        <section className="surface">
          <EmptyState icon={SearchX} title={t('search.noResults')} hint={t('search.noResultsHint')} />
        </section>
      )}

      {active && result.data && result.data.items.length > 0 && (
        <div className="space-y-4">
          <p className="meta flex items-center gap-2 px-1">
            {t('search.resultCount', { count: formatFaNumber(result.data.total) })}
            {result.data.mode === 'regex' && <Badge tone="neutral">{t('search.fallbackNote')}</Badge>}
          </p>
          <ul className="surface divide-y divide-line overflow-hidden">
            {result.data.items.map((hit) => (
              <li key={hit.id}>
                <Link to={`/kbs/${hit.kbSlug}/articles/${hit.slug}`} className="group block px-5 py-4 transition-colors hover:bg-surface-muted">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span dir="auto" className="min-w-0 text-[15px] font-semibold group-hover:text-accent">
                      {hit.title}
                    </span>
                    <ArticleStatusBadge status={hit.status} />
                  </div>
                  <p className="meta mt-1 flex flex-wrap items-center gap-x-3 text-[12.5px]">
                    <span>{hit.kbTitle}</span>
                    <span>{formatFaRelative(hit.updatedAt)}</span>
                  </p>
                  {hit.snippet && (
                    <p dir="auto" className="mt-2 line-clamp-2 text-[14px] leading-7 text-ink-2">
                      {hit.snippet}
                    </p>
                  )}
                  {hit.tagNames.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {hit.tagNames.map((tagName) => (
                        <TagChip key={tagName}>{tagName}</TagChip>
                      ))}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          <Pager page={page} totalPages={totalPages} onPage={setPage} />
        </div>
      )}
    </div>
  );
}

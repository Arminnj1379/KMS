import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FileText, Plus, Search, Trash2 } from 'lucide-react';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { formatFaDate, formatFaNumber, formatFaRelative } from '../shared/lib/format-fa';
import { useToast } from '../shared/ui/Toast';
import { PageHeader } from '../shared/ui/Chrome';
import { Button } from '../shared/ui/Button';
import { ConfirmDialog } from '../shared/ui/Dialog';
import { Select, TextInput } from '../shared/ui/Field';
import { TagChip } from '../shared/ui/Badge';
import { EmptyState, InlineError, Skeleton } from '../shared/ui/Feedback';
import { Pager } from '../shared/ui/Pager';
import { Segmented } from '../shared/ui/Segmented';
import { useKb } from '../features/knowledge-bases/hooks';
import { useArticles, useDeleteArticle, useKbTags } from '../features/articles/hooks';
import { ArticleStatusBadge, articleStatusLabel } from '../features/articles/components/ArticleStatusBadge';

const STATUSES = ['', 'draft', 'in_review', 'published', 'archived'] as const;
const PAGE_SIZE = 20;

export function ArticleListPage(): JSX.Element {
  const { kbId = '' } = useParams();
  const toast = useToast();
  const kb = useKb(kbId);
  const [status, setStatus] = useState<string>('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [tag, setTag] = useState('');
  const [page, setPage] = useState(1);
  const list = useArticles(kbId, {
    ...(status ? { status } : {}),
    ...(appliedSearch ? { search: appliedSearch } : {}),
    ...(tag ? { tag } : {}),
    sort: 'newest',
    page,
    pageSize: PAGE_SIZE,
  });
  const tags = useKbTags(kbId);
  const del = useDeleteArticle(kbId);
  const [deleting, setDeleting] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setAppliedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const role = kb.data?.role ?? null;
  const canWrite = role === 'manager' || role === 'contributor' || role === 'org-admin';
  const canManage = role === 'manager' || role === 'org-admin';
  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = status !== '' || appliedSearch !== '' || tag !== '';

  function changeStatus(next: string): void {
    setStatus(next);
    setPage(1);
  }

  function changeTag(next: string): void {
    setTag(next);
    setPage(1);
  }

  async function onDelete(): Promise<void> {
    if (!deleting) return;
    try {
      await del.mutateAsync(deleting.id);
      toast.success(t('article.deletedToast'));
      setDeleting(null);
    } catch (err) {
      toast.error(toApiMessage(err, t('common.error')));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('article.listTitle')}
        description={list.data ? t('article.listCount', { count: formatFaNumber(total) }) : undefined}
        breadcrumbs={[
          { label: t('nav.knowledgeBases'), to: '/kbs' },
          ...(kb.data ? [{ label: kb.data.title, to: `/kbs/${kbId}` }] : []),
        ]}
        actions={
          canWrite ? (
            <Link to={`/kbs/${kbId}/articles/new`} className="btn-primary">
              <Plus size={16} />
              {t('article.create')}
            </Link>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Segmented
          label={t('article.allStatuses')}
          value={status}
          onChange={changeStatus}
          options={STATUSES.map((s) => ({ value: s, label: s === '' ? t('article.allStatuses') : articleStatusLabel(s) }))}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 sm:w-64">
            <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-4" aria-hidden />
            <TextInput
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('article.searchPh')}
              aria-label={t('article.searchPh')}
              className="ps-9"
            />
          </div>
          <Select value={tag} onChange={(e) => changeTag(e.target.value)} className="sm:w-48" aria-label={t('article.allTags')}>
            <option value="">{t('article.allTags')}</option>
            {(tags.data ?? []).map((tg) => (
              <option key={tg.id} value={tg.slug}>
                {tg.name} ({formatFaNumber(tg.articleCount)})
              </option>
            ))}
          </Select>
        </div>
      </div>

      {list.isPending && (
        <section className="surface divide-y divide-line overflow-hidden" aria-label={t('common.loading')}>
          <div className="space-y-3 p-5">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        </section>
      )}
      {list.isError && <InlineError message={toApiMessage(list.error, t('common.error'))} onRetry={() => void list.refetch()} />}

      {list.data && list.data.items.length === 0 && (
        <section className="surface">
          {filtered ? (
            <EmptyState icon={Search} title={t('article.emptyFilteredTitle')} hint={t('article.emptyFilteredHint')} />
          ) : (
            <EmptyState
              icon={FileText}
              title={t('article.emptyTitle')}
              hint={t('article.emptyHint')}
              action={
                canWrite ? (
                  <Link to={`/kbs/${kbId}/articles/new`} className="btn-primary">
                    <Plus size={16} />
                    {t('article.create')}
                  </Link>
                ) : undefined
              }
            />
          )}
        </section>
      )}

      {list.data && list.data.items.length > 0 && (
        <section className="surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="tbl min-w-[760px]">
              <thead>
                <tr>
                  <th>{t('article.colTitle')}</th>
                  <th>{t('article.colStatus')}</th>
                  <th>{t('article.colVersion')}</th>
                  <th>{t('article.colTags')}</th>
                  <th>{t('article.colUpdated')}</th>
                  <th>
                    <span className="sr-only">{t('kb.delete')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((a) => (
                  <tr key={a.id}>
                    <td className="max-w-md">
                      <Link to={`/kbs/${kbId}/articles/${a.slug}`} dir="auto" className="block truncate font-semibold hover:text-accent">
                        {a.title}
                      </Link>
                      {a.summary && <span dir="auto" className="meta mt-0.5 block truncate">{a.summary}</span>}
                    </td>
                    <td>
                      <ArticleStatusBadge status={a.status} />
                    </td>
                    <td className="tabular-nums text-ink-3">{formatFaNumber(a.version)}</td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        {a.tagNames.slice(0, 3).map((name) => (
                          <TagChip key={name}>{name}</TagChip>
                        ))}
                        {a.tagNames.length > 3 && <span className="meta">+{formatFaNumber(a.tagNames.length - 3)}</span>}
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-ink-3" title={formatFaDate(a.updatedAt)}>
                      {formatFaRelative(a.updatedAt)}
                    </td>
                    <td className="text-end">
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-ink-4 hover:text-danger"
                          onClick={() => setDeleting({ id: a.id, title: a.title })}
                          aria-label={t('kb.delete')}
                          title={t('kb.delete')}
                        >
                          <Trash2 size={15} />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Pager page={page} totalPages={totalPages} onPage={setPage} />

      <ConfirmDialog
        open={deleting !== null}
        title={t('kb.delete')}
        body={t('article.deleteConfirm', { title: deleting?.title ?? '' })}
        confirmLabel={t('kb.delete')}
        danger
        pending={del.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => void onDelete()}
      />
    </div>
  );
}

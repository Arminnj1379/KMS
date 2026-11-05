import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FileText, Plus, Search, Trash2 } from 'lucide-react';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { useToast } from '../shared/ui/Toast';
import { PageHeader } from '../shared/ui/Chrome';import { Button } from '../shared/ui/Button';
import { ConfirmDialog } from '../shared/ui/Dialog';
import { Select, TextInput } from '../shared/ui/Field';
import { Badge, TagChip } from '../shared/ui/Badge';
import { EmptyState, InlineError, Skeleton } from '../shared/ui/Feedback';
import { useKb } from '../features/knowledge-bases/hooks';
import { useArticles, useDeleteArticle, useKbTags } from '../features/articles/hooks';
import { formatFaDate, formatFaNumber } from '../shared/lib/format-fa';

const STATUS_OPTIONS = ['', 'draft', 'in_review', 'published', 'archived'];

const statusTone = { draft: 'slate', in_review: 'amber', published: 'green', archived: 'blue' } as const;

export function ArticleListPage(): JSX.Element {
  const { kbId = '' } = useParams();
  const toast = useToast();
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
  const [deleting, setDeleting] = useState<{ id: string; title: string } | null>(null);

  const role = kb.data?.role ?? null;
  const canWrite = role === 'manager' || role === 'contributor' || role === 'org-admin';
  const canManage = role === 'manager' || role === 'org-admin';

  const statusLabel: Record<string, string> = {
    draft: t('article.status_draft'),
    in_review: t('article.status_in_review'),
    published: t('article.status_published'),
    archived: t('article.status_archived'),
  };

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
    <section className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title={t('article.listTitle')}
        description={kb.data?.title}
        breadcrumbs={[
          { label: t('nav.knowledgeBases'), to: '/kbs' },
          ...(kb.data ? [{ label: kb.data.title, to: `/kbs/${kbId}` }] : []),
          { label: t('article.listTitle') },
        ]}
        actions={
          canWrite ? (
            <Link to={`/kbs/${kbId}/articles/new`} className="btn-primary btn-sm">
              <Plus size={15} />
              {t('article.create')}
            </Link>
          ) : undefined
        }
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setAppliedSearch(search);
        }}
        className="surface flex flex-wrap items-center gap-2 p-3"
        role="search"
      >
        <div className="relative min-w-0 flex-1 basis-48">
          <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('article.searchPh')}
            aria-label={t('article.searchPh')}
            className="ps-9"
          />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto" aria-label={t('article.allStatuses')}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === '' ? t('article.allStatuses') : (statusLabel[s] ?? s)}
            </option>
          ))}
        </Select>
        <Select value={tag} onChange={(e) => setTag(e.target.value)} className="w-auto" aria-label={t('article.allTags')}>
          <option value="">{t('article.allTags')}</option>
          {(tags.data ?? []).map((tg) => (
            <option key={tg.id} value={tg.slug}>
              {tg.name} ({formatFaNumber(tg.articleCount)})
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary" size="sm">
          {t('article.searchBtn')}
        </Button>
      </form>

      {list.isPending && (
        <div className="space-y-2.5">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      )}
      {list.isError && <InlineError message={toApiMessage(list.error, t('common.error'))} onRetry={() => void list.refetch()} />}
      {list.data && list.data.items.length === 0 && (
        <div className="surface">
          <EmptyState
            icon={FileText}
            title={t('article.emptyTitle')}
            hint={t('article.emptyHint')}
            action={
              canWrite ? (
                <Link to={`/kbs/${kbId}/articles/new`} className="btn-primary btn-sm">
                  <Plus size={15} />
                  {t('article.create')}
                </Link>
              ) : undefined
            }
          />
        </div>
      )}
      {list.data && list.data.items.length > 0 && (
        <ul className="surface divide-y overflow-hidden" style={{ borderColor: 'var(--line)' }}>
          {list.data.items.map((a) => (
            <li key={a.id} className="group flex items-start gap-3 px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/kbs/${kbId}/articles/${a.slug}`} className="truncate text-[15px] font-bold hover:text-brand-700 dark:hover:text-brand-200">
                    {a.title}
                  </Link>
                  <Badge tone={statusTone[a.status as keyof typeof statusTone] ?? 'slate'}>
                    {statusLabel[a.status] ?? a.status}
                  </Badge>
                </div>
                {a.summary && <p className="mt-1 line-clamp-2 text-[13px] leading-6 text-slate-500 dark:text-slate-400">{a.summary}</p>}
                <p className="meta mt-1.5">
                  {t('article.versionLabel', { version: formatFaNumber(a.version) })} · {formatFaDate(a.updatedAt)}
                </p>
                {a.tagNames.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {a.tagNames.map((tagName) => (
                      <TagChip key={tagName}>{tagName}</TagChip>
                    ))}
                  </div>
                )}
              </div>
              {canManage && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-slate-400 opacity-0 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100 dark:hover:text-rose-400"
                  onClick={() => setDeleting({ id: a.id, title: a.title })}
                  aria-label={t('kb.delete')}
                  title={t('kb.delete')}
                >
                  <Trash2 size={15} />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
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
    </section>
  );
}

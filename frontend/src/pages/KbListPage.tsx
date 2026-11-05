import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpenText, FolderTree, Globe, Lock, Plus, Search, Users } from 'lucide-react';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { cn } from '../shared/lib/cn';
import { formatFaNumber } from '../shared/lib/format-fa';
import { useToast } from '../shared/ui/Toast';
import { PageHeader } from '../shared/ui/Chrome';
import { Button } from '../shared/ui/Button';
import { Dialog, DialogFooter } from '../shared/ui/Dialog';
import { Field, Select, Textarea, TextInput } from '../shared/ui/Field';
import { EmptyState, InlineError, SkeletonCard } from '../shared/ui/Feedback';
import { Badge } from '../shared/ui/Badge';
import { Segmented } from '../shared/ui/Segmented';
import { useCreateKb, useKbs } from '../features/knowledge-bases/hooks';
import { kbSchema, type KbInput } from '../features/knowledge-bases/schemas';
import type { Kb } from '../features/knowledge-bases/api';
import { kbTileClass } from '../features/knowledge-bases/tone';

const visibilityMeta = {
  private: { icon: Lock, tone: 'neutral', label: 'kb.visShortPrivate' },
  internal: { icon: Users, tone: 'accent', label: 'kb.visShortInternal' },
  public: { icon: Globe, tone: 'success', label: 'kb.visShortPublic' },
} as const;

type VisibilityFilter = 'all' | 'internal' | 'private' | 'public';

function visibilityOf(kb: Kb): keyof typeof visibilityMeta {
  return kb.visibility === 'private' || kb.visibility === 'public' ? kb.visibility : 'internal';
}

function KbCard({ kb }: { kb: Kb }): JSX.Element {
  const meta = visibilityMeta[visibilityOf(kb)];
  const VisIcon = meta.icon;
  return (
    <Link to={`/kbs/${kb.slug}`} className="surface group flex flex-col gap-5 p-5 transition-colors hover:border-accent/50">
      <div className="flex items-start gap-3.5">
        <span className={cn('tile h-12 w-12 text-[18px]', kbTileClass(kb.slug))} aria-hidden>
          {kb.title.trim().charAt(0) || '؟'}
        </span>
        <div className="min-w-0 flex-1">
          <h2 dir="auto" className="truncate text-[15.5px] font-bold leading-7 group-hover:text-accent">
            {kb.title}
          </h2>
          <p dir="ltr" className="truncate text-start font-mono text-[12px] leading-5 text-ink-4">
            {kb.slug}
          </p>
        </div>
      </div>
      <p dir="auto" className="line-clamp-2 min-h-12 text-[13.5px] leading-6 text-ink-3">
        {kb.description || t('kb.noDescription')}
      </p>
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4">
        <span className="meta flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <Users size={14} aria-hidden />
            {formatFaNumber(kb.memberCount)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <FolderTree size={14} aria-hidden />
            {formatFaNumber(kb.categoryCount)}
          </span>
        </span>
        <Badge tone={meta.tone} className="gap-1.5">
          <VisIcon size={12} aria-hidden />
          {t(meta.label)}
        </Badge>
      </div>
    </Link>
  );
}

export function KbListPage(): JSX.Element {
  const kbs = useKbs();
  const create = useCreateKb();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [visibility, setVisibility] = useState<VisibilityFilter>('all');
  const form = useForm<KbInput>({
    resolver: zodResolver(kbSchema),
    defaultValues: { visibility: 'internal' },
  });
  const errors = form.formState.errors;

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const list = kbs.data ?? [];
  const counts = useMemo(
    () => ({
      all: list.length,
      internal: list.filter((kb) => visibilityOf(kb) === 'internal').length,
      private: list.filter((kb) => visibilityOf(kb) === 'private').length,
      public: list.filter((kb) => visibilityOf(kb) === 'public').length,
    }),
    [list],
  );
  const needle = query.trim().toLowerCase();
  const filtered = list.filter((kb) => {
    if (visibility !== 'all' && visibilityOf(kb) !== visibility) return false;
    if (needle.length === 0) return true;
    return [kb.title, kb.slug, kb.description ?? ''].some((field) => field.toLowerCase().includes(needle));
  });

  async function onSubmit(values: KbInput): Promise<void> {
    try {
      await create.mutateAsync(values);
      toast.success(t('kb.createdToast'));
      form.reset({ visibility: 'internal' });
      setOpen(false);
    } catch (err) {
      toast.error(toApiMessage(err, t('common.error')));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.knowledgeBases')}
        description={t('kb.listDesc')}
        actions={
          <Button variant="primary" onClick={() => setOpen(true)}>
            <Plus size={16} />
            {t('kb.create')}
          </Button>
        }
      />

      {list.length > 0 && (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Segmented
            label={t('kb.visibility')}
            value={visibility}
            onChange={setVisibility}
            options={[
              { value: 'all', label: t('kb.visibilityAll'), count: counts.all },
              { value: 'internal', label: t('kb.visShortInternal'), count: counts.internal },
              { value: 'private', label: t('kb.visShortPrivate'), count: counts.private },
              { value: 'public', label: t('kb.visShortPublic'), count: counts.public },
            ]}
          />
          <div className="relative w-full md:w-72">
            <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-4" aria-hidden />
            <TextInput
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('kb.searchPh')}
              aria-label={t('kb.searchPh')}
              className="ps-9"
            />
          </div>
        </div>
      )}

      {kbs.isPending && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}
      {kbs.isError && <InlineError message={toApiMessage(kbs.error, t('common.error'))} onRetry={() => void kbs.refetch()} />}

      {kbs.data && list.length === 0 && (
        <section className="surface">
          <EmptyState
            icon={BookOpenText}
            title={t('dashboard.noKbs')}
            hint={t('dashboard.noKbsHint')}
            action={
              <Button variant="primary" onClick={() => setOpen(true)}>
                <Plus size={16} />
                {t('kb.create')}
              </Button>
            }
          />
        </section>
      )}

      {list.length > 0 && filtered.length === 0 && (
        <section className="surface">
          <EmptyState icon={Search} title={t('kb.noMatch')} />
        </section>
      )}

      {filtered.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((kb) => (
            <li key={kb.id}>
              <KbCard kb={kb} />
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} title={t('kb.create')} description={t('kb.createDesc')} onClose={() => setOpen(false)}>
        <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="space-y-5" noValidate>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('kb.title')} error={errors.title?.message}>
              <TextInput {...form.register('title')} aria-invalid={!!errors.title} />
            </Field>
            <Field label={t('kb.slug')} error={errors.slug?.message}>
              <TextInput dir="ltr" {...form.register('slug')} aria-invalid={!!errors.slug} />
            </Field>
          </div>
          <Field label={t('kb.description')}>
            <Textarea rows={3} {...form.register('description')} />
          </Field>
          <Field label={t('kb.visibility')}>
            <Select {...form.register('visibility')}>
              <option value="internal">{t('kb.visibilityInternal')}</option>
              <option value="private">{t('kb.visibilityPrivate')}</option>
              <option value="public">{t('kb.visibilityPublic')}</option>
            </Select>
          </Field>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={create.isPending}>
              {t('kb.createSubmit')}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}

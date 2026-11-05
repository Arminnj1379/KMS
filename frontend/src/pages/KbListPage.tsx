import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { BookOpenText, Globe, Lock, Plus, Users } from 'lucide-react';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { useToast } from '../shared/ui/Toast';
import { PageHeader } from '../shared/ui/Chrome';
import { Button } from '../shared/ui/Button';
import { Dialog } from '../shared/ui/Dialog';
import { Field, Select, Textarea, TextInput } from '../shared/ui/Field';
import { EmptyState, InlineError, SkeletonCard } from '../shared/ui/Feedback';
import { Badge } from '../shared/ui/Badge';
import { useCreateKb, useKbs } from '../features/knowledge-bases/hooks';
import { kbSchema, type KbInput } from '../features/knowledge-bases/schemas';
import { formatFaNumber } from '../shared/lib/format-fa';

const visibilityIcon = {
  private: Lock,
  internal: Users,
  public: Globe,
} as const;

export function KbListPage(): JSX.Element {
  const kbs = useKbs();
  const create = useCreateKb();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const form = useForm<KbInput>({
    resolver: zodResolver(kbSchema),
    defaultValues: { visibility: 'internal' },
  });
  const errors = form.formState.errors;

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
    <section className="space-y-5">
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

      {kbs.isPending && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}
      {kbs.isError && <InlineError message={toApiMessage(kbs.error, t('common.error'))} onRetry={() => void kbs.refetch()} />}
      {kbs.data && kbs.data.length === 0 && (
        <div className="surface">
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
        </div>
      )}
      {kbs.data && kbs.data.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {kbs.data.map((kb) => {
            const VisIcon = visibilityIcon[kb.visibility as keyof typeof visibilityIcon] ?? Users;
            return (
              <Link key={kb.id} to={`/kbs/${kb.slug}`} className="surface group p-5 transition-shadow hover:shadow-lift">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand-50 text-lg font-bold text-brand-700 dark:bg-brand-900/25 dark:text-brand-200">
                    {kb.title.trim().charAt(0) || '؟'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[15px] font-bold group-hover:text-brand-700 dark:group-hover:text-brand-200">
                      {kb.title}
                    </h2>
                    <p dir="ltr" className="mt-0.5 truncate text-left text-xs text-slate-400">
                      {kb.slug}
                    </p>
                  </div>
                </div>
                {kb.description && <p className="mt-3 line-clamp-2 text-[13px] leading-6 text-slate-500 dark:text-slate-400">{kb.description}</p>}
                <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3" style={{ borderColor: 'var(--line)' }}>
                  <span className="meta">
                    {t('kb.members')}: {formatFaNumber(kb.memberCount)} · {t('kb.categories')}: {formatFaNumber(kb.categoryCount)}
                  </span>
                  <Badge tone={kb.visibility === 'private' ? 'slate' : kb.visibility === 'public' ? 'green' : 'blue'} dot={false}>
                    <VisIcon size={12} />
                    {t(`kb.visibility${kb.visibility.charAt(0).toUpperCase()}${kb.visibility.slice(1)}` as never)}
                  </Badge>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Dialog open={open} title={t('kb.create')} description={t('kb.createDesc')} onClose={() => setOpen(false)}>
        <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('kb.title')} error={errors.title?.message}>
              <TextInput {...form.register('title')} aria-invalid={!!errors.title} />
            </Field>
            <Field label={t('kb.slug')} error={errors.slug?.message}>
              <TextInput dir="ltr" {...form.register('slug')} aria-invalid={!!errors.slug} />
            </Field>
          </div>
          <Field label={t('kb.description')}>
            <Textarea rows={2} {...form.register('description')} />
          </Field>
          <Field label={t('kb.visibility')}>
            <Select {...form.register('visibility')}>
              <option value="internal">{t('kb.visibilityInternal')}</option>
              <option value="private">{t('kb.visibilityPrivate')}</option>
              <option value="public">{t('kb.visibilityPublic')}</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={create.isPending}>
              {t('kb.createSubmit')}
            </Button>
          </div>
        </form>
      </Dialog>
    </section>
  );
}

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { useCreateKb, useKbs } from '../features/knowledge-bases/hooks';
import { kbSchema, type KbInput } from '../features/knowledge-bases/schemas';

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950';

export function KbListPage(): JSX.Element {
  const kbs = useKbs();
  const create = useCreateKb();
  const [open, setOpen] = useState(false);
  const form = useForm<KbInput>({
    resolver: zodResolver(kbSchema),
    defaultValues: { visibility: 'internal' },
  });

  async function onSubmit(values: KbInput): Promise<void> {
    await create.mutateAsync(values);
    form.reset({ visibility: 'internal' });
    setOpen(false);
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('nav.knowledgeBases')}</h1>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
        >
          {t('kb.create')}
        </button>
      </div>

      {open && (
        <form
          onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
          className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900"
        >
          <label className="block text-sm">
            {t('kb.title')}
            <input {...form.register('title')} className={inputClass} />
            {form.formState.errors.title && (
              <span className="text-xs text-red-600">{form.formState.errors.title.message}</span>
            )}
          </label>
          <label className="block text-sm">
            {t('kb.slug')}
            <input {...form.register('slug')} dir="ltr" className={inputClass} />
            {form.formState.errors.slug && (
              <span className="text-xs text-red-600">{form.formState.errors.slug.message}</span>
            )}
          </label>
          <label className="block text-sm sm:col-span-2">
            {t('kb.description')}
            <textarea {...form.register('description')} rows={2} className={inputClass} />
          </label>
          <label className="block text-sm">
            {t('kb.visibility')}
            <select {...form.register('visibility')} className={inputClass}>
              <option value="internal">{t('kb.visibilityInternal')}</option>
              <option value="private">{t('kb.visibilityPrivate')}</option>
              <option value="public">{t('kb.visibilityPublic')}</option>
            </select>
          </label>
          <div className="sm:col-span-2">
            {create.isError && (
              <p className="mb-2 text-sm text-red-600">{toApiMessage(create.error, t('common.error'))}</p>
            )}
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {t('kb.createSubmit')}
            </button>
          </div>
        </form>
      )}

      {kbs.isPending && <p className="text-sm text-slate-500">{t('common.loading')}</p>}
      {kbs.isError && <p className="text-sm text-red-600">{toApiMessage(kbs.error, t('common.error'))}</p>}
      {kbs.data && kbs.data.length === 0 && <p className="text-sm text-slate-500">{t('common.empty')}</p>}
      {kbs.data && kbs.data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kbs.data.map((kb) => (
            <Link
              key={kb.id}
              to={`/kbs/${kb.slug}`}
              className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-brand-400 dark:border-slate-800 dark:bg-slate-900"
            >
              <h2 className="font-semibold">{kb.title}</h2>
              <p dir="ltr" className="mt-1 text-left text-xs text-slate-400">
                {kb.slug} · {kb.visibility}
              </p>
              {kb.description && <p className="mt-2 text-sm text-slate-500">{kb.description}</p>}
              <p className="mt-3 text-xs text-slate-500">
                {t('kb.members')}: {kb.memberCount} · {t('kb.categories')}: {kb.categoryCount}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

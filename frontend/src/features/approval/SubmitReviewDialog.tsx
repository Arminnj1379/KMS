import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { t } from '../../i18n';
import { toApiMessage } from '../../shared/lib/api-client';
import { useKbMembers } from '../knowledge-bases/hooks';
import { useSubmitReview } from './hooks';
import { submitReviewSchema, type SubmitReviewInput } from './schemas';

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950';

/** Assign a KB reviewer/manager and move a draft into review. */
export function SubmitReviewDialog({
  kbId,
  articleId,
  open,
  onClose,
}: {
  kbId: string;
  articleId: string;
  open: boolean;
  onClose: () => void;
}): JSX.Element | null {
  const members = useKbMembers(kbId);
  const submit = useSubmitReview(kbId, articleId);
  const form = useForm<SubmitReviewInput>({ resolver: zodResolver(submitReviewSchema) });

  if (!open) return null;
  const eligible = (members.data ?? []).filter((m) => m.role === 'reviewer' || m.role === 'manager');

  async function onSubmit(values: SubmitReviewInput): Promise<void> {
    await submit.mutateAsync({ reviewerId: values.reviewerId, comment: values.comment || undefined });
    form.reset();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
        className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 dark:bg-slate-900"
      >
        <h2 className="text-base font-semibold">{t('review.submitTitle')}</h2>
        <label className="block text-sm">
          {t('review.reviewer')}
          <select {...form.register('reviewerId')} className={inputClass} disabled={members.isPending}>
            <option value="">{members.isPending ? t('common.loading') : t('review.pickReviewer')}</option>
            {eligible.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.fullName} ({m.email})
              </option>
            ))}
          </select>
          {form.formState.errors.reviewerId && (
            <span className="text-xs text-red-600">{form.formState.errors.reviewerId.message}</span>
          )}
        </label>
        {eligible.length === 0 && !members.isPending && (
          <p className="text-xs text-amber-600">{t('review.noEligibleReviewer')}</p>
        )}
        <label className="block text-sm">
          {t('review.commentOptional')}
          <textarea {...form.register('comment')} rows={2} maxLength={500} className={inputClass} />
          {form.formState.errors.comment && (
            <span className="text-xs text-red-600">{form.formState.errors.comment.message}</span>
          )}
        </label>
        {submit.isError && <p className="text-sm text-red-600">{toApiMessage(submit.error, t('common.error'))}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submit.isPending}
            className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {t('review.submit')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm dark:border-slate-700"
          >
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}

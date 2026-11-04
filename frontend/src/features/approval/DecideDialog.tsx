import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { t } from '../../i18n';
import { toApiMessage } from '../../shared/lib/api-client';
import { decideReviewSchema, type DecideReviewInput } from './schemas';

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950';

/** Shared approve/reject dialog: optional decision note + confirm. */
export function DecideDialog({
  title,
  confirmLabel,
  danger,
  open,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  title: string;
  confirmLabel: string;
  danger?: boolean;
  open: boolean;
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onConfirm: (comment: string | undefined) => Promise<void>;
}): JSX.Element | null {
  const form = useForm<DecideReviewInput>({ resolver: zodResolver(decideReviewSchema) });
  if (!open) return null;

  async function onSubmit(values: DecideReviewInput): Promise<void> {
    await onConfirm(values.comment || undefined);
    form.reset();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
        className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 dark:bg-slate-900"
      >
        <h2 className="text-base font-semibold">{title}</h2>
        <label className="block text-sm">
          {t('review.decisionNote')}
          <textarea {...form.register('comment')} rows={2} maxLength={500} className={inputClass} />
          {form.formState.errors.comment && (
            <span className="text-xs text-red-600">{form.formState.errors.comment.message}</span>
          )}
        </label>
        {error ? <p className="text-sm text-red-600">{toApiMessage(error, t('common.error'))}</p> : null}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className={
              danger
                ? 'rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60'
                : 'rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60'
            }
          >
            {confirmLabel}
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

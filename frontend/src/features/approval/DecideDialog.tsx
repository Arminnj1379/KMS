import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { t } from '../../i18n';
import { toApiMessage } from '../../shared/lib/api-client';
import { Button } from '../../shared/ui/Button';
import { Dialog, DialogFooter } from '../../shared/ui/Dialog';
import { Field, Textarea } from '../../shared/ui/Field';
import { decideReviewSchema, type DecideReviewInput } from './schemas';

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
    <Dialog open={open} title={title} onClose={onClose}>
      <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="space-y-5" noValidate>
        <Field label={t('review.decisionNote')} error={form.formState.errors.comment?.message}>
          <Textarea {...form.register('comment')} rows={3} maxLength={500} />
        </Field>
        {error ? <p className="form-error">{toApiMessage(error, t('common.error'))}</p> : null}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant={danger ? 'danger-solid' : 'primary'} disabled={pending}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

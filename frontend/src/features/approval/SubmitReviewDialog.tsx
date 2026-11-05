import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { t } from '../../i18n';
import { toApiMessage } from '../../shared/lib/api-client';
import { Button } from '../../shared/ui/Button';
import { Dialog, DialogFooter } from '../../shared/ui/Dialog';
import { Field, Select, Textarea } from '../../shared/ui/Field';
import { useKbMembers } from '../knowledge-bases/hooks';
import { useSubmitReview } from './hooks';
import { submitReviewSchema, type SubmitReviewInput } from './schemas';

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
    <Dialog open={open} title={t('review.submitTitle')} description={t('review.submitDesc')} onClose={onClose}>
      <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="space-y-5" noValidate>
        <Field label={t('review.reviewer')} error={form.formState.errors.reviewerId?.message}>
          <Select {...form.register('reviewerId')} disabled={members.isPending} aria-invalid={!!form.formState.errors.reviewerId}>
            <option value="">{members.isPending ? t('common.loading') : t('review.pickReviewer')}</option>
            {eligible.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.fullName} ({m.email})
              </option>
            ))}
          </Select>
        </Field>
        {eligible.length === 0 && !members.isPending && (
          <p className="rounded-control border border-warn/25 bg-warn-soft px-3.5 py-2.5 text-[13px] leading-6 text-warn">
            {t('review.noEligibleReviewer')}
          </p>
        )}
        <Field label={t('review.commentOptional')} error={form.formState.errors.comment?.message}>
          <Textarea {...form.register('comment')} rows={3} maxLength={500} />
        </Field>
        {submit.isError && <p className="form-error">{toApiMessage(submit.error, t('common.error'))}</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={submit.isPending}>
            {t('review.submit')}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

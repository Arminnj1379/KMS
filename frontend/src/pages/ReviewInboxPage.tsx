import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCheck, ClipboardCheck, Inbox } from 'lucide-react';
import { t, type I18nKey } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { formatFaRelative } from '../shared/lib/format-fa';
import { useToast } from '../shared/ui/Toast';
import { PageHeader } from '../shared/ui/Chrome';
import { Button } from '../shared/ui/Button';
import { Badge, type Tone } from '../shared/ui/Badge';
import { EmptyState, InlineError, Skeleton } from '../shared/ui/Feedback';
import { Segmented } from '../shared/ui/Segmented';
import { DecideDialog } from '../features/approval/DecideDialog';
import { useApproveReview, useCancelReview, useRejectReview, useReviewInbox } from '../features/approval/hooks';
import type { ReviewRequest } from '../features/approval/api';

type Tab = 'assigned' | 'mine';

const statusTone: Record<string, Tone> = { pending: 'warn', approved: 'success', rejected: 'danger', cancelled: 'neutral' };

function RequestRow({ r, actions }: { r: ReviewRequest; actions?: React.ReactNode }): JSX.Element {
  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <Link to={`/kbs/${r.kbSlug}/articles/${r.articleSlug}`} dir="auto" className="block truncate text-[14.5px] font-semibold hover:text-accent">
          {r.articleTitle}
        </Link>
        <p className="meta flex flex-wrap items-center gap-x-4 gap-y-0.5">
          <span className="truncate">{r.kbTitle}</span>
          <span>{t('review.requestedAt', { date: formatFaRelative(r.createdAt) })}</span>
        </p>
        {r.comment && <p dir="auto" className="line-clamp-2 pt-1 text-[13.5px] leading-7 text-ink-2">{r.comment}</p>}
        {actions && <div className="flex flex-wrap gap-2 pt-2">{actions}</div>}
      </div>
      <Badge tone={statusTone[r.status] ?? 'neutral'} dot className="shrink-0">
        {t(`review.status_${r.status}` as I18nKey)}
      </Badge>
    </li>
  );
}

export function ReviewInboxPage(): JSX.Element {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('assigned');
  const assigned = useReviewInbox({ role: 'reviewer', status: 'pending', pageSize: 50 });
  const mine = useReviewInbox({ role: 'requester', pageSize: 50 });
  const approve = useApproveReview();
  const reject = useRejectReview();
  const cancel = useCancelReview();
  const [dialog, setDialog] = useState<{ mode: 'approve' | 'reject'; id: string } | null>(null);

  async function onConfirm(comment: string | undefined): Promise<void> {
    if (!dialog) return;
    try {
      if (dialog.mode === 'approve') {
        await approve.mutateAsync({ id: dialog.id, comment });
        toast.success(t('review.approvedToast'));
      } else {
        await reject.mutateAsync({ id: dialog.id, comment });
        toast.success(t('review.rejectedToast'));
      }
      setDialog(null);
    } catch (err) {
      toast.error(toApiMessage(err, t('common.error')));
    }
  }

  async function onCancel(id: string): Promise<void> {
    try {
      await cancel.mutateAsync(id);
      toast.success(t('review.cancelledToast'));
    } catch (err) {
      toast.error(toApiMessage(err, t('common.error')));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('review.inboxTitle')} description={t('review.inboxDesc')} />

      <Segmented
        label={t('review.inboxTitle')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'assigned', label: t('review.tabAssigned'), count: assigned.data?.total },
          { value: 'mine', label: t('review.tabMine'), count: mine.data?.total },
        ]}
      />

      {tab === 'assigned' && (
        <section className="surface overflow-hidden">
          {assigned.isPending && (
            <div className="space-y-3 p-5">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          )}
          {assigned.isError && (
            <div className="p-5">
              <InlineError message={toApiMessage(assigned.error, t('common.error'))} onRetry={() => void assigned.refetch()} />
            </div>
          )}
          {assigned.data && assigned.data.items.length === 0 && (
            <EmptyState icon={ClipboardCheck} title={t('review.noAssigned')} hint={t('review.noAssignedHint')} />
          )}
          {assigned.data && assigned.data.items.length > 0 && (
            <ul className="divide-y divide-line">
              {assigned.data.items.map((r) => (
                <RequestRow
                  key={r.id}
                  r={r}
                  actions={
                    <>
                      <Button variant="primary" size="sm" disabled={approve.isPending} onClick={() => setDialog({ mode: 'approve', id: r.id })}>
                        <CheckCheck size={15} />
                        {t('review.approve')}
                      </Button>
                      <Button variant="danger" size="sm" disabled={reject.isPending} onClick={() => setDialog({ mode: 'reject', id: r.id })}>
                        {t('review.reject')}
                      </Button>
                    </>
                  }
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'mine' && (
        <section className="surface overflow-hidden">
          {mine.isPending && (
            <div className="space-y-3 p-5">
              <Skeleton className="h-16" />
            </div>
          )}
          {mine.isError && (
            <div className="p-5">
              <InlineError message={toApiMessage(mine.error, t('common.error'))} onRetry={() => void mine.refetch()} />
            </div>
          )}
          {mine.data && mine.data.items.length === 0 && (
            <EmptyState icon={Inbox} title={t('review.noMine')} hint={t('review.noMineHint')} />
          )}
          {mine.data && mine.data.items.length > 0 && (
            <ul className="divide-y divide-line">
              {mine.data.items.map((r) => (
                <RequestRow
                  key={r.id}
                  r={r}
                  actions={
                    r.status === 'pending' ? (
                      <Button variant="ghost" size="sm" disabled={cancel.isPending} onClick={() => void onCancel(r.id)}>
                        {t('review.cancel')}
                      </Button>
                    ) : undefined
                  }
                />
              ))}
            </ul>
          )}
        </section>
      )}

      <DecideDialog
        title={dialog?.mode === 'approve' ? t('review.approveTitle') : t('review.rejectTitle')}
        confirmLabel={dialog?.mode === 'approve' ? t('review.approve') : t('review.reject')}
        danger={dialog?.mode === 'reject'}
        open={dialog !== null}
        pending={approve.isPending || reject.isPending}
        error={approve.error ?? reject.error}
        onClose={() => setDialog(null)}
        onConfirm={onConfirm}
      />
    </div>
  );
}

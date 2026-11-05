import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCheck, ClipboardCheck, ClipboardList, Inbox } from 'lucide-react';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { useToast } from '../shared/ui/Toast';
import { PageHeader } from '../shared/ui/Chrome';
import { Button } from '../shared/ui/Button';
import { DecideDialog } from '../features/approval/DecideDialog';
import { Badge } from '../shared/ui/Badge';
import { EmptyState, InlineError, Skeleton } from '../shared/ui/Feedback';
import { useApproveReview, useCancelReview, useRejectReview, useReviewInbox } from '../features/approval/hooks';
import type { ReviewRequest } from '../features/approval/api';
import { formatFaDate } from '../shared/lib/format-fa';

function StatusBadge({ status }: { status: string }): JSX.Element {
  const tone = status === 'approved' ? 'green' : status === 'rejected' ? 'rose' : status === 'cancelled' ? 'slate' : 'amber';
  const labels: Record<string, string> = {
    pending: t('review.status_pending'),
    approved: t('review.status_approved'),
    rejected: t('review.status_rejected'),
    cancelled: t('review.status_cancelled'),
  };
  return <Badge tone={tone}>{labels[status] ?? status}</Badge>;
}

function RequestRow({ r, actions }: { r: ReviewRequest; actions?: React.ReactNode }): JSX.Element {
  return (
    <li className="px-5 py-3.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Link
            to={`/kbs/${r.kbSlug}/articles/${r.articleSlug}`}
            className="block truncate text-sm font-bold hover:text-brand-700 dark:hover:text-brand-200"
          >
            {r.articleTitle}
          </Link>
          <p className="meta mt-0.5 truncate">
            {r.kbTitle} · {formatFaDate(r.createdAt)}
          </p>
        </div>
        <StatusBadge status={r.status} />
      </div>
      {r.comment && <p className="mt-1.5 text-[13px] leading-6 text-slate-600 dark:text-slate-300">{r.comment}</p>}
      {actions && <div className="mt-2.5 flex flex-wrap gap-2">{actions}</div>}
    </li>
  );
}

export function ReviewInboxPage(): JSX.Element {
  const toast = useToast();
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
    <section className="mx-auto max-w-3xl space-y-5">
      <PageHeader title={t('review.inboxTitle')} description={t('review.inboxDesc')} />

      <div className="surface overflow-hidden">
        <div className="hairline-b flex items-center gap-2 px-5 py-3.5">
          <ClipboardCheck size={16} className="text-slate-400" />
          <h2 className="section-title">{t('review.assignedToMe')}</h2>
          {assigned.data && assigned.data.total > 0 && (
            <span className="badge-amber">{assigned.data.total}</span>
          )}
        </div>
        {assigned.isPending && (
          <div className="space-y-2.5 p-5">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
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
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
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
      </div>

      <div className="surface overflow-hidden">
        <div className="hairline-b flex items-center gap-2 px-5 py-3.5">
          <ClipboardList size={16} className="text-slate-400" />
          <h2 className="section-title">{t('review.myRequests')}</h2>
        </div>
        {mine.isPending && (
          <div className="space-y-2.5 p-5">
            <Skeleton className="h-12" />
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
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
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
      </div>

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
    </section>
  );
}

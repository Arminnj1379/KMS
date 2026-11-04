import { useState } from 'react';
import { Link } from 'react-router-dom';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { DecideDialog } from '../features/approval/DecideDialog';
import { useApproveReview, useCancelReview, useRejectReview, useReviewInbox } from '../features/approval/hooks';
import type { ReviewRequest } from '../features/approval/api';

function StatusBadge({ status }: { status: string }): JSX.Element {
  const labels: Record<string, string> = {
    pending: t('review.status_pending'),
    approved: t('review.status_approved'),
    rejected: t('review.status_rejected'),
    cancelled: t('review.status_cancelled'),
  };
  const color =
    status === 'approved'
      ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200'
      : status === 'rejected'
        ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
        : status === 'cancelled'
          ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{labels[status] ?? status}</span>;
}

function RequestRow({
  r,
  actions,
}: {
  r: ReviewRequest;
  actions?: React.ReactNode;
}): JSX.Element {
  return (
    <li className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <Link
            to={`/kbs/${r.kbSlug}/articles/${r.articleSlug}`}
            className="block truncate text-sm font-semibold text-brand-600 hover:underline"
          >
            {r.articleTitle}
          </Link>
          <p className="mt-0.5 text-xs text-slate-500">
            {r.kbTitle} · {new Date(r.createdAt).toLocaleString('fa-IR')}
          </p>
        </div>
        <StatusBadge status={r.status} />
      </div>
      {r.comment && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{r.comment}</p>}
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </li>
  );
}

export function ReviewInboxPage(): JSX.Element {
  const assigned = useReviewInbox({ role: 'reviewer', status: 'pending', pageSize: 50 });
  const mine = useReviewInbox({ role: 'requester', pageSize: 50 });
  const approve = useApproveReview();
  const reject = useRejectReview();
  const cancel = useCancelReview();
  const [dialog, setDialog] = useState<{ mode: 'approve' | 'reject'; id: string } | null>(null);

  async function onConfirm(comment: string | undefined): Promise<void> {
    if (!dialog) return;
    if (dialog.mode === 'approve') await approve.mutateAsync({ id: dialog.id, comment });
    else await reject.mutateAsync({ id: dialog.id, comment });
    setDialog(null);
  }

  const btn =
    'rounded-lg border border-slate-300 px-3 py-1 text-xs dark:border-slate-700 disabled:opacity-60';

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">{t('review.inboxTitle')}</h1>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold">{t('review.assignedToMe')}</h2>
        {assigned.isPending && <p className="mt-2 text-sm text-slate-500">{t('common.loading')}</p>}
        {assigned.isError && (
          <p className="mt-2 text-sm text-red-600">{toApiMessage(assigned.error, t('common.error'))}</p>
        )}
        {assigned.data && assigned.data.items.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">{t('common.empty')}</p>
        )}
        {assigned.data && assigned.data.items.length > 0 && (
          <ul className="mt-3 space-y-3">
            {assigned.data.items.map((r) => (
              <RequestRow
                key={r.id}
                r={r}
                actions={
                  <>
                    <button
                      type="button"
                      disabled={approve.isPending}
                      onClick={() => setDialog({ mode: 'approve', id: r.id })}
                      className="rounded-lg bg-brand-500 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {t('review.approve')}
                    </button>
                    <button
                      type="button"
                      disabled={reject.isPending}
                      onClick={() => setDialog({ mode: 'reject', id: r.id })}
                      className={`${btn} border-red-300 text-red-600 dark:border-red-900`}
                    >
                      {t('review.reject')}
                    </button>
                  </>
                }
              />
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold">{t('review.myRequests')}</h2>
        {mine.isPending && <p className="mt-2 text-sm text-slate-500">{t('common.loading')}</p>}
        {mine.isError && <p className="mt-2 text-sm text-red-600">{toApiMessage(mine.error, t('common.error'))}</p>}
        {mine.data && mine.data.items.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">{t('common.empty')}</p>
        )}
        {mine.data && mine.data.items.length > 0 && (
          <ul className="mt-3 space-y-3">
            {mine.data.items.map((r) => (
              <RequestRow
                key={r.id}
                r={r}
                actions={
                  r.status === 'pending' ? (
                    <button
                      type="button"
                      disabled={cancel.isPending}
                      onClick={() => void cancel.mutateAsync(r.id)}
                      className={btn}
                    >
                      {t('review.cancel')}
                    </button>
                  ) : undefined
                }
              />
            ))}
          </ul>
        )}
      </div>

      {cancel.isError && <p className="text-sm text-red-600">{toApiMessage(cancel.error, t('common.error'))}</p>}

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

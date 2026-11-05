import { useState } from 'react';
import { History, ShieldCheck } from 'lucide-react';
import { t } from '../i18n';
import { toApiMessage } from '../shared/lib/api-client';
import { formatFaDate, formatFaNumber } from '../shared/lib/format-fa';
import { PageHeader } from '../shared/ui/Chrome';
import { Select } from '../shared/ui/Field';
import { Badge } from '../shared/ui/Badge';
import { EmptyState, InlineError, Skeleton } from '../shared/ui/Feedback';
import { Pager } from '../shared/ui/Pager';
import { useMe } from '../features/auth/hooks';
import { useAuditLogs } from '../features/audit/hooks';
import { AUDIT_ACTION_CODES, auditActionLabelKey, auditActionTone } from '../features/audit/labels';

const PAGE_SIZE = 20;

export function ActivityPage(): JSX.Element {
  const me = useMe();
  const isAdmin = me.data?.memberships.some((m) => m.role === 'org-admin') ?? false;
  const [action, setAction] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const list = useAuditLogs({ ...(action ? { action } : {}), page, pageSize: PAGE_SIZE }, isAdmin);

  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (!me.isPending && !isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('activity.title')} />
        <div className="surface flex items-center gap-3 p-5 text-[14px] text-ink-2">
          <ShieldCheck size={18} className="shrink-0 text-warn" aria-hidden />
          {t('admin.forbidden')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('activity.title')}
        description={t('activity.desc', { count: formatFaNumber(total) })}
        actions={
          <Select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className="sm:w-64"
            aria-label={t('activity.allActions')}
          >
            <option value="">{t('activity.allActions')}</option>
            {AUDIT_ACTION_CODES.map((code) => {
              const key = auditActionLabelKey(code);
              return (
                <option key={code} value={code}>
                  {key ? t(key) : code}
                </option>
              );
            })}
          </Select>
        }
      />

      {list.isPending && (
        <div className="surface space-y-3 p-5">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      )}
      {list.isError && <InlineError message={toApiMessage(list.error, t('common.error'))} onRetry={() => void list.refetch()} />}

      {list.data && list.data.items.length === 0 && (
        <section className="surface">
          <EmptyState icon={History} title={t('activity.emptyTitle')} hint={t('activity.emptyHint')} />
        </section>
      )}

      {list.data && list.data.items.length > 0 && (
        <section className="surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="tbl min-w-[760px]">
              <thead>
                <tr>
                  <th>{t('activity.colAction')}</th>
                  <th>{t('activity.resource')}</th>
                  <th>{t('activity.actor')}</th>
                  <th>{t('activity.ip')}</th>
                  <th>{t('activity.colTime')}</th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((row) => {
                  const key = auditActionLabelKey(row.action);
                  return (
                    <tr key={row.id}>
                      <td>
                        <Badge tone={auditActionTone(row.action)}>{key ? t(key) : row.action}</Badge>
                      </td>
                      <td dir="ltr" className="text-start font-mono text-[12.5px] text-ink-3">
                        {row.resourceType} · {row.resourceId.slice(0, 8)}
                      </td>
                      <td dir="ltr" className="text-start font-mono text-[12.5px] text-ink-3">
                        {row.actorId ? row.actorId.slice(0, 8) : '—'}
                      </td>
                      <td dir="ltr" className="text-start font-mono text-[12.5px] text-ink-3">
                        {row.ip ?? '—'}
                      </td>
                      <td className="whitespace-nowrap text-ink-3">{formatFaDate(row.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Pager page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  );
}

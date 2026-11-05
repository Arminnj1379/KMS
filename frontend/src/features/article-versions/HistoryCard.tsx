import { useState } from 'react';
import { GitCompare, History, RotateCcw } from 'lucide-react';
import { t } from '../../i18n';
import { toApiMessage } from '../../shared/lib/api-client';
import { useToast } from '../../shared/ui/Toast';
import { Button } from '../../shared/ui/Button';
import { Select, TextInput } from '../../shared/ui/Field';
import { ConfirmDialog } from '../../shared/ui/Dialog';
import { Skeleton } from '../../shared/ui/Feedback';
import { formatFaDate, formatFaNumber } from '../../shared/lib/format-fa';
import { useSnapshotVersion, useRestoreVersion, useVersionDiff, useVersionDetail, useVersions } from './hooks';

export function HistoryCard({
  kbId,
  articleId,
  canWrite,
}: {
  kbId: string;
  articleId: string;
  canWrite: boolean;
}): JSX.Element {
  const list = useVersions(kbId, articleId);
  const snapshot = useSnapshotVersion(kbId, articleId);
  const restore = useRestoreVersion(kbId, articleId);
  const toast = useToast();
  const [selected, setSelected] = useState<number | null>(null);
  const [diffFrom, setDiffFrom] = useState<number | null>(null);
  const [diffTo, setDiffTo] = useState<number | null>(null);
  const [changelog, setChangelog] = useState('');
  const [restoring, setRestoring] = useState<number | null>(null);
  const detail = useVersionDetail(kbId, articleId, selected);
  const diff = useVersionDiff(kbId, articleId, diffFrom, diffTo);

  async function onSnapshot(): Promise<void> {
    try {
      await snapshot.mutateAsync(changelog.trim() || undefined);
      toast.success(t('version.snapshotToast'));
      setChangelog('');
    } catch (err) {
      toast.error(toApiMessage(err, t('common.error')));
    }
  }

  async function onRestore(version: number): Promise<void> {
    try {
      await restore.mutateAsync({ version, changelog: changelog.trim() || undefined });
      toast.success(t('version.restoredToast'));
      setRestoring(null);
    } catch (err) {
      toast.error(toApiMessage(err, t('common.error')));
    }
  }

  const versions = list.data ?? [];

  return (
    <section className="surface overflow-hidden" aria-label={t('version.title')}>
      <div className="panel-head">
        <History size={16} className="text-ink-3" aria-hidden />
        <h2 className="section-title">{t('version.title')}</h2>
      </div>

      <div className="space-y-6 p-5">
        {canWrite && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <TextInput
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              placeholder={t('version.changelogPh')}
              maxLength={200}
              aria-label={t('version.changelogPh')}
            />
            <Button variant="secondary" disabled={snapshot.isPending} onClick={() => void onSnapshot()} className="shrink-0">
              {t('version.snapshot')}
            </Button>
          </div>
        )}

        {list.isPending && <Skeleton className="h-16" />}
        {list.isError && <p className="text-[13px] text-danger">{toApiMessage(list.error, t('common.error'))}</p>}
        {list.data && versions.length === 0 && <p className="meta">{t('version.empty')}</p>}

        {versions.length > 0 && (
          <ol className="space-y-0 border-s border-line ps-0">
            {versions.map((v) => (
              <li key={v.id} className="relative pb-5 ps-6 last:pb-0">
                <span className="absolute -start-[5px] top-2 h-2.5 w-2.5 rounded-full border-2 border-surface bg-accent" aria-hidden />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <button
                    type="button"
                    onClick={() => setSelected(selected === v.version ? null : v.version)}
                    className="text-start text-[14px] font-semibold hover:text-accent"
                    aria-expanded={selected === v.version}
                  >
                    {t('article.versionLabel', { version: formatFaNumber(v.version) })}
                    <span className="ms-2 font-normal text-ink-2">{v.title}</span>
                  </button>
                  {canWrite && (
                    <Button variant="ghost" size="sm" disabled={restore.isPending} onClick={() => setRestoring(v.version)} className="h-7 px-2 text-[12.5px]">
                      <RotateCcw size={13} />
                      {t('version.restore')}
                    </Button>
                  )}
                </div>
                <p className="meta mt-0.5 flex flex-wrap items-center gap-x-3 text-[12.5px]">
                  {v.changelog && <span className="text-ink-2">{v.changelog}</span>}
                  <span>{formatFaDate(v.createdAt)}</span>
                </p>
                {selected === v.version && (
                  <div className="mt-3 rounded-control bg-surface-muted px-4 py-3 text-[13.5px] leading-7 text-ink-2">
                    {detail.isPending && <p className="meta">{t('common.loading')}</p>}
                    {detail.data && <p dir="auto" className="whitespace-pre-wrap">{detail.data.contentText || t('common.empty')}</p>}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}

        {versions.length >= 2 && (
          <div className="rounded-control border border-line p-4">
            <p className="flex items-center gap-2 text-[13.5px] font-semibold">
              <GitCompare size={15} className="text-ink-3" aria-hidden />
              {t('version.diffTitle')}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Select
                value={diffFrom ?? ''}
                onChange={(e) => setDiffFrom(e.target.value === '' ? null : Number(e.target.value))}
                className="h-9 py-1 text-[13px]"
                aria-label={t('version.from')}
              >
                <option value="">{t('version.from')}</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.version}>
                    {t('article.versionLabel', { version: formatFaNumber(v.version) })}
                  </option>
                ))}
              </Select>
              <Select
                value={diffTo ?? ''}
                onChange={(e) => setDiffTo(e.target.value === '' ? null : Number(e.target.value))}
                className="h-9 py-1 text-[13px]"
                aria-label={t('version.to')}
              >
                <option value="">{t('version.to')}</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.version}>
                    {t('article.versionLabel', { version: formatFaNumber(v.version) })}
                  </option>
                ))}
              </Select>
            </div>
            {diff.data && (
              <div className="mt-3 space-y-1.5 text-[12.5px]" dir="ltr">
                {diff.data.titleChanged && <p className="text-start font-semibold text-ink-2">{t('version.titleChanged')}</p>}
                {diff.data.hunks.length === 0 && <p className="meta text-start">{t('version.diffEmpty')}</p>}
                {diff.data.hunks.map((h, i) => (
                  <pre
                    key={i}
                    className={
                      h.type === 'add'
                        ? 'overflow-x-auto whitespace-pre-wrap rounded bg-success-soft p-2 font-mono text-success'
                        : h.type === 'del'
                          ? 'overflow-x-auto whitespace-pre-wrap rounded bg-danger-soft p-2 font-mono text-danger'
                          : 'overflow-x-auto whitespace-pre-wrap rounded bg-surface-muted p-2 font-mono text-ink-3'
                    }
                  >
                    {h.lines.join('\n')}
                  </pre>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={restoring !== null}
        title={t('version.restore')}
        body={t('version.restoreConfirm', { version: restoring ?? '' })}
        confirmLabel={t('version.restore')}
        pending={restore.isPending}
        onClose={() => setRestoring(null)}
        onConfirm={() => restoring !== null && void onRestore(restoring)}
      />
    </section>
  );
}

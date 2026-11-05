import { useState } from 'react';
import { GitCompare, History, RotateCcw } from 'lucide-react';
import { t } from '../../i18n';
import { toApiMessage } from '../../shared/lib/api-client';
import { useToast } from '../../shared/ui/Toast';
import { Button } from '../../shared/ui/Button';
import { Select, TextInput } from '../../shared/ui/Field';
import { ConfirmDialog } from '../../shared/ui/Dialog';
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
      <div className="hairline-b flex items-center gap-2 px-5 py-3.5">
        <History size={16} className="text-slate-400" />
        <h2 className="section-title">{t('version.title')}</h2>
      </div>
      <div className="space-y-4 p-5">
        {canWrite && (
          <div className="flex gap-2">
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

        {list.isPending && <p className="meta">{t('common.loading')}</p>}
        {list.isError && <p className="text-sm text-rose-600">{toApiMessage(list.error, t('common.error'))}</p>}
        {list.data && versions.length === 0 && <p className="meta">{t('version.empty')}</p>}

        {versions.length > 0 && (
          <ol className="relative space-y-0 border-s ps-0" style={{ borderColor: 'var(--line)' }}>
            {versions.map((v) => (
              <li key={v.id} className="relative pb-4 ps-5 last:pb-0">
                <span className="absolute start-0 top-1.5 h-2 w-2 -translate-x-1/2 rounded-full bg-brand-400 ring-4 ring-brand-50 dark:bg-brand-500 dark:ring-brand-950" aria-hidden />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <button
                    type="button"
                    onClick={() => setSelected(selected === v.version ? null : v.version)}
                    className="text-sm font-bold hover:text-brand-700 dark:hover:text-brand-200"
                    aria-expanded={selected === v.version}
                  >
                    {t('article.versionLabel', { version: formatFaNumber(v.version) })} · {v.title}
                  </button>
                  {canWrite && (
                    <Button variant="ghost" size="sm" disabled={restore.isPending} onClick={() => setRestoring(v.version)} className="h-6 px-2 text-xs">
                      <RotateCcw size={13} />
                      {t('version.restore')}
                    </Button>
                  )}
                </div>
                <p className="meta mt-0.5">
                  {v.changelog ? `${v.changelog} · ` : ''}{formatFaDate(v.createdAt)}
                </p>
                {selected === v.version && (
                  <div className="mt-2 rounded-control bg-slate-50 px-3 py-2 text-[13px] leading-7 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                    {detail.isPending && <p className="meta">{t('common.loading')}</p>}
                    {detail.data && <p className="whitespace-pre-wrap">{detail.data.contentText || t('common.empty')}</p>}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}

        {versions.length >= 2 && (
          <div className="rounded-control border p-3" style={{ borderColor: 'var(--line)' }}>
            <p className="flex items-center gap-1.5 text-[13px] font-semibold">
              <GitCompare size={14} className="text-slate-400" />
              {t('version.diffTitle')}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Select value={diffFrom ?? ''} onChange={(e) => setDiffFrom(e.target.value === '' ? null : Number(e.target.value))} className="h-8 py-1 text-xs" aria-label={t('version.from')}>
                <option value="">{t('version.from')}</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.version}>v{v.version}</option>
                ))}
              </Select>
              <Select value={diffTo ?? ''} onChange={(e) => setDiffTo(e.target.value === '' ? null : Number(e.target.value))} className="h-8 py-1 text-xs" aria-label={t('version.to')}>
                <option value="">{t('version.to')}</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.version}>v{v.version}</option>
                ))}
              </Select>
            </div>
            {diff.data && (
              <div className="mt-2 space-y-1 text-xs" dir="ltr">
                {diff.data.titleChanged && <p className="text-start font-semibold">{t('version.titleChanged')}</p>}
                {diff.data.hunks.map((h, i) => (
                  <pre
                    key={i}
                    className={
                      h.type === 'add'
                        ? 'rounded bg-emerald-50 p-1.5 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                        : h.type === 'del'
                          ? 'rounded bg-rose-50 p-1.5 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                          : 'rounded bg-slate-50 p-1.5 text-slate-500 dark:bg-slate-800'
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

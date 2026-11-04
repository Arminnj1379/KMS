import { useState } from 'react';
import { t } from '../../i18n';
import { toApiMessage } from '../../shared/lib/api-client';
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
  const [selected, setSelected] = useState<number | null>(null);
  const [diffFrom, setDiffFrom] = useState<number | null>(null);
  const [diffTo, setDiffTo] = useState<number | null>(null);
  const [changelog, setChangelog] = useState('');
  const [error, setError] = useState<string | null>(null);
  const detail = useVersionDetail(kbId, articleId, selected);
  const diff = useVersionDiff(kbId, articleId, diffFrom, diffTo);

  async function onSnapshot(): Promise<void> {
    setError(null);
    try {
      await snapshot.mutateAsync(changelog.trim() || undefined);
      setChangelog('');
    } catch (err) {
      setError(toApiMessage(err, t('common.error')));
    }
  }

  async function onRestore(version: number): Promise<void> {
    setError(null);
    try {
      await restore.mutateAsync({ version, changelog: changelog.trim() || undefined });
    } catch (err) {
      setError(toApiMessage(err, t('common.error')));
    }
  }

  const versions = list.data ?? [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-semibold">{t('version.title')}</h2>

      {canWrite && (
        <div className="mt-3 flex gap-2">
          <input
            value={changelog}
            onChange={(e) => setChangelog(e.target.value)}
            placeholder={t('version.changelogPh')}
            maxLength={200}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
          <button
            type="button"
            disabled={snapshot.isPending}
            onClick={() => void onSnapshot()}
            className="shrink-0 rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {t('version.snapshot')}
          </button>
        </div>
      )}

      {list.isPending && <p className="mt-3 text-sm text-slate-500">{t('common.loading')}</p>}
      {list.isError && <p className="mt-3 text-sm text-red-600">{toApiMessage(list.error, t('common.error'))}</p>}
      {list.data && versions.length === 0 && (
        <p className="mt-3 text-sm text-slate-500">{t('version.empty')}</p>
      )}

      {versions.length > 0 && (
        <ul className="mt-3 space-y-2">
          {versions.map((v) => (
            <li
              key={v.id}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
            >
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setSelected(selected === v.version ? null : v.version)}
                  className="font-semibold hover:underline"
                >
                  v{v.version} · {v.title}
                </button>
                {canWrite && (
                  <button
                    type="button"
                    disabled={restore.isPending}
                    onClick={() => void onRestore(v.version)}
                    className="shrink-0 rounded-lg border border-slate-300 px-3 py-1 text-xs dark:border-slate-700"
                  >
                    {t('version.restore')}
                  </button>
                )}
              </div>
              {v.changelog && <p className="mt-1 text-xs text-slate-500">{v.changelog}</p>}
              {selected === v.version && (
                <div className="mt-2 border-t border-slate-200 pt-2 text-xs dark:border-slate-700">
                  {detail.isPending && <p className="text-slate-500">{t('common.loading')}</p>}
                  {detail.data && (
                    <p className="whitespace-pre-wrap text-slate-600 dark:text-slate-300">
                      {detail.data.contentText || t('common.empty')}
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {versions.length >= 2 && (
        <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-700">
          <p className="text-sm font-semibold">{t('version.diffTitle')}</p>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <select
              value={diffFrom ?? ''}
              onChange={(e) => setDiffFrom(e.target.value === '' ? null : Number(e.target.value))}
              className="rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">{t('version.from')}</option>
              {versions.map((v) => (
                <option key={v.id} value={v.version}>
                  v{v.version}
                </option>
              ))}
            </select>
            <span>→</span>
            <select
              value={diffTo ?? ''}
              onChange={(e) => setDiffTo(e.target.value === '' ? null : Number(e.target.value))}
              className="rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">{t('version.to')}</option>
              {versions.map((v) => (
                <option key={v.id} value={v.version}>
                  v{v.version}
                </option>
              ))}
            </select>
          </div>
          {diff.data && (
            <div className="mt-2 space-y-1 text-xs" dir="ltr">
              {diff.data.titleChanged && <p className="font-semibold">{t('version.titleChanged')}</p>}
              {diff.data.hunks.map((h, i) => (
                <pre
                  key={i}
                  className={
                    h.type === 'add'
                      ? 'rounded bg-green-50 p-1 text-green-800 dark:bg-green-950 dark:text-green-200'
                      : h.type === 'del'
                        ? 'rounded bg-red-50 p-1 text-red-800 dark:bg-red-950 dark:text-red-200'
                        : 'rounded bg-slate-50 p-1 text-slate-500 dark:bg-slate-800'
                  }
                >
                  {h.lines.join('\n')}
                </pre>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}

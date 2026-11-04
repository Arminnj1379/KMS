import { useRef, useState } from 'react';
import { t } from '../../i18n';
import { toApiMessage } from '../../shared/lib/api-client';
import { downloadAttachmentBlob } from './api';
import { useAttachments, useDetachAttachment, useUploadAttachment } from './hooks';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentsCard({
  kbId,
  articleId,
  canWrite,
}: {
  kbId: string;
  articleId: string;
  canWrite: boolean;
}): JSX.Element {
  const list = useAttachments(kbId, articleId);
  const upload = useUploadAttachment(kbId, articleId);
  const detach = useDetachAttachment(kbId, articleId);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function onPick(file: File | undefined): Promise<void> {
    if (!file) return;
    setError(null);
    try {
      await upload.mutateAsync(file);
    } catch (err) {
      setError(toApiMessage(err, t('common.error')));
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function onDownload(documentId: string, fallback: string): Promise<void> {
    setError(null);
    setBusyId(documentId);
    try {
      const { blob, filename } = await downloadAttachmentBlob(documentId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || fallback;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(toApiMessage(err, t('common.error')));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t('document.title')}</h2>
        {canWrite && (
          <>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(e) => void onPick(e.target.files?.[0])}
            />
            <button
              type="button"
              disabled={upload.isPending}
              onClick={() => inputRef.current?.click()}
              className="rounded-lg bg-brand-500 px-3 py-1 text-sm font-semibold text-white disabled:opacity-60"
            >
              {upload.isPending ? t('common.loading') : t('document.upload')}
            </button>
          </>
        )}
      </div>

      {list.isPending && <p className="mt-3 text-sm text-slate-500">{t('common.loading')}</p>}
      {list.isError && <p className="mt-3 text-sm text-red-600">{toApiMessage(list.error, t('common.error'))}</p>}
      {list.data && list.data.length === 0 && (
        <p className="mt-3 text-sm text-slate-500">{t('document.empty')}</p>
      )}

      {list.data && list.data.length > 0 && (
        <ul className="mt-3 space-y-2">
          {list.data.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{d.filename}</p>
                <p className="text-xs text-slate-500">
                  {d.mime} · {formatSize(d.sizeBytes)}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={busyId === d.id}
                  onClick={() => void onDownload(d.id, d.filename)}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs dark:border-slate-700"
                >
                  {t('document.download')}
                </button>
                {canWrite && (
                  <button
                    type="button"
                    disabled={detach.isPending}
                    onClick={() => void detach.mutateAsync(d.id)}
                    className="rounded-lg border border-red-300 px-3 py-1 text-xs text-red-600 dark:border-red-900"
                  >
                    {t('document.detach')}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {upload.isError && <p className="mt-3 text-sm text-red-600">{toApiMessage(upload.error, t('common.error'))}</p>}
    </div>
  );
}

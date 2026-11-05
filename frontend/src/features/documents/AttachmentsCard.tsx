import { useRef, useState } from 'react';
import { Download, FileText, Paperclip, Plus, X } from 'lucide-react';
import { t } from '../../i18n';
import { toApiMessage } from '../../shared/lib/api-client';
import { useToast } from '../../shared/ui/Toast';
import { Button } from '../../shared/ui/Button';
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
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function onPick(file: File | undefined): Promise<void> {
    if (!file) return;
    try {
      await upload.mutateAsync(file);
      toast.success(t('document.uploadedToast'));
    } catch (err) {
      toast.error(toApiMessage(err, t('common.error')));
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function onDownload(documentId: string, fallback: string): Promise<void> {
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
      toast.error(toApiMessage(err, t('common.error')));
    } finally {
      setBusyId(null);
    }
  }

  async function onDetach(documentId: string): Promise<void> {
    try {
      await detach.mutateAsync(documentId);
      toast.success(t('document.detachedToast'));
    } catch (err) {
      toast.error(toApiMessage(err, t('common.error')));
    }
  }

  return (
    <section className="surface overflow-hidden" aria-label={t('document.title')}>
      <div className="hairline-b flex items-center gap-2 px-5 py-3.5">
        <Paperclip size={16} className="text-slate-400" />
        <h2 className="section-title">{t('document.title')}</h2>
        {canWrite && (
          <>
            <input ref={inputRef} type="file" className="hidden" onChange={(e) => void onPick(e.target.files?.[0])} aria-hidden tabIndex={-1} />
            <Button variant="secondary" size="sm" disabled={upload.isPending} onClick={() => inputRef.current?.click()} className="ms-auto">
              <Plus size={15} />
              {upload.isPending ? t('common.loading') : t('document.upload')}
            </Button>
          </>
        )}
      </div>

      {list.isPending && <p className="px-5 py-4 text-sm text-slate-500">{t('common.loading')}</p>}
      {list.isError && <p className="px-5 py-4 text-sm text-rose-600">{toApiMessage(list.error, t('common.error'))}</p>}
      {list.data && list.data.length === 0 && (
        <p className="meta px-5 py-4">{t('document.empty')}</p>
      )}

      {list.data && list.data.length > 0 && (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {list.data.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-5 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <FileText size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.filename}</p>
                <p className="meta" dir="ltr">{d.mime} · {formatSize(d.sizeBytes)}</p>
              </div>
              <Button variant="ghost" size="sm" disabled={busyId === d.id} onClick={() => void onDownload(d.id, d.filename)}>
                <Download size={15} />
                {t('document.download')}
              </Button>
              {canWrite && (
                <Button variant="ghost" size="icon-sm" disabled={detach.isPending} onClick={() => void onDetach(d.id)} aria-label={t('document.detach')} title={t('document.detach')} className="hover:text-rose-600 dark:hover:text-rose-400">
                  <X size={15} />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

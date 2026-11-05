import { useRef, useState } from 'react';
import { Download, FileArchive, FileImage, FileSpreadsheet, FileText, Paperclip, Plus, X, type LucideIcon } from 'lucide-react';
import { t } from '../../i18n';
import { toApiMessage } from '../../shared/lib/api-client';
import { formatFaSize } from '../../shared/lib/format-fa';
import { useToast } from '../../shared/ui/Toast';
import { Button } from '../../shared/ui/Button';
import { EmptyState, Skeleton } from '../../shared/ui/Feedback';
import { downloadAttachmentBlob } from './api';
import { useAttachments, useDetachAttachment, useUploadAttachment } from './hooks';

function fileIcon(mime: string): LucideIcon {
  if (mime.startsWith('image/')) return FileImage;
  if (/sheet|excel|csv/.test(mime)) return FileSpreadsheet;
  if (/zip|rar|7z|tar|gzip/.test(mime)) return FileArchive;
  return FileText;
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

  const items = list.data ?? [];

  return (
    <section className="surface overflow-hidden" aria-label={t('document.title')}>
      <div className="panel-head justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Paperclip size={16} className="shrink-0 text-ink-3" aria-hidden />
          <h2 className="section-title">{t('document.title')}</h2>
          {items.length > 0 && <span className="meta tabular-nums">({t('document.countLabel', { count: items.length })})</span>}
        </div>
        {canWrite && (
          <>
            <input ref={inputRef} type="file" className="hidden" onChange={(e) => void onPick(e.target.files?.[0])} aria-hidden tabIndex={-1} />
            <Button variant="secondary" size="sm" disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
              <Plus size={15} />
              {upload.isPending ? t('common.loading') : t('document.upload')}
            </Button>
          </>
        )}
      </div>

      {list.isPending && (
        <div className="space-y-3 p-5">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      )}
      {list.isError && <p className="px-5 py-4 text-[13px] text-danger">{toApiMessage(list.error, t('common.error'))}</p>}
      {list.data && items.length === 0 && (
        <EmptyState icon={Paperclip} title={t('document.empty')} hint={canWrite ? t('document.emptyHint') : undefined} className="py-10" />
      )}

      {items.length > 0 && (
        <ul className="divide-y divide-line">
          {items.map((d) => {
            const Icon = fileIcon(d.mime);
            return (
              <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-surface-sunken text-ink-3">
                  <Icon size={16} strokeWidth={1.75} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p dir="auto" className="truncate text-[13.5px] font-medium">
                    {d.filename}
                  </p>
                  <p className="meta truncate text-[12px]" dir="ltr">
                    {formatFaSize(d.sizeBytes)} · {d.mime}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={busyId === d.id}
                  onClick={() => void onDownload(d.id, d.filename)}
                  aria-label={t('document.download')}
                  title={t('document.download')}
                >
                  <Download size={15} />
                </Button>
                {canWrite && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={detach.isPending}
                    onClick={() => void onDetach(d.id)}
                    aria-label={t('document.detach')}
                    title={t('document.detach')}
                    className="hover:text-danger"
                  >
                    <X size={15} />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

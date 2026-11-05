import { useEffect } from 'react';
import { X } from 'lucide-react';
import { t } from '../../i18n';
import { cn } from '../lib/cn';
import { Button } from './Button';

export function Dialog({
  open,
  title,
  description,
  children,
  onClose,
  wide,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}): JSX.Element | null {
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label={t('common.close')}
        onClick={onClose}
        className="absolute inset-0 animate-fade-in cursor-default bg-overlay/40 backdrop-blur-[2px]"
      />
      <div
        className={cn(
          'surface relative flex max-h-[88vh] w-full animate-rise-in flex-col rounded-b-none shadow-pop sm:rounded-card',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-5">
          <div className="min-w-0">
            <h2 className="text-[17px] font-bold leading-7">{title}</h2>
            {description && <p className="meta mt-1">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="btn-icon-sm -mt-1 -me-1.5" aria-label={t('common.close')}>
            <X size={17} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 pb-6">{children}</div>
      </div>
    </div>
  );
}

export function DialogFooter({ children }: { children: React.ReactNode }): JSX.Element {
  return <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-line pt-4">{children}</div>;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  pending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}): JSX.Element | null {
  return (
    <Dialog open={open} title={title} onClose={onClose}>
      <p className="text-[14px] leading-7 text-ink-2">{body}</p>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button variant={danger ? 'danger-solid' : 'primary'} disabled={pending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

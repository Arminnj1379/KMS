import { useEffect } from 'react';
import { X } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="close"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in cursor-default bg-slate-950/45 backdrop-blur-[2px]"
      />
      <div
        className={cn(
          'surface relative w-full animate-rise-in p-5 shadow-pop sm:p-6',
          wide ? 'max-w-2xl' : 'max-w-lg',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="btn-icon-sm" aria-label="بستن">
            <X size={16} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
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
      <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">{body}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          انصراف
        </Button>
        <Button variant={danger ? 'danger-solid' : 'primary'} disabled={pending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

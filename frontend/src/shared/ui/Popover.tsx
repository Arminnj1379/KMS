import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';

/** Click-to-open panel that closes on outside click or Escape. */
export function Popover({
  renderTrigger,
  children,
  align = 'end',
  placement = 'bottom',
  className,
}: {
  renderTrigger: (state: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'start' | 'end';
  placement?: 'top' | 'bottom';
  className?: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    function onPointer(e: MouseEvent): void {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {renderTrigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div
          className={cn(
            'surface absolute z-40 animate-rise-in p-1.5 shadow-pop',
            placement === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2',
            align === 'end' ? 'end-0' : 'start-0',
            className,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

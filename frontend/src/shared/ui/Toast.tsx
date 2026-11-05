import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import { cn } from '../lib/cn';

type Tone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: Tone;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const icons = {
  success: CircleCheck,
  error: CircleAlert,
  info: Info,
};

const iconTone = {
  success: 'text-success',
  error: 'text-danger',
  info: 'text-accent',
};

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside ToastProvider');
  return api;
}

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const push = useCallback((tone: Tone, message: string) => {
    const id = nextId.current++;
    setItems((prev) => [...prev.slice(-2), { id, tone, message }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message: string) => push('success', message),
      error: (message: string) => push('error', message),
      info: (message: string) => push('info', message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-5 z-[60] mx-auto flex w-full max-w-sm flex-col gap-2 px-4"
      >
        {items.map((item) => {
          const Icon = icons[item.tone];
          return (
            <div key={item.id} className="toast">
              <Icon size={18} className={cn('mt-0.5 shrink-0', iconTone[item.tone])} />
              <p className="text-[13.5px] font-medium leading-6 text-ink">{item.message}</p>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

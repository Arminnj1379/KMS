import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
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
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const bar = {
  success: 'bg-emerald-500',
  error: 'bg-rose-500',
  info: 'bg-brand-500',
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
    setItems((prev) => [...prev.slice(-3), { id, tone, message }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
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
        className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4"
      >
        {items.map((item) => {
          const Icon = icons[item.tone];
          return (
            <div
              key={item.id}
              className="surface pointer-events-auto flex animate-toast-in items-start gap-2.5 overflow-hidden p-3.5 shadow-pop"
            >
              <span className={cn('mt-1.5 h-8 w-1 shrink-0 self-stretch rounded-full', bar[item.tone])} aria-hidden />
              <Icon
                size={18}
                className={cn(
                  'mt-0.5 shrink-0',
                  item.tone === 'success' && 'text-emerald-600 dark:text-emerald-400',
                  item.tone === 'error' && 'text-rose-600 dark:text-rose-400',
                  item.tone === 'info' && 'text-brand-600 dark:text-brand-300',
                )}
              />
              <p className="text-[13px] font-medium leading-6">{item.message}</p>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

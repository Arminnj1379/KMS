import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { cn } from '../lib/cn';

export function EmptyState({
  icon: Icon = Inbox,
  title,
  hint,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        <Icon size={20} strokeWidth={1.75} />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-[13px] leading-6 text-slate-500 dark:text-slate-400">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }): JSX.Element {
  return <div className={cn('skeleton h-4 w-full', className)} aria-hidden />;
}

export function SkeletonCard(): JSX.Element {
  return (
    <div className="surface space-y-3 p-5" aria-hidden>
      <Skeleton className="h-5 w-2/5" />
      <Skeleton className="h-3.5 w-4/5" />
      <Skeleton className="h-3.5 w-3/5" />
    </div>
  );
}

export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }): JSX.Element {
  return (
    <div className="form-error flex items-center justify-between gap-3">
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="shrink-0 font-semibold underline underline-offset-4">
          تلاش مجدد
        </button>
      )}
    </div>
  );
}

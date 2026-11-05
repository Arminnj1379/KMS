import type { LucideIcon } from 'lucide-react';
import { Inbox, TriangleAlert } from 'lucide-react';
import { t } from '../../i18n';
import { cn } from '../lib/cn';
import { Button } from './Button';

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
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <span className="flex h-12 w-12 items-center justify-center rounded-card border border-line bg-surface-muted text-ink-3">
        <Icon size={20} strokeWidth={1.6} />
      </span>
      <p className="mt-4 text-[15px] font-semibold text-ink">{title}</p>
      {hint && <p className="mt-1.5 max-w-sm text-[13.5px] leading-7 text-ink-3">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }): JSX.Element {
  return <div className={cn('skeleton h-4 w-full', className)} aria-hidden />;
}

export function SkeletonCard(): JSX.Element {
  return (
    <div className="surface space-y-4 p-5" aria-hidden>
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-control" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <Skeleton className="h-3.5 w-4/5" />
      <Skeleton className="h-3.5 w-3/5" />
    </div>
  );
}

export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }): JSX.Element {
  return (
    <div role="alert" className="form-error flex items-center justify-between gap-3">
      <span className="flex items-center gap-2">
        <TriangleAlert size={16} className="shrink-0" />
        {message}
      </span>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry} className="text-danger hover:bg-danger/10 hover:text-danger">
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}

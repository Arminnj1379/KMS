import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '../lib/cn';

export interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }): JSX.Element {
  return (
    <nav aria-label="breadcrumb" className="flex min-w-0 items-center gap-1 text-[13px]">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronLeft size={14} className="shrink-0 text-slate-300 dark:text-slate-600" aria-hidden />}
            {item.to && !last ? (
              <Link to={item.to} className="truncate text-slate-500 transition-colors hover:text-brand-700 dark:text-slate-400 dark:hover:text-brand-200">
                {item.label}
              </Link>
            ) : (
              <span className={cn('truncate', last ? 'font-semibold text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400')}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: Crumb[];
}): JSX.Element {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {breadcrumbs && (
          <div className="mb-1.5">
            <Breadcrumbs items={breadcrumbs} />
          </div>
        )}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-desc">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }): JSX.Element {
  const initial = (name.trim().charAt(0) || '؟').toUpperCase();
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200',
        size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm',
      )}
    >
      {initial}
    </span>
  );
}

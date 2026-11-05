import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '../lib/cn';
import { useHeaderCrumbs, type Crumb } from './header-crumbs';

export type { Crumb };

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }): JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <nav aria-label="breadcrumb" className={cn('flex min-w-0 items-center gap-1.5 text-[13px]', className)}>
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
          {i > 0 && <ChevronLeft size={14} className="shrink-0 text-ink-4" aria-hidden />}
          {item.to ? (
            <Link to={item.to} className="truncate text-ink-3 transition-colors hover:text-ink">
              {item.label}
            </Link>
          ) : (
            <span className="truncate text-ink-2">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/**
 * Page title block. `breadcrumbs` are the ancestors of the page; they are shown
 * in the app header rather than repeated above the title.
 */
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
  const { setCrumbs } = useHeaderCrumbs();
  const crumbsKey = JSON.stringify(breadcrumbs ?? []);

  useEffect(() => {
    setCrumbs(JSON.parse(crumbsKey) as Crumb[]);
    return () => setCrumbs([]);
  }, [crumbsKey, setCrumbs]);

  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-desc max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

const avatarTones = ['tile-0', 'tile-1', 'tile-2', 'tile-3', 'tile-4', 'tile-5'] as const;

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }): JSX.Element {
  const initial = (name.trim().charAt(0) || '؟').toUpperCase();
  const tone = avatarTones[name.length % avatarTones.length];
  return (
    <span
      aria-hidden
      className={cn(
        'tile shrink-0 rounded-full',
        tone,
        size === 'sm' && 'h-7 w-7 text-[12px]',
        size === 'md' && 'h-9 w-9 text-[14px]',
        size === 'lg' && 'h-14 w-14 text-[20px]',
      )}
    >
      {initial}
    </span>
  );
}

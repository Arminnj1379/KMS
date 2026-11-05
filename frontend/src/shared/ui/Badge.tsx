import { cn } from '../lib/cn';

type Tone = 'blue' | 'green' | 'amber' | 'rose' | 'slate';

const tones: Record<Tone, string> = {
  blue: 'badge-blue',
  green: 'badge-green',
  amber: 'badge-amber',
  rose: 'badge-rose',
  slate: 'badge-slate',
};

export function Badge({ tone = 'slate', dot = true, className, children }: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <span className={cn(tones[tone], className)}>
      {dot && <span className="dot" aria-hidden />}
      {children}
    </span>
  );
}

export function TagChip({ children }: { children: React.ReactNode }): JSX.Element {
  return <span className="tag-chip">{children}</span>;
}

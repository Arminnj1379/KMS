import { cn } from '../lib/cn';

export type Tone = 'accent' | 'success' | 'warn' | 'danger' | 'neutral' | 'outline';

const tones: Record<Tone, string> = {
  accent: 'badge-accent',
  success: 'badge-success',
  warn: 'badge-warn',
  danger: 'badge-danger',
  neutral: 'badge-neutral',
  outline: 'badge-outline',
};

export function Badge({ tone = 'neutral', dot = false, className, children }: {
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

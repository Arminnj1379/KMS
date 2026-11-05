import { cn } from '../lib/cn';

/** Eight-point star outline (girih-style); the product's one recurring motif. */
export const STAR_POINTS = Array.from({ length: 16 }, (_, i) => {
  const r = i % 2 === 0 ? 10 : 4.4;
  const angle = (Math.PI / 8) * i - Math.PI / 2;
  return `${(12 + r * Math.cos(angle)).toFixed(2)},${(12 + r * Math.sin(angle)).toFixed(2)}`;
}).join(' ');

export function BrandMark({ size = 32, className }: { size?: number; className?: string }): JSX.Element {
  return (
    <span
      aria-hidden
      className={cn('inline-flex shrink-0 items-center justify-center rounded-control bg-accent text-accent-fg', className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round">
        <polygon points={STAR_POINTS} />
        <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}

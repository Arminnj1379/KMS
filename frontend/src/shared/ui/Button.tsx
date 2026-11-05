import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-solid';
type Size = 'sm' | 'md' | 'icon' | 'icon-sm';

const variants: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  'danger-solid': 'btn-danger-solid',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = 'secondary', size, className, type, ...rest }: Props): JSX.Element {
  return (
    <button
      type={type ?? 'button'}
      className={cn(
        variants[variant],
        size === 'sm' && 'btn-sm',
        size === 'icon' && 'btn-icon h-9 w-9 p-0',
        size === 'icon-sm' && 'btn-icon-sm p-0',
        className,
      )}
      {...rest}
    />
  );
}

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

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: '',
  icon: 'h-9 w-9 px-0',
  'icon-sm': 'h-8 w-8 px-0',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = 'secondary', size = 'md', className, type, ...rest }: Props): JSX.Element {
  return (
    <button type={type ?? 'button'} className={cn(variants[variant], sizes[size], className)} {...rest} />
  );
}

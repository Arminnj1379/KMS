import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <label className={cn('block text-sm', className)}>
      <span className="label">{label}</span>
      {children}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>): JSX.Element {
  const { className, ...rest } = props;
  return <input {...rest} className={cn('input', props['aria-invalid'] && 'input-error', className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>): JSX.Element {
  const { className, ...rest } = props;
  return <textarea {...rest} className={cn('input', className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>): JSX.Element {
  const { className, children, ...rest } = props;
  return (
    <select {...rest} className={cn('input', className)}>
      {children}
    </select>
  );
}

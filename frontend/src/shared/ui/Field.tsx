import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
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

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  props,
  ref,
) {
  const { className, ...rest } = props;
  return <input ref={ref} {...rest} className={cn('input', props['aria-invalid'] && 'input-error', className)} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea(props, ref) {
    const { className, ...rest } = props;
    return <textarea ref={ref} {...rest} className={cn('input', className)} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  props,
  ref,
) {
  const { className, children, ...rest } = props;
  return (
    <select ref={ref} {...rest} className={cn('input', className)}>
      {children}
    </select>
  );
});

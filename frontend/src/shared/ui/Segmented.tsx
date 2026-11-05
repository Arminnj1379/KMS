import { formatFaNumber } from '../lib/format-fa';
import { cn } from '../lib/cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Single-choice filter group (status tabs, views). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
}): JSX.Element {
  return (
    <div role="group" aria-label={label} className={cn('segmented max-w-full overflow-x-auto', className)}>
      {options.map((option) => (
        <button
          key={option.value || 'all'}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className="segmented-item"
        >
          {option.label}
          {option.count !== undefined && (
            <span className="tabular-nums text-ink-4 aria-[pressed=true]:text-ink-3">{formatFaNumber(option.count)}</span>
          )}
        </button>
      ))}
    </div>
  );
}

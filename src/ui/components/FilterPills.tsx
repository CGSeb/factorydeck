import type { ReactElement } from 'react';
import './controls.css';

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  count: number;
  dot?: string;
}

export interface FilterPillsProps<T extends string> {
  label: string;
  options: FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function FilterPills<T extends string>({
  label,
  options,
  value,
  onChange,
}: FilterPillsProps<T>): ReactElement {
  return (
    <div className="fd-pills" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="fd-control fd-pill"
          aria-pressed={option.value === value}
          onClick={() => {
            if (option.value !== value) onChange(option.value);
          }}
        >
          {option.dot !== undefined && (
            <span
              className="fd-pill-dot"
              aria-hidden="true"
              style={{ background: option.dot }}
            />
          )}
          {option.label}
          <span className="fd-pill-count">{option.count}</span>
        </button>
      ))}
    </div>
  );
}

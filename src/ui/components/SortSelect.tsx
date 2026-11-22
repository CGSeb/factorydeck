import { type ReactElement, useId } from 'react';
import './controls.css';

export interface SortOption<T extends string> {
  value: T;
  label: string;
}

export interface SortSelectProps<T extends string> {
  options: SortOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SortSelect<T extends string>({
  options,
  value,
  onChange,
}: SortSelectProps<T>): ReactElement {
  const id = useId();
  return (
    <div className="fd-sort">
      <label htmlFor={id}>Sort by</label>
      <select
        id={id}
        className="fd-control"
        value={value}
        onChange={(event) => {
          const chosen = options.find(
            (option) => option.value === event.target.value,
          );
          if (chosen !== undefined) onChange(chosen.value);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

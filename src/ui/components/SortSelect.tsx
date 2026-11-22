import { type ReactElement, useId } from 'react';
import { Select, type SelectOption } from './Select.tsx';
import './controls.css';

export type SortOption<T extends string> = SelectOption<T>;

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
  const labelId = useId();
  return (
    <div className="fd-sort">
      <label id={labelId} htmlFor={id}>
        Sort by
      </label>
      <Select
        id={id}
        labelId={labelId}
        options={options}
        value={value}
        onChange={onChange}
        align="end"
      />
    </div>
  );
}

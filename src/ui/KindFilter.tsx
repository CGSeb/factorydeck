import type { ReactElement } from 'react';
import type { KindCounts } from '../features/types.ts';
import type { IssueKind } from '../git-host/kind.ts';
import { FilterPills } from './components/FilterPills.tsx';
import { kindOptions } from './kind-filter.ts';

export interface KindFilterProps {
  kinds: KindCounts;
  value: IssueKind | null;
  onChange: (kind: IssueKind | null) => void;
}

export function KindFilter({
  kinds,
  value,
  onChange,
}: KindFilterProps): ReactElement {
  return (
    <FilterPills
      label="Kind"
      options={kindOptions(kinds)}
      value={value ?? 'all'}
      onChange={(choice) => {
        onChange(choice === 'all' ? null : choice);
      }}
    />
  );
}

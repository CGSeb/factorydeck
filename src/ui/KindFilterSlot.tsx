import type { ReactElement } from 'react';
import type { KindCounts } from '../features/types.ts';
import type { IssueKind } from '../git-host/kind.ts';
import { KindFilter, type KindFilterProps } from './KindFilter.tsx';

const NO_KINDS: KindCounts = { feature: 0, bug: 0 };

export interface KindFilterSlotProps extends Omit<KindFilterProps, 'kinds'> {
  kinds: KindCounts | undefined;
}

export function KindFilterSlot({
  kinds,
  value,
  onChange,
}: KindFilterSlotProps): ReactElement {
  if (kinds !== undefined) {
    return <KindFilter kinds={kinds} value={value} onChange={onChange} />;
  }
  return (
    <div
      data-pending=""
      aria-hidden="true"
      inert
      style={{ visibility: 'hidden' }}
    >
      <KindFilter kinds={NO_KINDS} value={value} onChange={noChange} />
    </div>
  );
}

function noChange(_kind: IssueKind | null): void {
  return undefined;
}

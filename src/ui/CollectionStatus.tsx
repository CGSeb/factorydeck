import type { ReactElement } from 'react';
import { formatAgo } from './format.ts';

export interface CollectionStatusProps {
  collectedAt: string | null | undefined;
  now: Date;
  refreshing: boolean;
  onRefresh: () => void;
}

export function CollectionStatus({
  collectedAt,
  now,
  refreshing,
  onRefresh,
}: CollectionStatusProps): ReactElement {
  return (
    <div className="collection">
      {collectedAt !== undefined && (
        <span className="collection-time">
          {collectedAt === null
            ? 'Issues not collected yet'
            : `Issues updated ${formatAgo(collectedAt, now)}`}
        </span>
      )}
      <button type="button" disabled={refreshing} onClick={onRefresh}>
        {refreshing ? 'Refreshing…' : 'Refresh'}
      </button>
    </div>
  );
}

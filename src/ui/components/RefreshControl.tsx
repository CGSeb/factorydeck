import type { ReactElement } from 'react';
import { formatAgo } from '../format.ts';
import { Icon } from './Icon.tsx';
import './controls.css';

export interface RefreshControlProps {
  collectedAt: string | null | undefined;
  now: Date;
  refreshing: boolean;
  onRefresh: () => void;
  compact?: boolean;
}

export function collectionText(
  collectedAt: string | null | undefined,
  now: Date,
): string | undefined {
  if (collectedAt === undefined) return undefined;
  return collectedAt === null
    ? 'Issues not collected yet'
    : `Issues updated ${formatAgo(collectedAt, now)}`;
}

function lowerFirst(text: string): string {
  return `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

export function RefreshControl({
  collectedAt,
  now,
  refreshing,
  onRefresh,
  compact = false,
}: RefreshControlProps): ReactElement {
  const status = collectionText(collectedAt, now);
  return (
    <div className="fd-refresh">
      {!compact && status !== undefined && (
        <span className="fd-refresh-status">{status}</span>
      )}
      <button
        type="button"
        className="fd-control fd-refresh-button"
        disabled={refreshing}
        aria-busy={refreshing}
        onClick={onRefresh}
      >
        <Icon name="refresh" size={16} />
        <span className="fd-visually-hidden">
          {refreshing ? 'Refreshing…' : 'Refresh'}
          {!refreshing && status !== undefined && (
            <span className={compact ? undefined : 'fd-refresh-narrow'}>
              , {lowerFirst(status)}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}

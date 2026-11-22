import type { ReactElement } from 'react';
import { formatAgo } from '../format.ts';
import './controls.css';

export interface RefreshControlProps {
  collectedAt: string | null | undefined;
  now: Date;
  refreshing: boolean;
  onRefresh: () => void;
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
}: RefreshControlProps): ReactElement {
  const status = collectionText(collectedAt, now);
  return (
    <div className="fd-refresh">
      {status !== undefined && (
        <span className="fd-refresh-status">{status}</span>
      )}
      <button
        type="button"
        className="fd-control fd-refresh-button"
        disabled={refreshing}
        aria-busy={refreshing}
        onClick={onRefresh}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
        <span className="fd-visually-hidden">
          {refreshing ? 'Refreshing…' : 'Refresh'}
          {!refreshing && status !== undefined && (
            <span className="fd-refresh-narrow">, {lowerFirst(status)}</span>
          )}
        </span>
      </button>
    </div>
  );
}

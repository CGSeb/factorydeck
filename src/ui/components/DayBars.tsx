import type { CSSProperties, ReactElement } from 'react';
import { formatBucket, formatCount, formatTokens } from '../format.ts';
import {
  EVERY_LABEL_MAX_BUCKETS,
  columnHeights,
  edgeLabels,
  visuallyHidden,
} from './chart-math.ts';
import type { TokenCounts } from './token-amount.ts';

export interface DayBucket {
  label: string;
  value: number;
  counts?: TokenCounts;
  costUsd?: number | null;
}

export interface DayBarsProps {
  label: string;
  buckets: readonly DayBucket[];
  color: string;
  height: number;
}

const COLUMN_GAP = '6px';

const columns: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: COLUMN_GAP,
};

const column: CSSProperties = {
  flex: '1 1 0px',
  minWidth: 0,
  height: '100%',
  display: 'flex',
  alignItems: 'flex-end',
};

const labelRow: CSSProperties = {
  display: 'flex',
  gap: COLUMN_GAP,
  marginTop: 'var(--fd-space-1)',
  fontSize: 'var(--fd-text-xs)',
  color: 'var(--fd-muted)',
  fontVariantNumeric: 'tabular-nums',
};

const columnLabel: CSSProperties = {
  flex: '1 1 0px',
  minWidth: 0,
  textAlign: 'center',
  whiteSpace: 'nowrap',
};

function bucketValue(bucket: DayBucket): string {
  return bucket.counts === undefined
    ? formatCount(bucket.value)
    : `${formatTokens(bucket.value)} tokens`;
}

function Labels({
  buckets,
}: {
  buckets: readonly DayBucket[];
}): ReactElement | null {
  const shown = edgeLabels(buckets);
  if (shown.length === 0) return null;
  if (buckets.length <= EVERY_LABEL_MAX_BUCKETS) {
    return (
      <div data-labels="every" style={labelRow}>
        {shown.map((bucket, index) => (
          <span key={`${String(index)} ${bucket.label}`} style={columnLabel}>
            {formatBucket(bucket.label)}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div
      data-labels="ends"
      style={{ ...labelRow, justifyContent: 'space-between' }}
    >
      {shown.map((bucket, index) => (
        <span key={`${String(index)} ${bucket.label}`}>
          {formatBucket(bucket.label)}
        </span>
      ))}
    </div>
  );
}

export function DayBars({
  label,
  buckets,
  color,
  height,
}: DayBarsProps): ReactElement {
  const heights = columnHeights(
    buckets.map((bucket) => bucket.value),
    height,
  );
  return (
    <div style={{ position: 'relative', minWidth: 0 }}>
      <div role="img" aria-label={label}>
        <div style={{ ...columns, height: `${String(height)}px` }}>
          {buckets.map((bucket, index) => (
            <div
              key={`${String(index)} ${bucket.label}`}
              title={`${formatBucket(bucket.label)} · ${bucketValue(bucket)}`}
              style={column}
            >
              <div
                data-column=""
                style={{
                  width: '100%',
                  height: `${String(heights[index] ?? 0)}px`,
                  borderRadius: '4px 4px 0 0',
                  background: color,
                }}
              />
            </div>
          ))}
        </div>
        <Labels buckets={buckets} />
      </div>
      {buckets.length > 0 ? (
        <div style={visuallyHidden}>
          <table aria-label={label}>
            <tbody>
              {buckets.map((bucket, index) => (
                <tr key={`${String(index)} ${bucket.label}`}>
                  <th scope="row">{formatBucket(bucket.label)}</th>
                  <td>{bucketValue(bucket)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

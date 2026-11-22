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
  showValues?: boolean;
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
  flexDirection: 'column',
  justifyContent: 'flex-end',
};

const VALUE_ROW_PX = 18;

const columnValue: CSSProperties = {
  overflow: 'hidden',
  marginBottom: '4px',
  fontSize: '11px',
  lineHeight: '14px',
  color: 'var(--fd-ink-2)',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
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

function Column({
  bucket,
  height,
  color,
  showValue,
}: {
  bucket: DayBucket;
  height: number;
  color: string;
  showValue: boolean;
}): ReactElement {
  return (
    <div
      title={`${formatBucket(bucket.label)} · ${bucketValue(bucket)}`}
      style={column}
    >
      {showValue ? (
        <span data-value="" style={columnValue}>
          {formatCount(bucket.value)}
        </span>
      ) : null}
      <div
        data-column=""
        style={{
          width: '100%',
          height: `${String(height)}px`,
          borderRadius: '4px 4px 0 0',
          background: color,
        }}
      />
    </div>
  );
}

export function DayBars({
  label,
  buckets,
  color,
  height,
  showValues = false,
}: DayBarsProps): ReactElement {
  const heights = columnHeights(
    buckets.map((bucket) => bucket.value),
    height,
  );
  return (
    <div style={{ position: 'relative', minWidth: 0 }}>
      <div role="img" aria-label={label}>
        <div
          style={{
            ...columns,
            height: `${String(height + (showValues ? VALUE_ROW_PX : 0))}px`,
          }}
        >
          {buckets.map((bucket, index) => (
            <Column
              key={`${String(index)} ${bucket.label}`}
              bucket={bucket}
              height={heights[index] ?? 0}
              color={color}
              showValue={showValues}
            />
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

import { type CSSProperties, type ReactElement, useState } from 'react';
import { formatBucket, formatCount, formatTokens } from '../format.ts';
import {
  EVERY_LABEL_MAX_BUCKETS,
  columnHeights,
  edgeLabels,
  visuallyHidden,
} from './chart-math.ts';
import {
  chartTooltip,
  chartTooltipLabel,
  chartTooltipValue,
} from './chart-tooltip.ts';
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
  position: 'relative',
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

const TOOLTIP_ALIGN: Record<TooltipAlign, CSSProperties> = {
  start: { left: 0 },
  center: { left: '50%', transform: 'translateX(-50%)' },
  end: { right: 0 },
};

const tooltip: CSSProperties = {
  ...chartTooltip,
  position: 'absolute',
  zIndex: 2,
};

type TooltipAlign = 'start' | 'center' | 'end';

function tooltipAlign(index: number, length: number): TooltipAlign {
  if (length > 2 && index === 0) return 'start';
  if (length > 2 && index === length - 1) return 'end';
  return 'center';
}

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

function ColumnTooltip({
  bucket,
  bottom,
  align,
}: {
  bucket: DayBucket;
  bottom: number;
  align: TooltipAlign;
}): ReactElement {
  return (
    <span
      data-tooltip=""
      aria-hidden="true"
      style={{
        ...tooltip,
        ...TOOLTIP_ALIGN[align],
        bottom: `calc(${String(bottom)}px + var(--fd-space-2))`,
      }}
    >
      <span style={chartTooltipLabel}>{formatBucket(bucket.label)}</span>
      <span style={chartTooltipValue}>{bucketValue(bucket)}</span>
    </span>
  );
}

function Column({
  bucket,
  height,
  color,
  showValue,
  hovered,
  dimmed,
  align,
  onHover,
}: {
  bucket: DayBucket;
  height: number;
  color: string;
  showValue: boolean;
  hovered: boolean;
  dimmed: boolean;
  align: TooltipAlign;
  onHover: (hovered: boolean) => void;
}): ReactElement {
  return (
    <div
      style={column}
      onPointerEnter={() => {
        onHover(true);
      }}
      onPointerLeave={() => {
        onHover(false);
      }}
    >
      {hovered ? (
        <ColumnTooltip
          bucket={bucket}
          bottom={height + (showValue ? VALUE_ROW_PX : 0)}
          align={align}
        />
      ) : null}
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
          opacity: dimmed ? 0.45 : 1,
          transition: 'opacity 120ms ease',
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
  const [hovered, setHovered] = useState<number | null>(null);
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
              hovered={hovered === index}
              dimmed={hovered !== null && hovered !== index}
              align={tooltipAlign(index, buckets.length)}
              onHover={(on) => {
                setHovered((current) =>
                  on ? index : current === index ? null : current,
                );
              }}
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

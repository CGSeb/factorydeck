import { type CSSProperties, type ReactElement, useState } from 'react';
import {
  COLUMN_STUB_PX,
  EVERY_LABEL_MAX_BUCKETS,
  edgeLabels,
  visuallyHidden,
} from './chart-math.ts';
import {
  chartTooltip,
  chartTooltipLabel,
  chartTooltipValue,
  tooltipAlign,
} from './chart-tooltip.ts';
import {
  type TooltipAlign,
  type TrendBucket,
  type TrendScale,
  alignAt,
  isDrawn,
  trendHeights,
} from './stats-math.ts';

export type { TrendBucket, TrendScale } from './stats-math.ts';

export interface TrendBarsProps {
  label: string;
  buckets: readonly TrendBucket[];
  scale: TrendScale;
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
  position: 'relative',
  flex: '1 1 0px',
  minWidth: 0,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
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

function Labels({
  buckets,
}: {
  buckets: readonly TrendBucket[];
}): ReactElement | null {
  const shown = edgeLabels(buckets);
  if (shown.length === 0) return null;
  const every = buckets.length <= EVERY_LABEL_MAX_BUCKETS;
  return (
    <div
      data-labels={every ? 'every' : 'ends'}
      style={
        every ? labelRow : { ...labelRow, justifyContent: 'space-between' }
      }
    >
      {shown.map((bucket, index) => (
        <span
          key={`${String(index)} ${bucket.label}`}
          style={every ? columnLabel : undefined}
        >
          {bucket.label}
        </span>
      ))}
    </div>
  );
}

function tooltipLines(bucket: TrendBucket): string[] {
  if (!isDrawn(bucket)) return [bucket.label, 'Not enough data'];
  return bucket.n === undefined
    ? [bucket.label, bucket.text]
    : [bucket.label, bucket.text, `n = ${String(bucket.n)}`];
}

export function ColumnTooltip({
  lines,
  bottom,
  align,
}: {
  lines: readonly string[];
  bottom: number;
  align: TooltipAlign;
}): ReactElement {
  const [first, ...rest] = lines;
  return (
    <span
      data-tooltip=""
      aria-hidden="true"
      style={{
        ...chartTooltip,
        position: 'absolute',
        ...tooltipAlign[align],
        bottom: `calc(${String(bottom)}px + var(--fd-space-2))`,
      }}
    >
      <span style={chartTooltipLabel}>{first}</span>
      {rest.map((line) => (
        <span key={line} style={chartTooltipValue}>
          {line}
        </span>
      ))}
    </span>
  );
}

function Column({
  bucket,
  height,
  color,
  hovered,
  dimmed,
  align,
  onHover,
}: {
  bucket: TrendBucket;
  height: number;
  color: string;
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
          lines={tooltipLines(bucket)}
          bottom={height}
          align={align}
        />
      ) : null}
      <div
        data-column=""
        style={{
          width: '100%',
          height: `${String(height)}px`,
          borderRadius: '4px 4px 0 0',
          background: isDrawn(bucket) ? color : 'var(--fd-line)',
          opacity: dimmed ? 0.45 : 1,
          transition: 'opacity 120ms ease',
        }}
      />
    </div>
  );
}

export function TrendBars({
  label,
  buckets,
  scale,
  color,
  height,
}: TrendBarsProps): ReactElement {
  const [hovered, setHovered] = useState<number | null>(null);
  const heights = trendHeights(buckets, scale, height);
  return (
    <div style={{ position: 'relative', minWidth: 0 }}>
      <div role="img" aria-label={label}>
        <div style={{ ...columns, height: `${String(height)}px` }}>
          {buckets.map((bucket, index) => (
            <Column
              key={`${String(index)} ${bucket.label}`}
              bucket={bucket}
              height={heights[index] ?? COLUMN_STUB_PX}
              color={color}
              hovered={hovered === index}
              dimmed={hovered !== null && hovered !== index}
              align={alignAt((index + 0.5) / buckets.length)}
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
                  <th scope="row">{bucket.label}</th>
                  <td>{isDrawn(bucket) ? bucket.text : 'Not enough data'}</td>
                  <td>
                    {bucket.n === undefined ? '' : `n = ${String(bucket.n)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

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
  type Noun,
  type TooltipAlign,
  type TrendBucket,
  type TrendScale,
  alignAt,
  countText,
  trendDraw,
  trendHeights,
} from './stats-math.ts';

export type { TrendBucket, TrendScale } from './stats-math.ts';

export interface TrendBarsProps {
  label: string;
  buckets: readonly TrendBucket[];
  scale: TrendScale;
  color: string;
  height: number;
  noun?: Noun | undefined;
}

export const COLUMN_GAP = '6px';
const SMALL_SAMPLE_OPACITY = 0.4;
export const DIMMED_OPACITY = 0.45;
export const SMALL_SAMPLE = 'small sample';

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

export function TrendLabels({
  buckets,
}: {
  buckets: readonly { label: string }[];
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

function sampleText(bucket: TrendBucket, noun: Noun | undefined): string {
  const { n } = bucket;
  if (n === undefined) return '';
  const count = `n = ${noun === undefined ? String(n) : countText(n, noun)}`;
  return trendDraw(bucket) === 'small' ? `${count} · ${SMALL_SAMPLE}` : count;
}

function tooltipLines(bucket: TrendBucket, noun: Noun | undefined): string[] {
  return bucket.n === undefined || trendDraw(bucket) === 'empty'
    ? [bucket.label, bucket.text]
    : [bucket.label, bucket.text, sampleText(bucket, noun)];
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
  noun,
  hovered,
  dimmed,
  align,
  onHover,
}: {
  bucket: TrendBucket;
  height: number;
  color: string;
  noun: Noun | undefined;
  hovered: boolean;
  dimmed: boolean;
  align: TooltipAlign;
  onHover: (hovered: boolean) => void;
}): ReactElement {
  const draw = trendDraw(bucket);
  const opacity =
    (draw === 'small' ? SMALL_SAMPLE_OPACITY : 1) *
    (dimmed ? DIMMED_OPACITY : 1);
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
          lines={tooltipLines(bucket, noun)}
          bottom={height}
          align={align}
        />
      ) : null}
      <div
        data-column=""
        data-draw={draw}
        style={{
          width: '100%',
          height: `${String(height)}px`,
          borderRadius: '4px 4px 0 0',
          background: draw === 'empty' ? 'var(--fd-line)' : color,
          opacity,
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
  noun,
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
              noun={noun}
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
        <TrendLabels buckets={buckets} />
      </div>
      {buckets.length > 0 ? (
        <div style={visuallyHidden}>
          <table aria-label={label}>
            <tbody>
              {buckets.map((bucket, index) => (
                <tr key={`${String(index)} ${bucket.label}`}>
                  <th scope="row">{bucket.label}</th>
                  <td>{bucket.text}</td>
                  <td>{sampleText(bucket, noun)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

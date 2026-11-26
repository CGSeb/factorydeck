import { type CSSProperties, type ReactElement, useState } from 'react';
import { COLUMN_STUB_PX, visuallyHidden } from './chart-math.ts';
import { dotStyle } from './label-styles.ts';
import { type TooltipAlign, alignAt } from './stats-math.ts';
import {
  COLUMN_GAP,
  ColumnTooltip,
  DIMMED_OPACITY,
  TrendLabels,
} from './TrendBars.tsx';

export interface PairSeries {
  label: string;
  color: string;
}

export interface PairBucket {
  label: string;
  first: number;
  second: number;
  text: string;
}

export interface PairBarsProps {
  label: string;
  series: readonly [PairSeries, PairSeries];
  buckets: readonly PairBucket[];
  height: number;
}

const legend: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px 18px',
  margin: '0 0 var(--fd-space-2)',
  padding: 0,
  listStyle: 'none',
  fontSize: 'var(--fd-text-xs)',
  color: 'var(--fd-ink-2)',
};

const legendItem: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
};

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
  alignItems: 'flex-end',
  gap: '2px',
};

export function pairHeights(
  buckets: readonly PairBucket[],
  height: number,
): [number, number][] {
  const largest = buckets.reduce(
    (max, bucket) => Math.max(max, bucket.first, bucket.second),
    0,
  );
  const scaled = (value: number): number =>
    largest <= 0 || value <= 0
      ? COLUMN_STUB_PX
      : Math.max(COLUMN_STUB_PX, (value / largest) * height);
  return buckets.map((bucket) => [scaled(bucket.first), scaled(bucket.second)]);
}

function Bar({
  value,
  height,
  color,
  series,
}: {
  value: number;
  height: number;
  color: string;
  series: string;
}): ReactElement {
  return (
    <div
      data-bar={series}
      data-draw={value > 0 ? 'full' : 'empty'}
      style={{
        flex: '1 1 0px',
        minWidth: 0,
        height: `${String(height)}px`,
        borderRadius: '3px 3px 0 0',
        background: value > 0 ? color : 'var(--fd-line)',
      }}
    />
  );
}

function Legend({ series }: { series: readonly PairSeries[] }): ReactElement {
  return (
    <ul data-legend="" style={legend}>
      {series.map((item) => (
        <li key={item.label} style={legendItem}>
          <span aria-hidden="true" style={dotStyle(9, '2px', item.color)} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function Table({
  label,
  series,
  buckets,
}: Omit<PairBarsProps, 'height'>): ReactElement {
  const [first, second] = series;
  return (
    <div style={visuallyHidden}>
      <table aria-label={label}>
        <thead>
          <tr>
            <td />
            <th scope="col">{first.label}</th>
            <th scope="col">{second.label}</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((bucket, index) => (
            <tr key={`${String(index)} ${bucket.label}`}>
              <th scope="row">{bucket.label}</th>
              <td>{bucket.first}</td>
              <td>{bucket.second}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Column({
  bucket,
  heights,
  series,
  hovered,
  dimmed,
  align,
  onHover,
}: {
  bucket: PairBucket;
  heights: [number, number];
  series: readonly [PairSeries, PairSeries];
  hovered: boolean;
  dimmed: boolean;
  align: TooltipAlign;
  onHover: (hovered: boolean) => void;
}): ReactElement {
  const [first, second] = series;
  const [firstHeight, secondHeight] = heights;
  return (
    <div
      data-column=""
      style={{
        ...column,
        opacity: dimmed ? DIMMED_OPACITY : 1,
        transition: 'opacity 120ms ease',
      }}
      onPointerEnter={() => {
        onHover(true);
      }}
      onPointerLeave={() => {
        onHover(false);
      }}
    >
      {hovered ? (
        <ColumnTooltip
          lines={[bucket.label, bucket.text]}
          bottom={Math.max(firstHeight, secondHeight)}
          align={align}
        />
      ) : null}
      <Bar
        value={bucket.first}
        height={firstHeight}
        color={first.color}
        series={first.label}
      />
      <Bar
        value={bucket.second}
        height={secondHeight}
        color={second.color}
        series={second.label}
      />
    </div>
  );
}

export function PairBars({
  label,
  series,
  buckets,
  height,
}: PairBarsProps): ReactElement {
  const [hovered, setHovered] = useState<number | null>(null);
  const heights = pairHeights(buckets, height);
  return (
    <div style={{ position: 'relative', minWidth: 0 }}>
      <Legend series={series} />
      <div role="img" aria-label={label}>
        <div style={{ ...columns, height: `${String(height)}px` }}>
          {buckets.map((bucket, index) => (
            <Column
              key={`${String(index)} ${bucket.label}`}
              bucket={bucket}
              heights={heights[index] ?? [COLUMN_STUB_PX, COLUMN_STUB_PX]}
              series={series}
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
        <Table label={label} series={series} buckets={buckets} />
      ) : null}
    </div>
  );
}

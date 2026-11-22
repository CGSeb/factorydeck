import type { CSSProperties, ReactElement } from 'react';
import { formatCount } from '../format.ts';
import type { ChartSegment } from './chart-math.ts';
import { dotStyle } from './label-styles.ts';
import { TokenAmount } from './TokenAmount.tsx';

export interface SplitLegendProps {
  segments: readonly ChartSegment[];
}

const list: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px 18px',
  margin: 0,
  padding: 0,
  listStyle: 'none',
};

const item: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
};

const amount: CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  fontWeight: 600,
};

function Value({ segment }: { segment: ChartSegment }): ReactElement {
  if (segment.counts === undefined) {
    return <span style={amount}>{formatCount(segment.value)}</span>;
  }
  return (
    <span style={amount}>
      <TokenAmount counts={segment.counts} costUsd={segment.costUsd ?? null} />
    </span>
  );
}

export function SplitLegend({ segments }: SplitLegendProps): ReactElement {
  return (
    <ul style={list}>
      {segments.map((segment, index) => (
        <li key={`${String(index)} ${segment.label}`} style={item}>
          <span aria-hidden="true" style={dotStyle(9, '2px', segment.color)} />
          <span>{segment.label}</span>
          <Value segment={segment} />
        </li>
      ))}
    </ul>
  );
}

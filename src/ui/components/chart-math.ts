import type { CSSProperties } from 'react';
import type { TokenCounts } from './token-amount.ts';

export const SEGMENT_GAP_PX = 2;
export const MIN_SEGMENT_PX = 2;
export const SHARE_MIN_WIDTH_PX = 48;
export const COLUMN_STUB_PX = 2;
export const EVERY_LABEL_MAX_BUCKETS = 7;

const WEIGHT_SCALE = 1000;

export interface ChartSegment {
  label: string;
  value: number;
  color: string;
  counts?: TokenCounts;
  costUsd?: number | null;
}

export type SplitPart<T> = T & { share: number; weight: number };

export const visuallyHidden: CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

export function wholePercent(value: number, total: number): number {
  if (total <= 0 || value <= 0) return 0;
  return Math.round((value / total) * 100);
}

export function splitParts<T extends { value: number }>(
  segments: readonly T[],
): SplitPart<T>[] {
  const visible = segments.filter((segment) => segment.value > 0);
  const total = visible.reduce((sum, segment) => sum + segment.value, 0);
  return visible.map((segment) => ({
    ...segment,
    share: wholePercent(segment.value, total),
    weight: (segment.value / total) * WEIGHT_SCALE,
  }));
}

export function columnHeights(
  values: readonly number[],
  height: number,
): number[] {
  const largest = values.reduce((max, value) => Math.max(max, value), 0);
  return values.map((value) =>
    largest > 0 && value > 0
      ? Math.max(COLUMN_STUB_PX, (value / largest) * height)
      : COLUMN_STUB_PX,
  );
}

export function barPercent(value: number, total: number): number {
  if (total <= 0 || value <= 0) return 0;
  return Math.min(100, (value / total) * 100);
}

/** A share of a total as text: `48%`, or `<1%` for a share above 0 that rounds to 0. */
export function shareText(value: number, total: number): string {
  const share = wholePercent(value, total);
  return share === 0 && value > 0 && total > 0 ? '<1%' : `${String(share)}%`;
}

export function edgeLabels<T>(items: readonly T[]): T[] {
  if (items.length <= EVERY_LABEL_MAX_BUCKETS) return [...items];
  const first = items[0];
  const last = items.at(-1);
  return first === undefined || last === undefined ? [] : [first, last];
}

import { categoryColor } from '../design/palette.ts';
import type { ChartSegment } from './chart-math.ts';
import type { DayBucket } from './DayBars.tsx';
import { type TokenCounts, totalTokens } from './token-amount.ts';

export function countsOf(total: number): TokenCounts {
  const input = Math.round(total * 0.04);
  const output = Math.round(total * 0.06);
  const cacheWrite = Math.round(total * 0.1);
  return {
    input,
    output,
    cacheWrite,
    cacheRead: total - input - output - cacheWrite,
  };
}

function roleSegment(
  label: string,
  index: number,
  value: number,
): ChartSegment {
  return {
    label,
    value,
    color: categoryColor(index),
    counts: countsOf(value),
    costUsd: value / 400_000,
  };
}

export const ROLE_SEGMENTS: ChartSegment[] = [
  roleSegment('builder', 0, 4_500_000),
  roleSegment('reviewer', 1, 3_000_000),
  roleSegment('shipper', 2, 1_500_000),
  roleSegment('spec checker', 3, 1_000_000),
];

export const TINY_SEGMENTS: ChartSegment[] = [
  roleSegment('builder', 0, 9_990_000),
  roleSegment('reviewer', 1, 10_000),
];

export const ZERO_SEGMENTS: ChartSegment[] = ROLE_SEGMENTS.map((segment) => ({
  ...segment,
  value: 0,
  counts: countsOf(0),
  costUsd: 0,
}));

const DAY_VALUES = [12, 19, 7, 0, 15, 22, 9, 4, 17, 11, 25, 6, 13, 18, 3];

function wave(index: number): number {
  return DAY_VALUES[index % DAY_VALUES.length] ?? 0;
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

function tokenBucket(label: string, value: number): DayBucket {
  const counts = countsOf(value);
  return {
    label,
    value: totalTokens(counts),
    counts,
    costUsd: value / 400_000,
  };
}

export function tokenDays(count: number): DayBucket[] {
  return Array.from({ length: count }, (_, index) =>
    tokenBucket(`2026-11-${twoDigits(index + 1)}`, wave(index) * 100_000),
  );
}

export function tokenHours(): DayBucket[] {
  return Array.from({ length: 24 }, (_, index) =>
    tokenBucket(`2026-11-22T${twoDigits(index)}:00`, wave(index) * 10_000),
  );
}

export function zeroDays(count: number): DayBucket[] {
  return Array.from({ length: count }, (_, index) =>
    tokenBucket(`2026-11-${twoDigits(index + 1)}`, 0),
  );
}

export function launchDays(count: number): DayBucket[] {
  return Array.from({ length: count }, (_, index) => ({
    label: `2026-11-${twoDigits(index + 1)}`,
    value: wave(index) % 5,
  }));
}

import type { TrendUnit } from '../stats/types.ts';
import { flowLoaderOf, flowOf } from './flow-fixtures.ts';
import type { LoadAutonomy, LoadFlow, LoadQuality } from './stats-api.ts';
import {
  autonomyLoaderOf,
  autonomyOf,
  qualityLoaderOf,
  qualityOf,
} from './stats-fixtures.ts';

export const PERIOD_NOW = new Date(2026, 10, 23, 14, 20);

export type TrendCount = readonly [merged: number, alone: number];

export interface PeriodTrend {
  unit: TrendUnit;
  starts: readonly string[];
  counts: readonly TrendCount[];
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

function dayKey(date: Date): string {
  return `${String(date.getFullYear())}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
}

function daysBack(count: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    dayKey(
      new Date(
        PERIOD_NOW.getFullYear(),
        PERIOD_NOW.getMonth(),
        PERIOD_NOW.getDate() - (count - 1 - index),
      ),
    ),
  );
}

const HOUR_COUNTS: Record<number, TrendCount> = {
  9: [1, 1],
  10: [2, 1],
  11: [1, 1],
  14: [3, 2],
};

export const todayTrend: PeriodTrend = {
  unit: 'hour',
  starts: Array.from(
    { length: 24 },
    (_, hour) => `${dayKey(PERIOD_NOW)}T${twoDigits(hour)}:00`,
  ),
  counts: Array.from({ length: 24 }, (_, hour) => HOUR_COUNTS[hour] ?? [0, 0]),
};

export const weekTrend: PeriodTrend = {
  unit: 'day',
  starts: daysBack(7),
  counts: [
    [2, 1],
    [0, 0],
    [5, 4],
    [3, 2],
    [1, 1],
    [6, 5],
    [3, 2],
  ],
};

const MONTH_DAY_COUNTS: readonly TrendCount[] = [
  [1, 0],
  [0, 0],
  [2, 1],
  [5, 3],
  [1, 1],
  [0, 0],
  [3, 2],
  [6, 4],
  [2, 2],
  [0, 0],
];

export const monthTrend: PeriodTrend = {
  unit: 'day',
  starts: daysBack(30),
  counts: Array.from(
    { length: 30 },
    (_, index) => MONTH_DAY_COUNTS[index % MONTH_DAY_COUNTS.length] ?? [0, 0],
  ),
};

export const weeksTrend: PeriodTrend = {
  unit: 'week',
  starts: [
    '2026-09-28',
    '2026-10-05',
    '2026-10-12',
    '2026-10-19',
    '2026-10-26',
    '2026-11-02',
    '2026-11-09',
    '2026-11-16',
    '2026-11-23',
  ],
  counts: [
    [4, 1],
    [6, 3],
    [2, 1],
    [7, 4],
    [5, 4],
    [8, 6],
    [3, 3],
    [9, 8],
    [2, 2],
  ],
};

export const monthsTrend: PeriodTrend = {
  unit: 'month',
  starts: [
    '2026-03-01',
    '2026-04-01',
    '2026-05-01',
    '2026-06-01',
    '2026-07-01',
    '2026-08-01',
    '2026-09-01',
    '2026-10-01',
    '2026-11-01',
  ],
  counts: [
    [3, 1],
    [12, 5],
    [18, 9],
    [15, 9],
    [21, 14],
    [19, 14],
    [24, 18],
    [26, 21],
    [17, 15],
  ],
};

export interface PeriodLoaders {
  loadAutonomy: LoadAutonomy;
  loadQuality: LoadQuality;
  loadFlow: LoadFlow;
}

export function periodLoaders({
  unit,
  starts,
  counts,
}: PeriodTrend): PeriodLoaders {
  const at = (index: number): TrendCount => counts[index] ?? [0, 0];
  return {
    loadAutonomy: autonomyLoaderOf(
      autonomyOf({
        unit,
        buckets: starts.map((start, index) => ({
          start,
          merged: at(index)[0],
          mergedWithoutPerson: at(index)[1],
        })),
      }),
    ),
    loadQuality: qualityLoaderOf(
      qualityOf({
        unit,
        buckets: starts.map((start, index) => ({
          start,
          mergedWithReport: at(index)[0],
          firstPassed: at(index)[1],
        })),
      }),
    ),
    loadFlow: flowLoaderOf(
      flowOf({
        unit,
        buckets: starts.map((start, index) => ({
          start,
          merged: at(index)[0],
        })),
      }),
    ),
  };
}

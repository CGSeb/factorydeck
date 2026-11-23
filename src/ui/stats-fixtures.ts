import type {
  AutonomyCounts,
  AutonomyReasons,
  AutonomyResponse,
  AutonomyStats,
  AutonomyWeek,
} from '../stats/types.ts';
import type { LoadAutonomy } from './stats-api.ts';

const HOUR = 3_600_000;

const WEEK_STARTS = [
  '2026-09-07',
  '2026-09-14',
  '2026-09-21',
  '2026-09-28',
  '2026-10-05',
  '2026-10-12',
  '2026-10-19',
  '2026-10-26',
  '2026-11-02',
  '2026-11-09',
  '2026-11-16',
  '2026-11-23',
];

export function weeksOf(
  counts: readonly (readonly [number, number])[],
): AutonomyWeek[] {
  return WEEK_STARTS.map((start, index) => {
    const [merged, mergedWithoutPerson] = counts[index] ?? [0, 0];
    return { start, merged, mergedWithoutPerson };
  });
}

export const risingWeeks = weeksOf([
  [5, 1],
  [4, 1],
  [6, 2],
  [5, 2],
  [3, 1],
  [6, 3],
  [5, 3],
  [6, 4],
  [5, 4],
  [6, 5],
  [7, 6],
  [2, 2],
]);

export const emptyWeeks = weeksOf([]);

export const someReasons: AutonomyReasons = {
  specQuestion: 3,
  belowThreshold: 2,
  gatesFailed: 1,
  autoMergeOff: 1,
  total: 6,
};

export const noReasons: AutonomyReasons = {
  specQuestion: 0,
  belowThreshold: 0,
  gatesFailed: 0,
  autoMergeOff: 0,
  total: 0,
};

export const monthCounts: AutonomyCounts = {
  merged: 24,
  mergedWithoutPerson: 18,
  mergedAfterQuestion: 6,
  answeredWaitsMs: [2, 3, 3.1, 5, 7, 28].map((hours) => hours * HOUR),
};

export const previousMonthCounts: AutonomyCounts = {
  merged: 20,
  mergedWithoutPerson: 11,
  mergedAfterQuestion: 7,
  answeredWaitsMs: [4, 6, 9, 26, 30].map((hours) => hours * HOUR),
};

export const noCounts: AutonomyCounts = {
  merged: 0,
  mergedWithoutPerson: 0,
  mergedAfterQuestion: 0,
  answeredWaitsMs: [],
};

export function autonomyOf(
  overrides: Partial<AutonomyStats> = {},
): AutonomyStats {
  return {
    current: monthCounts,
    previous: previousMonthCounts,
    waitingNow: 2,
    weeks: risingWeeks,
    reasons: someReasons,
    ...overrides,
  };
}

export function autonomyResponse(autonomy: AutonomyStats): AutonomyResponse {
  return {
    status: 'ok',
    updatedAt: '2026-11-23T09:00:00.000Z',
    refreshSeconds: 3600,
    autonomy,
  };
}

export function autonomyLoaderOf(
  autonomy: AutonomyStats = autonomyOf(),
): LoadAutonomy {
  return () => Promise.resolve(autonomyResponse(autonomy));
}

export const unreachableAutonomy: LoadAutonomy = () =>
  Promise.resolve({ status: 'unreachable', refreshSeconds: 3600 });

export const pendingAutonomy: LoadAutonomy = () => new Promise(() => undefined);

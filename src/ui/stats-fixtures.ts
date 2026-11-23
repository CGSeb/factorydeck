import type {
  AutonomyCounts,
  AutonomyReasons,
  AutonomyResponse,
  AutonomyStats,
  AutonomyBucket,
  FirstReport,
  QualityCounts,
  QualityResponse,
  QualityStats,
  QualityBucket,
} from '../stats/types.ts';
import type { LoadAutonomy, LoadQuality } from './stats-api.ts';

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
): AutonomyBucket[] {
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
  below1To5: 2,
  below6To15: 3,
  below16Plus: 1,
  gatesFailed: 1,
  specQuestion: 2,
  autoMergeOff: 1,
  total: 10,
  roundsSum: 11,
  roundsCount: 6,
};

export const noReasons: AutonomyReasons = {
  below1To5: 0,
  below6To15: 0,
  below16Plus: 0,
  gatesFailed: 0,
  specQuestion: 0,
  autoMergeOff: 0,
  total: 0,
  roundsSum: 0,
  roundsCount: 0,
};

export const monthCounts: AutonomyCounts = {
  merged: 24,
  mergedWithoutPerson: 18,
  mergedAfterQuestion: 6,
  stopWaitsMs: [2, 3, 3.1, 5, 7, 28].map((hours) => hours * HOUR),
};

export const previousMonthCounts: AutonomyCounts = {
  merged: 20,
  mergedWithoutPerson: 11,
  mergedAfterQuestion: 7,
  stopWaitsMs: [4, 6, 9, 26, 30].map((hours) => hours * HOUR),
};

export const noCounts: AutonomyCounts = {
  merged: 0,
  mergedWithoutPerson: 0,
  mergedAfterQuestion: 0,
  stopWaitsMs: [],
};

export function autonomyOf(
  overrides: Partial<AutonomyStats> = {},
): AutonomyStats {
  return {
    current: monthCounts,
    previous: previousMonthCounts,
    waitingNow: 2,
    unit: 'week',
    buckets: risingWeeks,
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

export function qualityWeeksOf(
  counts: readonly (readonly [number, number])[],
): QualityBucket[] {
  return WEEK_STARTS.map((start, index) => {
    const [mergedWithReport, firstPassed] = counts[index] ?? [0, 0];
    return { start, mergedWithReport, firstPassed };
  });
}

export const risingQualityWeeks = qualityWeeksOf([
  [5, 2],
  [4, 2],
  [6, 3],
  [5, 3],
  [3, 2],
  [6, 4],
  [5, 3],
  [6, 4],
  [5, 4],
  [6, 5],
  [7, 6],
  [2, 2],
]);

export const emptyQualityWeeks = qualityWeeksOf([]);

export const monthQuality: QualityCounts = {
  merged: 24,
  mergedWithReport: 22,
  firstPassed: 15,
  roundsSum: 31,
  roundsCount: 22,
  gainSum: 108,
  gainCount: 9,
};

export const previousMonthQuality: QualityCounts = {
  merged: 20,
  mergedWithReport: 18,
  firstPassed: 10,
  roundsSum: 32,
  roundsCount: 18,
  gainSum: 56,
  gainCount: 7,
};

export const noQuality: QualityCounts = {
  merged: 0,
  mergedWithReport: 0,
  firstPassed: 0,
  roundsSum: 0,
  roundsCount: 0,
  gainSum: 0,
  gainCount: 0,
};

export const mixedFirstReports: FirstReport[] = [
  [62, 80],
  [71, 80],
  [78, 80],
  [83, 80],
  [86, 85],
  [88, 80],
  [91, 85],
  [93, 80],
  [95, 90],
  [97, 80],
].map(([score = 0, threshold = 80], index) => ({
  score,
  threshold,
  time: `2026-11-${String(10 + index).padStart(2, '0')}T09:00:00Z`,
}));

export function qualityOf(overrides: Partial<QualityStats> = {}): QualityStats {
  return {
    current: monthQuality,
    previous: previousMonthQuality,
    unit: 'week',
    buckets: risingQualityWeeks,
    firstReports: mixedFirstReports,
    ...overrides,
  };
}

export function qualityResponse(quality: QualityStats): QualityResponse {
  return {
    status: 'ok',
    updatedAt: '2026-11-23T09:00:00.000Z',
    refreshSeconds: 3600,
    quality,
  };
}

export function qualityLoaderOf(
  quality: QualityStats = qualityOf(),
): LoadQuality {
  return () => Promise.resolve(qualityResponse(quality));
}

export const unreachableQuality: LoadQuality = () =>
  Promise.resolve({ status: 'unreachable', refreshSeconds: 3600 });

export const pendingQuality: LoadQuality = () => new Promise(() => undefined);

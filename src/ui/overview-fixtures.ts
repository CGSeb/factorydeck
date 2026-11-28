import type { FeatureRow } from '../features/types.ts';
import { boardFeatures } from './feature-board-fixtures.ts';
import { APP, asBug, found, outcome } from './feature-fixtures.ts';
import { splitTokens } from './token-fixtures.ts';

function mergedRow(number: number, title: string, day: number): FeatureRow {
  const tokens = 1_500_000 + number * 10_000;
  return {
    ...found(APP, number, title),
    outcome: outcome('merged', 84, 1),
    lastAt: `2026-01-0${String(day)}T15:00:00.000Z`,
    sessions: 2,
    apiCalls: 150,
    tokens,
    tokenCounts: splitTokens(tokens),
    costUsd: tokens / 500_000,
    orchestrationCostUsd: null,
    roles: [
      {
        role: 'builder',
        tokens,
        tokenCounts: splitTokens(tokens),
        costUsd: tokens / 500_000,
      },
    ],
  };
}

export const fullBoardFeatures: FeatureRow[] = [
  ...boardFeatures,
  mergedRow(30, 'Search filters', 6),
  mergedRow(31, 'Keyboard shortcuts', 6),
  mergedRow(32, 'CSV export', 2),
  mergedRow(33, 'Empty states', 2),
];

export const afterPersonFeatures: FeatureRow[] = fullBoardFeatures.map((row) =>
  row.number === 30
    ? { ...row, outcome: outcome('merged-after-person', 88, 2) }
    : row,
);

function inReviewRow(
  number: number,
  title: string,
  score: number | null,
  rounds: number | null,
): FeatureRow {
  const [base] = boardFeatures;
  if (base === undefined) throw new Error('No board feature');
  return {
    ...base,
    ...found(APP, number, title),
    outcome: outcome('in-review', score, rounds),
  };
}

export const inReviewFeatures: FeatureRow[] = [
  inReviewRow(70, 'Retry failed exports', 48, 3),
  inReviewRow(71, 'Webhook signatures', 80, null),
  inReviewRow(72, 'Bulk tag edit', null, null),
];

export const unmergedFeatures: FeatureRow[] = boardFeatures.filter(
  (row) =>
    row.outcome?.stage !== 'merged' &&
    row.outcome?.stage !== 'merged-by-person' &&
    row.outcome?.stage !== 'merged-after-person',
);

const BUG_NUMBERS: ReadonlySet<number> = new Set([
  63, 57, 52, 48, 30, 31, 32, 33,
]);

export const bugBoardFeatures: FeatureRow[] = fullBoardFeatures.map((row) =>
  row.project === APP && BUG_NUMBERS.has(row.number) ? asBug(row) : row,
);

export const offBoardBugFeatures: FeatureRow[] = [
  ...fullBoardFeatures,
  asBug({
    ...mergedRow(70, 'Stale cache', 3),
    outcome: outcome('closed', null),
  }),
  asBug({ ...mergedRow(71, 'Lost draft', 4), outcome: null }),
];

import type { FeatureRow } from '../features/types.ts';
import { boardFeatures } from './feature-board-fixtures.ts';
import { APP, found, outcome } from './feature-fixtures.ts';
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

export const unmergedFeatures: FeatureRow[] = boardFeatures.filter(
  (row) =>
    row.outcome?.stage !== 'merged' &&
    row.outcome?.stage !== 'merged-by-person',
);

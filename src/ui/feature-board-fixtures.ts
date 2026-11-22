import type { FeatureRoleShare, FeatureRow } from '../features/types.ts';
import type { IssueOutcome } from '../git-host/types.ts';
import { APP, LIB, found, outcome } from './feature-fixtures.ts';
import { nameOf } from './project-fixtures.ts';
import { splitTokens } from './token-fixtures.ts';

function shares(
  tokens: number,
  costUsd: number | null,
  split: readonly (readonly [string, number])[],
): FeatureRoleShare[] {
  return split.map(([role, part]) => ({
    role,
    tokens: Math.round(tokens * part),
    tokenCounts: splitTokens(Math.round(tokens * part)),
    costUsd: costUsd === null ? null : costUsd * part,
  }));
}

const FULL_SPLIT = [
  ['builder', 0.6],
  ['reviewer', 0.25],
  ['Orchestration', 0.15],
] as const;

function boardRow(
  base: Pick<FeatureRow, 'project' | 'projectName' | 'number' | 'issue'>,
  stage: IssueOutcome['stage'] | null,
  figures: {
    lastAt: string;
    sessions: number;
    tokens: number;
    costUsd?: number | null;
    score?: number | null;
    rounds?: number | null;
  },
): FeatureRow {
  const costUsd =
    figures.costUsd === undefined ? figures.tokens / 500_000 : figures.costUsd;
  return {
    ...base,
    outcome:
      stage === null
        ? null
        : outcome(stage, figures.score ?? null, figures.rounds ?? null),
    lastAt: figures.lastAt,
    sessions: figures.sessions,
    apiCalls: Math.round(figures.tokens / 10_000),
    tokens: figures.tokens,
    tokenCounts: splitTokens(figures.tokens),
    orchestrationCostUsd: costUsd === null ? null : costUsd * 0.15,
    costUsd,
    roles: shares(figures.tokens, costUsd, FULL_SPLIT),
  };
}

export const boardFeatures: FeatureRow[] = [
  boardRow(found(APP, 61, 'Bulk import'), 'in-review', {
    lastAt: '2026-01-07T09:00:00.000Z',
    sessions: 4,
    tokens: 6_400_000,
    score: 82,
    rounds: 2,
  }),
  boardRow(found(LIB, 60, 'Retry policy'), 'in-review', {
    lastAt: '2026-01-07T08:00:00.000Z',
    sessions: 2,
    tokens: 1_900_000,
  }),
  boardRow(found(APP, 57, 'Dark mode'), 'working', {
    lastAt: '2026-01-07T07:30:00.000Z',
    sessions: 1,
    tokens: 800_000,
  }),
  boardRow(found(LIB, 58, 'Typed errors'), 'working', {
    lastAt: '2026-01-06T16:00:00.000Z',
    sessions: 2,
    tokens: 2_300_000,
  }),
  boardRow(found(APP, 63, 'Audit log'), 'needs-spec', {
    lastAt: '2026-01-06T10:00:00.000Z',
    sessions: 1,
    tokens: 120_000,
  }),
  boardRow(found(LIB, 64, 'Rate limits'), 'blocked', {
    lastAt: '2026-01-05T10:00:00.000Z',
    sessions: 1,
    tokens: 340_000,
  }),
  boardRow(found(APP, 52, 'Export button'), 'merged', {
    lastAt: '2026-01-04T12:00:00.000Z',
    sessions: 3,
    tokens: 4_200_000,
    score: 86,
    rounds: 1,
  }),
  boardRow(found(APP, 48, 'Session list'), 'merged-by-person', {
    lastAt: '2026-01-03T12:00:00.000Z',
    sessions: 5,
    tokens: 7_100_000,
    score: 70,
    rounds: 3,
  }),
  boardRow(found(LIB, 45, 'Config loader'), 'merged', {
    lastAt: '2026-01-05T12:00:00.000Z',
    sessions: 2,
    tokens: 2_900_000,
    costUsd: null,
    score: 91,
    rounds: 0,
  }),
  boardRow(found(APP, 44, 'Old charts'), 'closed', {
    lastAt: '2026-01-02T12:00:00.000Z',
    sessions: 1,
    tokens: 450_000,
  }),
  boardRow(
    {
      project: APP,
      projectName: nameOf(APP),
      number: 70,
      issue: { status: 'not-found' },
    },
    null,
    { lastAt: '2026-01-06T12:00:00.000Z', sessions: 1, tokens: 90_000 },
  ),
  boardRow(
    {
      project: LIB,
      projectName: nameOf(LIB),
      number: 12,
      issue: { status: 'not-collected' },
    },
    null,
    { lastAt: '2026-01-01T12:00:00.000Z', sessions: 1, tokens: 60_000 },
  ),
];

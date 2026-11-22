import type {
  FeatureList,
  FeatureListResponse,
  FeatureRoleShare,
  FeatureRow,
  FeatureUsage,
} from '../features/types.ts';
import type { IssueOutcome } from '../git-host/types.ts';
import type { LoadFeatures } from './features-api.ts';
import { nameOf, optionsOf } from './project-fixtures.ts';
import { splitTokens } from './token-fixtures.ts';

export const APP = '/home/dev/example-app';
export const LIB = '/home/dev/example-lib';

export function outcome(
  stage: IssueOutcome['stage'],
  score: number | null,
  rounds: number | null = null,
): IssueOutcome {
  return {
    stage,
    report: score === null ? null : { score, threshold: 80, rounds },
    reworked: false,
  };
}

export function found(
  project: string,
  number: number,
  title: string,
): Pick<FeatureRow, 'project' | 'projectName' | 'number' | 'issue'> {
  return {
    project,
    projectName: nameOf(project),
    number,
    issue: {
      status: 'found',
      title,
      url: `https://github.com/example-org/example-app/issues/${String(number)}`,
    },
  };
}

function builderOnly(tokens: number, costUsd: number | null) {
  const roles: FeatureRoleShare[] = [
    { role: 'builder', tokens, tokenCounts: splitTokens(tokens), costUsd },
  ];
  return { roles };
}

export const someFeatures: FeatureRow[] = [
  {
    ...found(APP, 52, 'Export button'),
    outcome: outcome('merged', 86, 1),
    lastAt: '2026-01-05T09:00:00.000Z',
    sessions: 3,
    apiCalls: 410,
    tokens: 4_200_000,
    tokenCounts: splitTokens(4_200_000),
    orchestrationCostUsd: 1.2,
    costUsd: 8.5,
    ...builderOnly(4_200_000, 8.5),
  },
  {
    ...found(APP, 28, 'Session list'),
    outcome: outcome('merged-by-person', 70, 3),
    lastAt: '2026-01-05T09:00:00.000Z',
    sessions: 2,
    apiCalls: 220,
    tokens: 2_100_000,
    tokenCounts: splitTokens(2_100_000),
    orchestrationCostUsd: 0.4,
    costUsd: 4.25,
    ...builderOnly(2_100_000, 4.25),
  },
  {
    project: LIB,
    projectName: nameOf(LIB),
    number: 28,
    issue: { status: 'not-collected' },
    outcome: null,
    lastAt: '2026-01-05T09:00:00.000Z',
    sessions: 1,
    apiCalls: 60,
    tokens: 600_000,
    tokenCounts: splitTokens(600_000),
    orchestrationCostUsd: null,
    costUsd: 1.1,
    ...builderOnly(600_000, 1.1),
  },
  {
    ...found(APP, 40, 'Dark mode'),
    outcome: outcome('working', null),
    lastAt: '2026-01-05T09:00:00.000Z',
    sessions: 1,
    apiCalls: 30,
    tokens: 300_000,
    tokenCounts: splitTokens(300_000),
    orchestrationCostUsd: null,
    costUsd: 0.6,
    ...builderOnly(300_000, 0.6),
  },
  {
    project: APP,
    projectName: nameOf(APP),
    number: 99,
    issue: { status: 'not-found' },
    outcome: null,
    lastAt: '2026-01-05T09:00:00.000Z',
    sessions: 1,
    apiCalls: 4,
    tokens: 50_000,
    tokenCounts: splitTokens(50_000),
    orchestrationCostUsd: null,
    costUsd: null,
    ...builderOnly(50_000, null),
  },
];

export const noWorkItem: FeatureUsage = {
  sessions: 2,
  apiCalls: 80,
  tokens: 900_000,
  tokenCounts: splitTokens(900_000),
  costUsd: 1.8,
  orchestrationCostUsd: null,
};

export function featureList(
  rows: FeatureRow[],
  unassigned: FeatureUsage | null = noWorkItem,
): FeatureList {
  const all = [...rows, ...(unassigned === null ? [] : [unassigned])];
  const merged = rows.filter(
    (row) =>
      row.outcome?.stage === 'merged' ||
      row.outcome?.stage === 'merged-by-person' ||
      row.outcome?.stage === 'merged-after-person',
  );
  const mergedCost = merged.reduce((sum, row) => sum + (row.costUsd ?? 0), 0);
  return {
    rows,
    noWorkItem: unassigned,
    totals: {
      sessions: all.reduce((sum, row) => sum + row.sessions, 0),
      apiCalls: all.reduce((sum, row) => sum + row.apiCalls, 0),
      tokens: all.reduce((sum, row) => sum + row.tokens, 0),
      tokenCounts: {
        input: all.reduce((sum, row) => sum + row.tokenCounts.input, 0),
        cacheWrite: all.reduce(
          (sum, row) => sum + row.tokenCounts.cacheWrite,
          0,
        ),
        cacheRead: all.reduce((sum, row) => sum + row.tokenCounts.cacheRead, 0),
        output: all.reduce((sum, row) => sum + row.tokenCounts.output, 0),
      },
      costUsd: all.reduce((sum, row) => sum + (row.costUsd ?? 0), 0),
      unknownPriceCalls: all
        .filter((row) => row.costUsd === null)
        .reduce((sum, row) => sum + row.apiCalls, 0),
    },
    merged: {
      issues: merged.length,
      costPerIssueUsd: merged.length === 0 ? null : mergedCost / merged.length,
      tokensPerIssue:
        merged.length === 0
          ? null
          : Math.round(
              merged.reduce((sum, row) => sum + row.tokens, 0) / merged.length,
            ),
      withoutPerson:
        merged.length === 0
          ? null
          : merged.filter((row) => row.outcome?.stage === 'merged').length /
            merged.length,
      unknownPriceCalls: 0,
    },
    projects: optionsOf([APP, LIB]),
  };
}

export function featuresResponse(list: FeatureList): FeatureListResponse {
  return {
    status: 'ok',
    updatedAt: '2026-01-07T09:41:05.000Z',
    refreshSeconds: 3600,
    list,
  };
}

export function featuresLoaderOf(rows: FeatureRow[]): LoadFeatures {
  return (filters) => {
    if (rows.length === 0) {
      return Promise.resolve(featuresResponse(featureList([], null)));
    }
    const scoped =
      filters.project === undefined
        ? rows
        : rows.filter((row) => row.project === filters.project);
    const unassigned = filters.project === LIB ? null : noWorkItem;
    return Promise.resolve(
      featuresResponse(
        featureList(
          filters.period === 'today' ? scoped.slice(0, 1) : scoped,
          unassigned,
        ),
      ),
    );
  };
}

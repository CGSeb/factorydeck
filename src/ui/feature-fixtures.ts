import type {
  FeatureDetail,
  FeatureList,
  FeatureListResponse,
  FeatureResponse,
  FeatureRow,
  FeatureUsage,
} from '../features/types.ts';
import type { IssueOutcome } from '../git-host/types.ts';
import type { LoadFeature, LoadFeatures } from './features-api.ts';
import { githubIssue } from './git-host-fixtures.ts';

export const APP = '/home/dev/example-app';
export const LIB = '/home/dev/example-lib';

const MINUTE = 60_000;

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * MINUTE).toISOString();
}

function outcome(
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

function found(project: string, number: number, title: string) {
  return {
    project,
    number,
    issue: {
      status: 'found' as const,
      title,
      url: `https://github.com/example-org/example-app/issues/${String(number)}`,
    },
  };
}

export const someFeatures: FeatureRow[] = [
  {
    ...found(APP, 52, 'Export button'),
    outcome: outcome('merged', 86, 1),
    sessions: 3,
    apiCalls: 410,
    tokens: 4_200_000.4,
    orchestrationCostUsd: 1.2,
    costUsd: 8.5,
  },
  {
    ...found(APP, 28, 'Session list'),
    outcome: outcome('merged-by-person', 70, 3),
    sessions: 2,
    apiCalls: 220,
    tokens: 2_100_000,
    orchestrationCostUsd: 0.4,
    costUsd: 4.25,
  },
  {
    project: LIB,
    number: 28,
    issue: { status: 'not-collected' },
    outcome: null,
    sessions: 1,
    apiCalls: 60,
    tokens: 600_000,
    orchestrationCostUsd: null,
    costUsd: 1.1,
  },
  {
    ...found(APP, 40, 'Dark mode'),
    outcome: outcome('working', null),
    sessions: 1,
    apiCalls: 30,
    tokens: 300_000,
    orchestrationCostUsd: null,
    costUsd: 0.6,
  },
  {
    project: APP,
    number: 99,
    issue: { status: 'not-found' },
    outcome: null,
    sessions: 1,
    apiCalls: 4,
    tokens: 50_000,
    orchestrationCostUsd: null,
    costUsd: null,
  },
];

export const noWorkItem: FeatureUsage = {
  sessions: 2,
  apiCalls: 80,
  tokens: 900_000,
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
      row.outcome?.stage === 'merged-by-person',
  );
  const mergedCost = merged.reduce((sum, row) => sum + (row.costUsd ?? 0), 0);
  return {
    rows,
    noWorkItem: unassigned,
    totals: {
      apiCalls: all.reduce((sum, row) => sum + row.apiCalls, 0),
      tokens: all.reduce((sum, row) => sum + row.tokens, 0),
      costUsd: all.reduce((sum, row) => sum + (row.costUsd ?? 0), 0),
      unknownPriceCalls: all
        .filter((row) => row.costUsd === null)
        .reduce((sum, row) => sum + row.apiCalls, 0),
    },
    merged: {
      issues: merged.length,
      costPerIssueUsd: merged.length === 0 ? null : mergedCost / merged.length,
      withoutPerson:
        merged.length === 0
          ? null
          : merged.filter((row) => row.outcome?.stage === 'merged').length /
            merged.length,
      unknownPriceCalls: 0,
    },
    projects: [APP, LIB],
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

export const exportFeature: FeatureDetail = {
  project: APP,
  number: 52,
  issue: {
    status: 'found',
    title: githubIssue.title,
    url: githubIssue.url,
  },
  detail: githubIssue,
  roles: [
    {
      role: 'builder',
      threads: 3,
      apiCalls: 260,
      tokens: 2_900_000,
      costUsd: 5.6,
    },
    {
      role: 'reviewer',
      threads: 2,
      apiCalls: 90,
      tokens: 800_000,
      costUsd: 1.7,
    },
  ],
  orchestration: {
    role: 'Orchestration',
    threads: 2,
    apiCalls: 60,
    tokens: 500_000.4,
    costUsd: 1.2,
  },
  sessions: [
    {
      id: '6f1c2d3e-0000-4000-8000-000000000001',
      title: 'Build the export button',
      state: 'working',
      lastAt: minutesAgo(3),
      tokens: 3_100_000.4,
      costUsd: 6.4,
    },
    {
      id: '6f1c2d3e-0000-4000-8000-000000000002',
      title: '',
      state: 'inactive',
      lastAt: minutesAgo(60 * 26),
      tokens: 1_100_000,
      costUsd: 2.1,
    },
  ],
};

export const uncollectedFeature: FeatureDetail = {
  project: LIB,
  number: 28,
  issue: { status: 'not-collected' },
  detail: null,
  roles: [],
  orchestration: null,
  sessions: [],
};

export function featureResponse(feature: FeatureDetail): FeatureResponse {
  return {
    status: 'ok',
    updatedAt: '2026-01-07T09:41:05.000Z',
    refreshSeconds: 3600,
    feature,
  };
}

export function featureLoaderOf(
  features: FeatureDetail[] = [exportFeature, uncollectedFeature],
): LoadFeature {
  return ({ project, number }) => {
    const feature = features.find(
      (row) => row.project === project && row.number === number,
    );
    return Promise.resolve(
      feature === undefined
        ? { status: 'not-found', refreshSeconds: 3600 }
        : featureResponse(feature),
    );
  };
}

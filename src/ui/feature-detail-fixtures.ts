import type {
  FeatureDetail,
  FeatureResponse,
  FeatureThread,
} from '../features/types.ts';
import type { IssueDetail } from '../git-host/types.ts';
import { APP, LIB } from './feature-fixtures.ts';
import type { LoadFeature } from './features-api.ts';
import { githubIssue } from './git-host-fixtures.ts';
import { nameOf } from './project-fixtures.ts';
import { splitTokens } from './token-fixtures.ts';

const MINUTE = 60_000;

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * MINUTE).toISOString();
}

const SESSION_IDS = [
  '6f1c2d3e-0000-4000-8000-000000000001',
  '6f1c2d3e-0000-4000-8000-000000000002',
];

interface ThreadSpec {
  session: 1 | 2;
  threadId: string;
  role: string;
  description: string | null;
  day: number;
  tokens: number;
  costUsd: number | null;
}

function thread({
  session,
  threadId,
  role,
  description,
  day,
  tokens,
  costUsd,
}: ThreadSpec): FeatureThread {
  const start = Date.UTC(2026, 10, 18 + day, 9);
  return {
    sessionId: SESSION_IDS[session - 1] ?? '',
    sessionTitle: session === 1 ? 'Build the export button' : '',
    sessionAgent: 'claude-code',
    threadId,
    role,
    description,
    firstAt: new Date(start).toISOString(),
    lastAt: new Date(start + 2 * 60 * MINUTE).toISOString(),
    tokens,
    tokenCounts: splitTokens(tokens),
    costUsd,
  };
}

const mergedByPersonIssue: IssueDetail = {
  ...githubIssue,
  state: 'closed',
  labels: [
    { name: 'spec', color: null },
    { name: 'agent:review', color: null },
  ],
  outcome: {
    stage: 'merged-by-person',
    report: { score: 64, threshold: 80, rounds: 2 },
    reworked: true,
  },
};

const exportFeature: FeatureDetail = {
  project: APP,
  projectName: nameOf(APP),
  number: 52,
  issue: {
    status: 'found',
    title: githubIssue.title,
    url: githubIssue.url,
  },
  detail: mergedByPersonIssue,
  roles: [
    {
      role: 'builder',
      threads: 3,
      apiCalls: 260,
      tokens: 2_900_000,
      tokenCounts: splitTokens(2_900_000),
      costUsd: 5.6,
    },
    {
      role: 'reviewer',
      threads: 2,
      apiCalls: 90,
      tokens: 800_000,
      tokenCounts: splitTokens(800_000),
      costUsd: 1.7,
    },
  ],
  orchestration: {
    role: 'Orchestration',
    threads: 2,
    apiCalls: 60,
    tokens: 500_000,
    tokenCounts: splitTokens(500_000),
    costUsd: 1.2,
  },
  sessions: [
    {
      id: '6f1c2d3e-0000-4000-8000-000000000001',
      title: 'Build the export button',
      state: 'working',
      lastAt: minutesAgo(3),
      tokens: 3_100_000,
      tokenCounts: splitTokens(3_100_000),
      costUsd: 6.4,
    },
    {
      id: '6f1c2d3e-0000-4000-8000-000000000002',
      title: '',
      state: 'inactive',
      lastAt: minutesAgo(60 * 26),
      tokens: 1_100_000,
      tokenCounts: splitTokens(1_100_000),
      costUsd: 2.1,
    },
  ],
  threads: [
    thread({
      session: 1,
      threadId: 'agent-a1',
      role: 'builder',
      description: 'Build the export button',
      day: 0,
      tokens: 1_200_000,
      costUsd: 2.3,
    }),
    thread({
      session: 2,
      threadId: 'main',
      role: 'builder',
      description: null,
      day: 1,
      tokens: 900_000,
      costUsd: 1.7,
    }),
    thread({
      session: 1,
      threadId: 'agent-a2',
      role: 'reviewer',
      description: 'Review #58 round 1',
      day: 2,
      tokens: 400_000,
      costUsd: 0.9,
    }),
    thread({
      session: 2,
      threadId: 'agent-b1',
      role: 'builder',
      description: '  ',
      day: 3,
      tokens: 800_000,
      costUsd: 1.6,
    }),
    thread({
      session: 1,
      threadId: 'agent-a3',
      role: 'reviewer',
      description: 'Review #58 round 2',
      day: 4,
      tokens: 400_000,
      costUsd: 0.8,
    }),
  ],
  frictions: 7,
};

export const uncollectedFeature: FeatureDetail = {
  project: LIB,
  projectName: nameOf(LIB),
  number: 28,
  issue: { status: 'not-collected' },
  detail: null,
  roles: [],
  orchestration: null,
  sessions: [],
  threads: [],
  frictions: 0,
};

export const reviewFeature: FeatureDetail = {
  ...exportFeature,
  number: 61,
  issue: {
    status: 'found',
    title: 'Keyboard shortcuts',
    url: 'https://github.com/example-org/example-app/issues/61',
  },
  detail: {
    ...githubIssue,
    number: 61,
    title: 'Keyboard shortcuts',
    url: 'https://github.com/example-org/example-app/issues/61',
    labels: [{ name: 'agent:review', color: null }],
    outcome: { stage: 'in-review', report: null, reworked: false },
  },
  roles: [exportFeature.roles[0]].filter((role) => role !== undefined),
  orchestration: null,
  threads: exportFeature.threads.slice(0, 2),
};

const REVIEWED_REQUEST = {
  number: 58,
  url: 'https://github.com/example-org/example-app/pull/58',
};

export const afterPersonFeature: FeatureDetail = {
  ...exportFeature,
  number: 62,
  issue: {
    status: 'found',
    title: 'Saved filters',
    url: 'https://github.com/example-org/example-app/issues/62',
  },
  detail: {
    ...mergedByPersonIssue,
    number: 62,
    title: 'Saved filters',
    url: 'https://github.com/example-org/example-app/issues/62',
    outcome: {
      stage: 'merged-after-person',
      report: { score: 88, threshold: 80, rounds: 2, firstScore: 64 },
      reworked: false,
    },
    milestones: [
      {
        kind: 'report',
        at: new Date(Date.UTC(2026, 10, 20, 13)).toISOString(),
        request: REVIEWED_REQUEST,
        score: 64,
        threshold: 80,
        refused: true,
        reasons: ['below-threshold'],
      },
      {
        kind: 'report',
        at: new Date(Date.UTC(2026, 10, 22, 13)).toISOString(),
        request: REVIEWED_REQUEST,
        score: 88,
        threshold: 80,
        refused: false,
        reasons: [],
      },
    ],
  },
};

export const orchestrationFeature: FeatureDetail = {
  ...exportFeature,
  number: 70,
  issue: {
    status: 'found',
    title: 'Release notes',
    url: 'https://github.com/example-org/example-app/issues/70',
  },
  detail: null,
  roles: [],
  sessions: exportFeature.sessions.slice(0, 1),
  threads: [],
};

export const idleFeature: FeatureDetail = {
  ...orchestrationFeature,
  number: 71,
  issue: {
    status: 'found',
    title: 'Import button',
    url: 'https://github.com/example-org/example-app/issues/71',
  },
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
  features: FeatureDetail[] = [
    exportFeature,
    uncollectedFeature,
    reviewFeature,
    afterPersonFeature,
    orchestrationFeature,
    idleFeature,
  ],
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

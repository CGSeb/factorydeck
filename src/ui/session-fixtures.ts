import type {
  SessionDetail,
  SessionList,
  SessionListResponse,
  SessionResponse,
  SessionState,
  SessionSummary,
} from '../sessions/types.ts';
import { githubIssue } from './git-host-fixtures.ts';
import type {
  LoadSession,
  LoadSessions,
  SessionFilters,
} from './sessions-api.ts';
import { nameOf, optionsOf } from './project-fixtures.ts';

const MINUTE = 60_000;

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * MINUTE).toISOString();
}

export const workingSession: SessionSummary = {
  id: '7f3a9c21-0000-4000-8000-000000000001',
  title: 'Add the export button',
  project: '/home/dev/example-app',
  projectName: nameOf('/home/dev/example-app'),
  gitBranch: 'feat/export',
  workItem: 52,
  issue: {
    status: 'found',
    title: 'Export button',
    url: 'https://github.com/example-org/example-app/issues/52',
  },
  state: 'working',
  firstAt: minutesAgo(125),
  lastAt: minutesAgo(3),
  tokens: 4_210_000,
  costUsd: 6.42,
};

export const waitingSession: SessionSummary = {
  id: 'b81e44d0-0000-4000-8000-000000000002',
  title: '',
  project: '/home/dev/example-lib',
  projectName: nameOf('/home/dev/example-lib'),
  gitBranch: '',
  workItem: null,
  issue: null,
  state: 'waiting',
  firstAt: minutesAgo(40),
  lastAt: minutesAgo(12),
  tokens: 182_400,
  costUsd: null,
};

export const inactiveSession: SessionSummary = {
  id: 'c0ffee00-0000-4000-8000-000000000003',
  title: 'Fix the flaky test',
  project: 'unassigned',
  projectName: nameOf('unassigned'),
  gitBranch: 'main',
  workItem: null,
  issue: null,
  state: 'inactive',
  firstAt: minutesAgo(60 * 26),
  lastAt: minutesAgo(60 * 25),
  tokens: 950,
  costUsd: 0.004,
};

const PROJECTS = [
  '/home/dev/example-app',
  '/home/dev/example-lib',
  'unassigned',
];

function generated(index: number): SessionSummary {
  const id = String(index).padStart(4, '0');
  return {
    ...inactiveSession,
    id: `${id}0000-0000-4000-8000-000000000000`,
    title: `Synthetic session ${index}`,
    lastAt: minutesAgo(60 * 24 + index),
    firstAt: minutesAgo(60 * 25 + index),
  };
}

export function sessionList(
  sessions: SessionSummary[],
  filters: SessionFilters,
  limit: number,
): SessionList {
  const inScope = sessions.filter(
    (row) => filters.project === undefined || row.project === filters.project,
  );
  const matching = inScope.filter(
    (row) => filters.state === undefined || row.state === filters.state,
  );
  const counts: Record<SessionState, number> = {
    working: 0,
    waiting: 0,
    inactive: 0,
  };
  for (const row of inScope) counts[row.state] += 1;
  return {
    sessions: matching.slice(0, limit),
    total: matching.length,
    counts,
    projects: optionsOf(PROJECTS),
  };
}

export function listResponse(list: SessionList): SessionListResponse {
  return {
    status: 'ok',
    updatedAt: '2026-01-07T09:41:05.000Z',
    refreshSeconds: 3600,
    list,
  };
}

export function listLoader(sessions: SessionSummary[]): LoadSessions {
  return (filters, limit) =>
    Promise.resolve(listResponse(sessionList(sessions, filters, limit)));
}

export const someSessions = [workingSession, waitingSession, inactiveSession];

export const manySessions = [
  ...someSessions,
  ...Array.from({ length: 72 }, (_, index) => generated(index + 1)),
];

export const sessionWithSubAgents: SessionDetail = {
  ...workingSession,
  issueDetail: githubIssue,
  cwd: '/home/dev/example-app/packages/web',
  tokens: {
    input: 120_400,
    cacheWrite: 410_000,
    cacheRead: 3_610_000,
    output: 69_600,
  },
  skills: [
    {
      skill: 'kit:write-spec',
      launches: 2,
      sessions: 1,
      apiCalls: 30,
      tokens: 2_900_000,
      costUsd: 4.1,
      averageCostUsd: 2.05,
    },
    {
      skill: null,
      launches: 0,
      sessions: 0,
      apiCalls: 12,
      tokens: 1_310_000,
      costUsd: 2.32,
      averageCostUsd: null,
    },
  ],
  subAgents: [
    {
      id: 'a1',
      agentType: 'Explore',
      role: 'Explore',
      workItem: 52,
      issue: {
        status: 'found',
        title: 'Export button',
        url: 'https://github.com/example-org/example-app/issues/52',
      },
      description: 'Find the export code',
      model: 'claude-haiku-example',
      firstAt: minutesAgo(120),
      lastAt: minutesAgo(118),
      tokens: 310_000,
      costUsd: 0.12,
    },
    {
      id: 'a3',
      agentType: 'general-purpose',
      role: 'builder',
      workItem: 53,
      issue: { status: 'not-found' },
      description: 'Build #53 the export menu',
      model: 'claude-sonnet-example',
      firstAt: minutesAgo(100),
      lastAt: minutesAgo(70),
      tokens: 1_200_000,
      costUsd: 1.84,
    },
    {
      id: 'a2',
      agentType: '',
      role: 'unassigned',
      workItem: 52,
      issue: {
        status: 'found',
        title: 'Export button',
        url: 'https://github.com/example-org/example-app/issues/52',
      },
      description: '',
      model: '',
      firstAt: minutesAgo(60),
      lastAt: minutesAgo(15),
      tokens: 12_000,
      costUsd: null,
    },
  ],
};

export const sessionWithoutSubAgents: SessionDetail = {
  ...waitingSession,
  issueDetail: null,
  cwd: null,
  tokens: { input: 2_400, cacheWrite: 30_000, cacheRead: 150_000, output: 0 },
  skills: [
    {
      skill: null,
      launches: 0,
      sessions: 0,
      apiCalls: 4,
      tokens: 182_400,
      costUsd: null,
      averageCostUsd: null,
    },
  ],
  subAgents: [],
};

export function detailLoader(
  response: SessionResponse | undefined,
): LoadSession {
  return () => Promise.resolve(response);
}

export function detailResponse(session: SessionDetail): SessionResponse {
  return {
    status: 'ok',
    updatedAt: '2026-01-07T09:41:05.000Z',
    refreshSeconds: 3600,
    session,
  };
}

export const notFoundResponse: SessionResponse = {
  status: 'not-found',
  refreshSeconds: 3600,
};

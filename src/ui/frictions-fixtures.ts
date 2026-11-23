import type {
  FrictionStats,
  FrictionSubject,
  FrictionWeek,
  FrictionsResponse,
  KindCounts,
} from '../frictions/types.ts';
import {
  APP,
  BUILD_SESSION,
  LIB,
  contextPeaks,
  issueRows,
  roleRows,
} from './friction-breakdown-fixtures.ts';
import type { FrictionFilters, LoadFrictions } from './frictions-api.ts';

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

export const LONG_HOOK =
  'node ~/.agents/hooks/check-every-test-lint-and-type-before-the-agent-stops.ts --strict --report=summary';

export function weeksOf(
  counts: readonly (readonly [number, number])[],
): FrictionWeek[] {
  return WEEK_STARTS.map((start, index) => {
    const [frictions, apiCalls] = counts[index] ?? [0, 0];
    return { start, frictions, apiCalls };
  });
}

export const fallingWeeks = weeksOf([
  [30, 900],
  [28, 950],
  [26, 1000],
  [0, 3],
  [22, 980],
  [20, 1010],
  [17, 990],
  [15, 1020],
  [12, 1000],
  [10, 980],
  [9, 1030],
  [4, 410],
]);

const TOOLS = [
  'Bash',
  'Edit',
  'Write',
  'Read',
  'Grep',
  'Glob',
  'WebFetch',
  'mcp__docs__search',
  'mcp__browser__click',
  'NotebookEdit',
  'Task',
  'unknown',
];

export const allCounts: KindCounts = {
  'tool-error': 41,
  'stop-blocked': 5,
  compaction: 4,
};

export const frictionStats: FrictionStats = {
  kind: null,
  frictions: 50,
  apiCalls: 2048,
  counts: allCounts,
  weeks: fallingWeeks,
  categories: [
    { category: 'command-failed', errors: 22 },
    { category: 'permission-denied', errors: 9 },
    { category: 'tool-misuse', errors: 9 },
    { category: 'other', errors: 1 },
  ],
  tools: TOOLS.map((tool, index) => ({
    tool,
    errors: index === 0 ? 24 : Math.max(1, 6 - index),
    mainCategory: index === 0 ? 'command-failed' : 'tool-misuse',
    threads: index === 0 ? 7 : 1,
  })),
  commands: [
    {
      program: 'pnpm',
      failures: 14,
      exitCodes: [1, 2, 4, 5, 7, 127],
      distinctCommands: 6,
    },
    { program: 'git', failures: 5, exitCodes: [1], distinctCommands: 2 },
    { program: null, failures: 3, exitCodes: [], distinctCommands: 1 },
  ],
  repeated: [
    {
      program: 'pnpm',
      failures: 5,
      role: 'builder',
      project: '/work/app',
      workItem: 41,
      sessionId: '7f3a9c21-5b1e-4c8d-9a0f-123456789abc',
      sessionTitle: 'Build the frictions page',
      lastAt: '2026-11-22T17:33:00Z',
    },
    {
      program: 'git',
      failures: 3,
      role: 'main',
      project: '/work/app',
      workItem: null,
      sessionId: '0a1b2c3d-4e5f-4a6b-8c7d-0123456789ef',
      sessionTitle: '',
      lastAt: '2026-11-21T09:05:00Z',
    },
  ],
  hooks: [
    {
      command: LONG_HOOK,
      blocks: 4,
      sessions: 3,
      lastAt: '2026-11-22T18:10:00Z',
    },
    {
      command: 'make check',
      blocks: 1,
      sessions: 1,
      lastAt: '2026-11-20T11:00:00Z',
    },
  ],
  compactions: [
    { trigger: 'auto', compactions: 3, medianPreTokens: 306_000, threads: 2 },
    { trigger: 'manual', compactions: 1, medianPreTokens: null, threads: 1 },
  ],
  subject: null,
  roles: roleRows,
  issues: issueRows,
  context: contextPeaks,
  projects: [
    { project: APP, name: 'app' },
    { project: LIB, name: 'lib' },
  ],
};

export const UNKNOWN_SESSION = 'no-such-session';

function subjectOf(filters: FrictionFilters): FrictionSubject | null {
  if (filters.session !== undefined) {
    return {
      kind: 'session',
      id: filters.session,
      title:
        filters.session === BUILD_SESSION ? 'Build the frictions page' : null,
      agent: filters.session === BUILD_SESSION ? 'claude-code' : '',
    };
  }
  if (filters.issue !== undefined) {
    const row = issueRows.find(
      (issue) =>
        issue.number === filters.issue && issue.project === filters.project,
    );
    return {
      kind: 'issue',
      project: filters.project ?? '',
      number: filters.issue,
      issue: row?.issue ?? { status: 'not-found' },
    };
  }
  return null;
}

export function filteredStats(filters: FrictionFilters): FrictionStats {
  const subject = subjectOf(filters);
  if (subject === null) return statsFor(filters.kind);
  const known =
    subject.kind === 'session'
      ? subject.title !== null
      : subject.issue.status !== 'not-found';
  if (!known) return { ...noActivityStats, subject };
  const stats = statsFor(filters.kind);
  return {
    ...stats,
    subject,
    roles: stats.roles.slice(0, 2),
    issues: subject.kind === 'issue' ? [] : stats.issues.slice(0, 1),
    context: {
      threads: stats.context.threads.slice(0, 3),
      compacted: 1,
      medianPeak: 142_000,
      previous: { medianPeak: 120_000, threads: 2 },
    },
  };
}

export function statsFor(
  kind: FrictionFilters['kind'],
  stats: FrictionStats = frictionStats,
): FrictionStats {
  if (kind === undefined) return stats;
  const keep = <T>(wanted: string, rows: T[]): T[] =>
    kind === wanted ? rows : [];
  return {
    ...stats,
    kind,
    frictions: stats.counts[kind],
    categories: keep('tool-error', stats.categories),
    tools: keep('tool-error', stats.tools),
    commands: keep('tool-error', stats.commands),
    repeated: keep('tool-error', stats.repeated),
    hooks: keep('stop-blocked', stats.hooks),
    compactions: keep('compaction', stats.compactions),
    roles: stats.roles.map((row) => ({
      ...row,
      mainKind: row.mainKind === kind ? kind : null,
    })),
    issues: stats.issues.slice(0, 4),
  };
}

export function okFrictions(frictions: FrictionStats): FrictionsResponse {
  return {
    status: 'ok',
    updatedAt: '2026-11-23T09:00:00Z',
    refreshSeconds: 3600,
    frictions,
  };
}

export function frictionsLoaderOf(
  stats: FrictionStats = frictionStats,
): LoadFrictions {
  return (filters) =>
    Promise.resolve(okFrictions(statsFor(filters.kind, stats)));
}

export const noFrictionStats: FrictionStats = {
  ...statsFor('stop-blocked', {
    ...frictionStats,
    counts: { 'tool-error': 0, 'stop-blocked': 0, compaction: 0 },
  }),
  kind: null,
  frictions: 0,
  weeks: weeksOf(WEEK_STARTS.map(() => [0, 800])),
  roles: roleRows.map((row) => ({
    ...row,
    frictions: 0,
    perThread: 0,
    mainKind: null,
  })),
  issues: [],
  context: { ...contextPeaks, compacted: 0 },
};

export const noActivityStats: FrictionStats = {
  ...noFrictionStats,
  apiCalls: 0,
  roles: [],
  issues: [],
  context: { threads: [], compacted: 0, medianPeak: null },
};

export const filteredFrictions: LoadFrictions = (filters) =>
  Promise.resolve(okFrictions(filteredStats(filters)));

export const pendingFrictions: LoadFrictions = () =>
  new Promise<FrictionsResponse | undefined>(() => undefined);

export const unreachableFrictions: LoadFrictions = () =>
  Promise.resolve({ status: 'unreachable', refreshSeconds: 3600 });

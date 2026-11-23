import type {
  FrictionStats,
  FrictionSubject,
  FrictionBucket,
  FrictionsResponse,
  KindCounts,
  RoleOption,
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

const FIRST_DAY = Date.UTC(2026, 9, 25);
const DAY_MS = 24 * 60 * 60 * 1000;

function dayStart(index: number): string {
  return new Date(FIRST_DAY + index * DAY_MS).toISOString().slice(0, 10);
}

export const LONG_HOOK =
  'node ~/.agents/hooks/check-every-test-lint-and-type-before-the-agent-stops.ts --strict --report=summary';

export function daysOf(
  counts: readonly (readonly [number, number])[],
): FrictionBucket[] {
  return Array.from({ length: 30 }, (_, index) => {
    const [frictions, apiCalls] = counts[index] ?? [0, 0];
    return { start: dayStart(index), frictions, apiCalls };
  });
}

export const fallingDays = daysOf(
  Array.from({ length: 30 }, (_, index): [number, number] => {
    if (index === 6) return [0, 0];
    if (index === 12) return [1, 3];
    return [Math.max(0, 4 - Math.floor(index / 8)), 60 + (index % 5) * 4];
  }),
);

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
};

export const allRoles: RoleOption[] = [
  { role: 'builder', frictions: 26 },
  { role: 'reviewer', frictions: 9 },
  { role: 'main', frictions: 8 },
  { role: 'shipper', frictions: 0 },
  { role: 'unassigned', frictions: 3 },
];

export const frictionStats: FrictionStats = {
  kind: null,
  role: null,
  frictions: 46,
  apiCalls: 2048,
  counts: allCounts,
  roleOptions: allRoles,
  unit: 'day',
  buckets: fallingDays,
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

export function withRole(
  stats: FrictionStats,
  role: string | undefined,
): FrictionStats {
  if (role === undefined) return stats;
  const option = stats.roleOptions.find((candidate) => candidate.role === role);
  if (option === undefined) {
    return {
      ...noActivityStats,
      role,
      roleOptions: [
        ...stats.roleOptions.slice(0, -1),
        { role, frictions: 0 },
        ...stats.roleOptions.slice(-1),
      ],
    };
  }
  const blocked = Math.min(1, option.frictions);
  return {
    ...stats,
    role,
    frictions: option.frictions,
    apiCalls: Math.round(stats.apiCalls / 2),
    counts: {
      'tool-error': option.frictions - blocked,
      'stop-blocked': blocked,
    },
    roles: [],
    issues: stats.issues.slice(0, 3),
    context: {
      ...stats.context,
      threads: stats.context.threads.slice(0, 2),
      compacted: 1,
    },
  };
}

export function filteredStats(filters: FrictionFilters): FrictionStats {
  const subject = subjectOf(filters);
  if (subject === null) return withRole(statsFor(filters.kind), filters.role);
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
    Promise.resolve(
      okFrictions(withRole(statsFor(filters.kind, stats), filters.role)),
    );
}

export const noFrictionStats: FrictionStats = {
  ...statsFor('stop-blocked', {
    ...frictionStats,
    counts: { 'tool-error': 0, 'stop-blocked': 0 },
  }),
  kind: null,
  frictions: 0,
  roleOptions: allRoles.map((option) => ({ ...option, frictions: 0 })),
  buckets: daysOf(Array.from({ length: 30 }, () => [0, 60])),
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

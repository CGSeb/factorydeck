import { describe, expect, it } from 'vitest';
import type { FrictionOccurrence } from '../frictions/occurrence-types.ts';
import type { OccurrenceQuery } from '../frictions/occurrences.ts';
import type { FrictionQuery } from '../frictions/query.ts';
import type { FrictionStats } from '../frictions/types.ts';
import {
  unusedFeatures,
  unusedGitHost,
  unusedProjects,
  unusedRoles,
  unusedSkills,
} from '../test/skill-source.ts';
import { type OverviewSource, createApp } from './app.ts';
import type { SessionSource } from './session-routes.ts';

const overview: OverviewSource = {
  load: () => Promise.reject(new Error('Not used')),
  sessionsFolder: '/logs/claude',
  refreshSeconds: 10,
  updatedAt: () => new Date('2026-01-05T09:00:00Z'),
};

const sessions: SessionSource = {
  list: () => Promise.reject(new Error('Not used')),
  detail: () => Promise.reject(new Error('Not used')),
};

const frictions: FrictionStats = {
  kind: null,
  role: null,
  frictions: 2,
  apiCalls: 40,
  counts: { 'tool-error': 1, 'stop-blocked': 1 },
  roleOptions: [{ role: 'builder', frictions: 2 }],
  unit: 'day',
  buckets: [{ start: '2026-01-05', frictions: 2, apiCalls: 40 }],
  categories: [{ category: 'other', errors: 1 }],
  tools: [{ tool: 'Read', errors: 1, mainCategory: 'other', threads: 1 }],
  commands: [],
  repeated: [],
  hooks: [
    {
      command: 'node ~/hooks/stop.ts',
      blocks: 1,
      sessions: 1,
      lastAt: '2026-01-05T08:00:00.000Z',
    },
  ],
  subject: null,
  roles: [],
  issues: [],
  context: { threads: [], compacted: 0, medianPeak: null },
  projects: [],
};

const occurrences: FrictionOccurrence[] = [
  {
    id: 7,
    at: '2026-01-05T08:00:00.000Z',
    role: 'builder',
    project: '/work/app',
    workItem: 12,
    sessionId: 's-1',
    sessionTitle: 'Fix login',
    exitCode: 1,
    hasMore: true,
    texts: { kind: 'tool-error', input: 'git', error: 'no', shell: true },
  },
];

function app(up = true) {
  const queries: FrictionQuery[] = [];
  const occurrenceQueries: OccurrenceQuery[] = [];
  const created = createApp({
    checkDatabase: () => Promise.resolve(up),
    uiDir: '/nonexistent/factorydeck-ui',
    overview,
    sessions,
    skills: unusedSkills,
    roles: unusedRoles,
    features: unusedFeatures,
    projects: unusedProjects,
    gitHost: unusedGitHost,
    stats: {
      autonomy: () => Promise.reject(new Error('Not used')),
      quality: () => Promise.reject(new Error('Not used')),
      flow: () => Promise.reject(new Error('Not used')),
      bugs: () => Promise.reject(new Error('Not used')),
      waiting: () => Promise.reject(new Error('Not used')),
      frictions: (query) => {
        queries.push(query);
        return Promise.resolve(frictions);
      },
      occurrences: (query) => {
        occurrenceQueries.push(query);
        return Promise.resolve(occurrences);
      },
      output: () => Promise.reject(new Error('Not used')),
    },
  });
  return { app: created, queries, occurrenceQueries };
}

describe('/api/frictions', () => {
  it('answers the frictions of the period, project and kind', async () => {
    const { app: server, queries } = app();
    const response = await server.request(
      '/api/frictions?period=30d&tz=Europe/Paris&project=%2Fwork%2Fapp&kind=stop-blocked',
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      updatedAt: '2026-01-05T09:00:00.000Z',
      refreshSeconds: 10,
      frictions,
    });
    expect(queries).toEqual([
      {
        period: '30d',
        timeZone: 'Europe/Paris',
        project: '/work/app',
        kind: 'stop-blocked',
      },
    ]);
  });

  it.each([
    ['', undefined],
    ['&kind=tool-error', 'tool-error'],
    ['&kind=compaction', undefined],
    ['&kind=stop-blocked&kind=tool-error', 'stop-blocked'],
    ['&kind=', undefined],
    ['&kind=Tool-Error', undefined],
    ['&kind=tool_error', undefined],
    ['&kind=crash', undefined],
    ['&kind=compaction&kind=tool-error', undefined],
  ])('reads the kind of ?…%s as %s', async (suffix, kind) => {
    const { app: server, queries } = app();
    const response = await server.request(
      `/api/frictions?period=7d&tz=UTC${suffix}`,
    );
    expect(response.status).toBe(200);
    expect(queries.map((query) => query.kind)).toEqual([kind]);
  });

  it.each([
    ['', undefined],
    ['&role=builder', 'builder'],
    ['&role=', undefined],
    ['&role=Builder', 'Builder'],
    ['&role=%20builder', ' builder'],
    ['&role=unassigned', 'unassigned'],
    ['&role=reviewer&role=builder', 'reviewer'],
    ['&role=&role=builder', undefined],
  ])('reads the role of ?…%s as %j', async (suffix, role) => {
    const { app: server, queries } = app();
    const response = await server.request(
      `/api/frictions?period=7d&tz=UTC${suffix}`,
    );
    expect(response.status).toBe(200);
    expect(queries.map((query) => query.role)).toEqual([role]);
  });

  it.each([
    ['', undefined],
    ['&session=s-1', { session: 's-1' }],
    ['&session=', undefined],
    ['&session=s-1&session=s-2', { session: 's-1' }],
    ['&issue=12&project=%2Fwork%2Fapp', { issue: 12 }],
    ['&issue=012&project=%2Fwork%2Fapp', { issue: 12 }],
    ['&issue=12', undefined],
    ['&issue=12&project=', undefined],
    ['&issue=0&project=%2Fwork%2Fapp', undefined],
    ['&issue=-3&project=%2Fwork%2Fapp', undefined],
    ['&issue=1.5&project=%2Fwork%2Fapp', undefined],
    ['&issue=12abc&project=%2Fwork%2Fapp', undefined],
    ['&issue=&project=%2Fwork%2Fapp', undefined],
    ['&session=s-1&issue=12&project=%2Fwork%2Fapp', { session: 's-1' }],
    ['&session=&issue=12&project=%2Fwork%2Fapp', { issue: 12 }],
  ])('reads the filter of ?…%s as %j', async (suffix, filter) => {
    const { app: server, queries } = app();
    const response = await server.request(
      `/api/frictions?period=7d&tz=UTC${suffix}`,
    );
    expect(response.status).toBe(200);
    expect(queries.map((query) => query.filter)).toEqual([filter]);
  });

  it.each([
    '/api/frictions?tz=UTC',
    '/api/frictions?period=year&tz=UTC',
    '/api/frictions?period=7d',
    '/api/frictions?period=7d&tz=Mars/Base',
  ])('refuses %s', async (url) => {
    const response = await app().app.request(url);
    expect(response.status).toBe(400);
  });

  it('answers unreachable when the database is down', async () => {
    const response = await app(false).app.request(
      '/api/frictions?period=7d&tz=UTC',
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'unreachable',
      refreshSeconds: 10,
    });
  });
});

describe('/api/frictions/occurrences', () => {
  it('answers the occurrences of a row under the filters of /api/frictions', async () => {
    const { app: server, occurrenceQueries } = app();
    const response = await server.request(
      '/api/frictions/occurrences?period=30d&tz=Europe/Paris&project=%2Fwork%2Fapp&kind=tool-error&role=builder&issue=12&table=command&row=git',
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', occurrences });
    expect(occurrenceQueries).toEqual([
      {
        period: '30d',
        timeZone: 'Europe/Paris',
        project: '/work/app',
        kind: 'tool-error',
        role: 'builder',
        filter: { issue: 12 },
        row: { table: 'command', program: 'git' },
      },
    ]);
  });

  it.each([
    ['category', 'permission-denied', { category: 'permission-denied' }],
    ['tool', 'mcp__docs__search', { tool: 'mcp__docs__search' }],
    ['tool', '', { tool: '' }],
    ['command', 'pnpm', { program: 'pnpm' }],
    ['command', '', { program: null }],
    ['hook', 'node ~/hooks/stop.ts', { command: 'node ~/hooks/stop.ts' }],
    ['hook', '', { command: '' }],
    [
      'repeated',
      's-1/agent-a/abc123',
      { sessionId: 's-1', subAgentId: 'agent-a', commandHash: 'abc123' },
    ],
    [
      'repeated',
      's-1//abc123',
      { sessionId: 's-1', subAgentId: '', commandHash: 'abc123' },
    ],
  ])('reads the %s row %j', async (table, row, expected) => {
    const { app: server, occurrenceQueries } = app();
    const response = await server.request(
      `/api/frictions/occurrences?period=7d&tz=UTC&table=${table}&row=${encodeURIComponent(row)}`,
    );
    expect(response.status).toBe(200);
    expect(occurrenceQueries.map((query) => query.row)).toEqual([
      { table, ...expected },
    ]);
  });

  it.each([
    'table=command',
    'row=git',
    'table=commands&row=git',
    'table=Command&row=git',
    'table=&row=git',
    'table=context&row=auto',
    'table=role&row=builder',
    'table=category&row=crash',
    'table=category&row=Permission%20denied',
    'table=category&row=',
    'table=repeated&row=s-1',
    'table=repeated&row=s-1/abc123',
    'table=repeated&row=/agent-a/abc123',
    'table=repeated&row=s-1/agent-a/',
  ])('refuses an unknown table or row: %s', async (suffix) => {
    const { app: server, occurrenceQueries } = app();
    const response = await server.request(
      `/api/frictions/occurrences?period=7d&tz=UTC&${suffix}`,
    );
    expect(response.status).toBe(400);
    expect(occurrenceQueries).toEqual([]);
  });

  it.each([
    '/api/frictions/occurrences?tz=UTC&table=tool&row=Bash',
    '/api/frictions/occurrences?period=year&tz=UTC&table=tool&row=Bash',
    '/api/frictions/occurrences?period=7d&table=tool&row=Bash',
    '/api/frictions/occurrences?period=7d&tz=Mars/Base&table=tool&row=Bash',
  ])('refuses %s like /api/frictions', async (url) => {
    const response = await app().app.request(url);
    expect(response.status).toBe(400);
  });

  it('answers unreachable when the database is down', async () => {
    const response = await app(false).app.request(
      '/api/frictions/occurrences?period=7d&tz=UTC&table=tool&row=Bash',
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'unreachable',
      refreshSeconds: 10,
    });
  });
});

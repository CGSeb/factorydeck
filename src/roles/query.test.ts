import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { apiCall, session, subAgent } from '../db/schema.ts';
import { usageOverview } from '../overview/query.ts';
import { listSessions, sessionDetail } from '../sessions/query.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  DEFAULT_CONFIG,
  type WorkflowConfig,
  parseWorkflowConfig,
} from './config.ts';
import { listRoles } from './query.ts';
import type { RoleUsage } from './types.ts';

const NOW = new Date('2026-03-12T15:30:00Z');
const RECENT = new Date('2026-03-12T10:00:00Z');
const OLD = new Date('2026-01-05T09:00:00Z');
const state = { inactiveAfterMinutes: 30, now: NOW };

const config: WorkflowConfig = parseWorkflowConfig(
  [
    'version: 1',
    'roles:',
    '  - name: builder',
    "    description: '^Build '",
    '  - name: checker',
    "    description: 'review'",
    "    agent_type: '^Explore$'",
    '  - name: reviewer',
    "    description: '^Review '",
    '  - name: Explore',
    "    description: '^Search '",
    'projects:',
    '  /work/lib/:',
    '    work_items:',
    '      - from: branch',
    "        pattern: '^[a-z]+/(\\d+)-'",
  ].join('\n'),
  '/configs/factorydeck.yml',
);

let db: Database;
let close: () => Promise<void>;
let request = 0;

function call(
  sessionId: string,
  model: string,
  tokens: [number, number, number, number],
  {
    subAgentId = null,
    at = RECENT,
  }: { subAgentId?: string | null; at?: Date } = {},
) {
  request += 1;
  return {
    sourcePath: `/logs/${sessionId}.jsonl`,
    requestKey: `req_${String(request)}`,
    sessionId,
    subAgentId,
    at,
    model,
    inputTokens: tokens[0],
    cacheWriteTokens: tokens[1],
    cacheReadTokens: tokens[2],
    outputTokens: tokens[3],
  };
}

function agent(
  [sessionId, id]: [string, string],
  agentType: string,
  description: string,
  gitBranch = '',
) {
  return { sessionId, id, agentType, description, gitBranch, firstAt: RECENT };
}

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await db.insert(session).values([
    {
      id: 'app-1',
      project: '/work/app',
      title: 'Fix #7 export',
      gitBranch: 'feat/52-export',
      firstAt: OLD,
      lastAt: RECENT,
    },
    {
      id: 'lib-1',
      project: '/work/lib',
      title: 'Crash #3',
      gitBranch: 'fix/99-crash',
      firstAt: RECENT,
      lastAt: RECENT,
    },
    {
      id: 'none-1',
      project: 'unassigned',
      title: 'Explain',
      gitBranch: '',
      firstAt: RECENT,
      lastAt: RECENT,
    },
  ]);
  await db
    .insert(subAgent)
    .values([
      agent(['app-1', 'build'], 'general-purpose', 'Build #12 export'),
      agent(['app-1', 'review'], 'general-purpose', 'Review the branch'),
      agent(['app-1', 'check'], 'Explore', 'Review code #0'),
      agent(['app-1', 'blank'], '', ''),
      agent(['app-1', 'find'], 'Explore', 'Find the code'),
      agent(['app-1', 'search'], 'Plan', 'Search the docs'),
      agent(['lib-1', 'fix'], 'general-purpose', 'Build the fix', 'feat/100-x'),
      agent(['lib-1', 'other'], 'general-purpose', 'Build more #4'),
    ]);
  await db.insert(apiCall).values([
    call('app-1', 'claude-opus-9', [1_000_000, 0, 0, 0]),
    call('app-1', 'claude-opus-9', [1_000_000, 0, 0, 0], { at: OLD }),
    call('app-1', 'claude-sonnet-9', [0, 0, 0, 100_000], {
      subAgentId: 'build',
    }),
    call('app-1', 'claude-sonnet-9', [0, 0, 0, 100_000], {
      subAgentId: 'build',
      at: OLD,
    }),
    call('app-1', 'mystery-model', [5, 5, 5, 5], { subAgentId: 'review' }),
    call('app-1', 'claude-haiku-9', [1_000, 0, 0, 0], {
      subAgentId: 'check',
    }),
    call('app-1', 'claude-haiku-9', [2_000, 0, 0, 0], {
      subAgentId: 'blank',
    }),
    call('app-1', 'claude-haiku-9', [3_000, 0, 0, 0], { subAgentId: 'find' }),
    call('app-1', 'claude-haiku-9', [4_000, 0, 0, 0], {
      subAgentId: 'search',
    }),
    call('lib-1', 'claude-sonnet-9', [10, 0, 0, 0]),
    call('lib-1', 'claude-sonnet-9', [20, 0, 0, 0], { subAgentId: 'fix' }),
    call('lib-1', 'claude-sonnet-9', [30, 0, 0, 0], { subAgentId: 'other' }),
    call('none-1', 'mystery-model', [1, 1, 1, 1]),
  ]);
});

afterAll(async () => {
  await close();
});

function byRole(rows: RoleUsage[]): Record<string, [number, number]> {
  return Object.fromEntries(
    rows.map((row) => [row.role, [row.threads, row.apiCalls]]),
  );
}

function sum(rows: RoleUsage[], key: 'apiCalls' | 'tokens'): number {
  return rows.reduce((total, row) => total + row[key], 0);
}

function cost(rows: RoleUsage[]): number {
  return rows.reduce((total, row) => total + (row.costUsd ?? 0), 0);
}

describe('listRoles', () => {
  it('gives every call one role, by rule order, type and unassigned', async () => {
    const list = await listRoles(
      db,
      { period: 'all', timeZone: 'UTC', now: NOW },
      config,
    );
    expect(byRole(list.roles)).toEqual({
      main: [3, 4],
      builder: [3, 4],
      reviewer: [1, 1],
      checker: [1, 1],
      unassigned: [1, 1],
      Explore: [2, 2],
    });
    expect(list.roles[0]?.role).toBe('main');
    expect(list.apiCalls).toBe(13);
    expect(list.projects).toEqual(['/work/app', '/work/lib', 'unassigned']);
  });

  it('uses the default role rules without a configuration', async () => {
    const list = await listRoles(
      db,
      { period: 'all', timeZone: 'UTC', now: NOW },
      DEFAULT_CONFIG,
    );
    expect(byRole(list.roles)).toEqual({
      main: [3, 4],
      builder: [3, 4],
      reviewer: [2, 2],
      Explore: [1, 1],
      Plan: [1, 1],
      unassigned: [1, 1],
    });
  });

  it('falls back to the sub-agent types with roles: []', async () => {
    const list = await listRoles(
      db,
      { period: 'all', timeZone: 'UTC', now: NOW },
      parseWorkflowConfig('version: 1\nroles: []\n', '/f.yml'),
    );
    expect(byRole(list.roles)).toEqual({
      main: [3, 4],
      'general-purpose': [4, 5],
      Explore: [2, 2],
      Plan: [1, 1],
      unassigned: [1, 1],
    });
  });

  it('has the column totals of the overview, for each period and project', async () => {
    for (const period of ['today', '7d', 'all'] as const) {
      const query = { period, timeZone: 'UTC', now: NOW };
      const overview = await usageOverview(db, query);
      const list = await listRoles(db, query, config);
      expect(sum(list.roles, 'apiCalls')).toBe(overview.totals.apiCalls);
      expect(sum(list.roles, 'tokens')).toBe(
        overview.totals.tokens.input +
          overview.totals.tokens.cacheWrite +
          overview.totals.tokens.cacheRead +
          overview.totals.tokens.output,
      );
      expect(cost(list.roles)).toBeCloseTo(overview.totals.costUsd, 9);
      expect(list.roles.find((row) => row.role === 'main')?.threads).toBe(
        overview.totals.sessions,
      );
      for (const project of overview.projects) {
        const scoped = await listRoles(
          db,
          { ...query, project: project.project },
          config,
        );
        expect(sum(scoped.roles, 'apiCalls')).toBe(project.apiCalls);
        expect(sum(scoped.roles, 'tokens')).toBe(project.tokens);
        expect(cost(scoped.roles)).toBeCloseTo(project.costUsd ?? 0, 9);
      }
    }
  });

  it('keeps only the calls of the period', async () => {
    const list = await listRoles(
      db,
      { period: '7d', timeZone: 'UTC', now: NOW },
      config,
    );
    expect(byRole(list.roles)['main']).toEqual([3, 3]);
    expect(byRole(list.roles)['builder']).toEqual([3, 3]);
    const empty = await listRoles(
      db,
      { period: 'today', timeZone: 'UTC', now: new Date('2027-01-01Z') },
      config,
    );
    expect(empty.roles).toEqual([]);
    expect(empty.apiCalls).toBe(0);
  });
});

describe('work items and roles of sessions', () => {
  it('gives the main thread its work item from the title, never the description', async () => {
    const list = await listSessions(
      db,
      { period: 'all', timeZone: 'UTC', limit: 50 },
      state,
      config,
    );
    const workItems = Object.fromEntries(
      list.sessions.map((row) => [row.id, row.workItem]),
    );
    expect(workItems).toEqual({ 'app-1': 7, 'lib-1': 99, 'none-1': null });
  });

  it('gives each sub-agent its role and work item, inheriting the session one', async () => {
    const detail = await sessionDetail(db, 'app-1', state, config);
    expect(detail?.workItem).toBe(7);
    expect(
      Object.fromEntries(
        (detail?.subAgents ?? []).map((row) => [
          row.id,
          [row.role, row.workItem],
        ]),
      ),
    ).toEqual({
      build: ['builder', 12],
      review: ['reviewer', 7],
      check: ['checker', 7],
      blank: ['unassigned', 7],
      find: ['Explore', 7],
      search: ['Explore', 7],
    });
  });

  it('reads the thread own branch with a project branch rule', async () => {
    const detail = await sessionDetail(db, 'lib-1', state, config);
    expect(detail?.workItem).toBe(99);
    expect(
      Object.fromEntries(
        (detail?.subAgents ?? []).map((row) => [row.id, row.workItem]),
      ),
    ).toEqual({ fix: 100, other: 99 });
  });
});

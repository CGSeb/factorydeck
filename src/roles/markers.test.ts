import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { apiCall, closingLine, session, subAgent } from '../db/schema.ts';
import { featureDetail, listFeatures } from '../features/query.ts';
import type { FeatureQuery } from '../features/types.ts';
import { usageOverview } from '../overview/query.ts';
import { listSessions, sessionDetail } from '../sessions/query.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { DEFAULT_CONFIG, parseWorkflowConfig } from './config.ts';
import { listRoles } from './query.ts';

const APP = '/work/marker-app';
const NOW = new Date('2026-05-20T12:00:00Z');
const MODEL = 'claude-sonnet-4-5';
const state = { inactiveAfterMinutes: 30, now: NOW };
const allTime: FeatureQuery = {
  period: 'all',
  timeZone: 'UTC',
  project: APP,
  now: NOW,
};
const week: FeatureQuery = { ...allTime, period: '7d' };
const titleOnly = parseWorkflowConfig(
  "version: 1\nwork_items:\n  - from: title\n    pattern: '#(\\d+)'",
  '/configs/factorydeck.yml',
);

function at(hour: number): Date {
  return new Date(`2026-05-19T${String(hour).padStart(2, '0')}:00:00Z`);
}

let request = 0;

function call(sessionId: string, hour: number, subAgentId?: string) {
  request += 1;
  return {
    sourcePath: `/logs/${sessionId}.jsonl`,
    requestKey: `req_${String(request)}`,
    sessionId,
    subAgentId: subAgentId ?? null,
    at: at(hour),
    model: MODEL,
    inputTokens: 100,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    outputTokens: 10,
  };
}

let position = 0;

function line(sessionId: string, hour: number, text: string) {
  position += 1;
  return {
    sourcePath: `/logs/${sessionId}.jsonl`,
    recordUuid: `line_${String(position)}`,
    sessionId,
    at: at(hour),
    position,
    line: text,
  };
}

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await db.insert(session).values([
    { id: 'spec', project: APP, title: 'Write a spec', lastAt: at(7) },
    { id: 'titled', project: APP, title: 'Fix #20', lastAt: at(3) },
    { id: 'plain', project: APP, title: 'Fix #30', lastAt: at(3) },
    { id: 'only', project: APP, title: 'Another spec', lastAt: at(9) },
  ]);
  await db.insert(subAgent).values([
    {
      sessionId: 'spec',
      id: 'x',
      agentType: 'Explore',
      description: 'Explore the code',
      firstAt: at(4),
    },
    {
      sessionId: 'spec',
      id: 'y',
      agentType: 'builder',
      description: 'Build #12',
      firstAt: at(1),
    },
  ]);
  await db
    .insert(apiCall)
    .values([
      call('spec', 1),
      call('spec', 2),
      call('spec', 3),
      call('spec', 5),
      call('spec', 7),
      call('spec', 4, 'x'),
      call('spec', 8, 'x'),
      call('spec', 1, 'y'),
      call('titled', 3),
      call('plain', 3),
      call('only', 8),
    ]);
  await db
    .insert(closingLine)
    .values([
      line('spec', 2, 'Work item: #10 (spec-writer)'),
      line('spec', 4, 'Done, see #99 above.'),
      line('spec', 6, 'Work item: #11'),
      line('titled', 2, 'Work item: #21'),
      line('plain', 2, 'Fixed #30.'),
      line('only', 9, 'Work item: #40 (spec-writer)'),
    ]);
});

afterAll(async () => {
  await close();
});

function callsByIssue(rows: { number: number; apiCalls: number }[]) {
  return Object.fromEntries(rows.map((row) => [row.number, row.apiCalls]));
}

describe('work item markers', () => {
  it('splits main-thread calls at the markers on Features', async () => {
    const list = await listFeatures(db, allTime, DEFAULT_CONFIG);
    expect(callsByIssue(list.rows)).toEqual({
      10: 2,
      11: 5,
      12: 1,
      21: 1,
      30: 1,
      40: 1,
    });
    expect(list.noWorkItem).toBeNull();
    const roles = (number: number) =>
      list.rows
        .find((row) => row.number === number)
        ?.roles.map((role) => role.role)
        .sort();
    expect(roles(10)).toEqual(['spec-writer']);
    expect(roles(11)).toEqual(['Explore', 'main']);
    expect(roles(40)).toEqual(['spec-writer']);
    expect(list.rows.every((row) => row.orchestrationCostUsd === null)).toBe(
      true,
    );
  });

  it('keeps the totals equal to the overview', async () => {
    for (const query of [week, allTime]) {
      const [list, overview] = await Promise.all([
        listFeatures(db, query, DEFAULT_CONFIG),
        usageOverview(db, query),
      ]);
      expect(list.totals.apiCalls).toBe(overview.totals.apiCalls);
      expect(
        list.rows.reduce((sum, row) => sum + row.apiCalls, 0) +
          (list.noWorkItem?.apiCalls ?? 0),
      ).toBe(overview.totals.apiCalls);
      expect(
        list.rows.reduce((sum, row) => sum + row.tokens, 0) +
          (list.noWorkItem?.tokens ?? 0),
      ).toBeCloseTo(list.totals.tokens);
    }
  });

  it('shows the marker role on the issue page', async () => {
    const detail = await featureDetail(
      db,
      { project: APP, number: 10 },
      allTime,
      { config: DEFAULT_CONFIG, state },
    );
    expect(detail?.roles.map(({ role, apiCalls }) => [role, apiCalls])).toEqual(
      [['spec-writer', 2]],
    );
    expect(detail?.orchestration).toBeNull();
  });

  it('counts a session once in each role its main-thread calls fall in', async () => {
    const list = await listRoles(
      db,
      { period: 'all', timeZone: 'UTC', project: APP, now: NOW },
      DEFAULT_CONFIG,
    );
    const byRole = Object.fromEntries(
      list.roles.map((row) => [row.role, [row.threads, row.apiCalls]]),
    );
    expect(byRole).toEqual({
      main: [3, 5],
      'spec-writer': [2, 3],
      Explore: [1, 2],
      builder: [1, 1],
    });
    expect(list.apiCalls).toBe(11);
  });

  it('shows the last marker as the session work item', async () => {
    const list = await listSessions(
      db,
      { period: 'all', timeZone: 'UTC', project: APP, limit: 10 },
      state,
      DEFAULT_CONFIG,
    );
    expect(
      Object.fromEntries(list.sessions.map((row) => [row.id, row.workItem])),
    ).toEqual({ spec: 11, titled: 21, plain: 30, only: 40 });
    const detail = await sessionDetail(db, 'spec', state, DEFAULT_CONFIG);
    expect(detail?.workItem).toBe(11);
    expect(
      Object.fromEntries(
        detail?.subAgents.map((agent) => [agent.id, agent.workItem]) ?? [],
      ),
    ).toEqual({ x: 11, y: 12 });
  });

  it('reads no marker when the configuration has no marker rule', async () => {
    const list = await listFeatures(db, allTime, titleOnly);
    expect(callsByIssue(list.rows)).toEqual({ 20: 1, 30: 1 });
    const roles = await listRoles(
      db,
      { period: 'all', timeZone: 'UTC', project: APP, now: NOW },
      titleOnly,
    );
    expect(roles.roles.map((row) => row.role)).not.toContain('spec-writer');
    const sessions = await listSessions(
      db,
      { period: 'all', timeZone: 'UTC', project: APP, limit: 10 },
      state,
      titleOnly,
    );
    expect(sessions.sessions.find((row) => row.id === 'titled')?.workItem).toBe(
      20,
    );
  });
});

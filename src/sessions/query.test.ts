import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { apiCall, session, subAgent } from '../db/schema.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { listSessions, sessionDetail } from './query.ts';
import type { SessionListQuery } from './types.ts';

const NOW = new Date('2026-11-21T12:00:00Z');
const MINUTE = 60_000;
const options = { inactiveAfterMinutes: 30, now: NOW };

function ago(minutes: number): Date {
  return new Date(NOW.getTime() - minutes * MINUTE);
}

let db: Database;
let close: () => Promise<void>;
let key = 0;

function call(
  sessionId: string,
  model: string,
  tokens: [number, number, number, number],
  subAgentId: string | null = null,
): typeof apiCall.$inferInsert {
  key += 1;
  return {
    sourcePath: `/synthetic/${sessionId}.jsonl`,
    requestKey: `req_${key}`,
    sessionId,
    subAgentId,
    at: ago(40),
    model,
    inputTokens: tokens[0],
    cacheWriteTokens: tokens[1],
    cacheReadTokens: tokens[2],
    outputTokens: tokens[3],
  };
}

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await db.insert(session).values([
    {
      id: 'working-1',
      project: '/work/app',
      cwd: '/work/app',
      gitBranch: 'feat/x',
      title: 'Build the thing',
      firstAt: ago(120),
      lastAt: ago(29.9),
      turnEnded: false,
    },
    {
      id: 'waiting-1',
      project: '/work/app',
      firstAt: ago(10),
      lastAt: ago(1),
      turnEnded: true,
    },
    {
      id: 'edge-inactive',
      project: '/work/lib',
      firstAt: ago(60),
      lastAt: ago(30),
      turnEnded: false,
    },
    {
      id: 'old-ended',
      project: '/work/lib',
      firstAt: ago(60 * 24 * 20),
      lastAt: ago(60 * 24 * 20 - 5),
      turnEnded: true,
    },
    {
      id: 'agent-busy',
      firstAt: ago(90),
      lastAt: ago(80),
      turnEnded: false,
    },
  ]);
  await db.insert(subAgent).values([
    {
      sessionId: 'agent-busy',
      id: 'b-second',
      agentType: 'Explore',
      description: 'Look around',
      model: 'claude-haiku-9',
      firstAt: ago(70),
      lastAt: ago(5),
    },
    {
      sessionId: 'agent-busy',
      id: 'a-first',
      agentType: '',
      description: '',
      model: '',
      firstAt: ago(85),
      lastAt: ago(75),
    },
  ]);
  await db
    .insert(apiCall)
    .values([
      call('working-1', 'claude-opus-9', [1_000_000, 0, 0, 0]),
      call('working-1', 'mystery-model', [5, 5, 5, 5]),
      call('agent-busy', 'claude-sonnet-9', [0, 0, 0, 100_000]),
      call('agent-busy', 'claude-haiku-9', [1_000_000, 0, 0, 0], 'b-second'),
      call('agent-busy', 'mystery-model', [1, 2, 3, 4], 'a-first'),
      call('old-ended', 'mystery-model', [10, 0, 0, 0]),
    ]);
});

afterAll(async () => {
  await close();
});

const all: SessionListQuery = { period: 'all', timeZone: 'UTC', limit: 50 };

describe('listSessions', () => {
  it('lists main sessions by last activity, a sub-agent record counting as activity', async () => {
    const list = await listSessions(db, all, options);
    expect(list.sessions.map((row) => row.id)).toEqual([
      'waiting-1',
      'agent-busy',
      'working-1',
      'edge-inactive',
      'old-ended',
    ]);
    expect(list.total).toBe(5);
    const busy = list.sessions[1];
    expect(busy?.firstAt).toBe(ago(90).toISOString());
    expect(busy?.lastAt).toBe(ago(5).toISOString());
  });

  it('applies the state rule at the threshold edges', async () => {
    const { sessions, counts } = await listSessions(db, all, options);
    const states = Object.fromEntries(
      sessions.map((row) => [row.id, row.state]),
    );
    expect(states).toEqual({
      'working-1': 'working',
      'waiting-1': 'waiting',
      'edge-inactive': 'inactive',
      'old-ended': 'inactive',
      'agent-busy': 'working',
    });
    expect(counts).toEqual({ working: 2, waiting: 1, inactive: 2 });
    const shorter = await listSessions(db, all, {
      inactiveAfterMinutes: 1,
      now: NOW,
    });
    expect(shorter.counts).toEqual({ working: 0, waiting: 0, inactive: 5 });
  });

  it('sums the tokens and cost of the whole session, sub-agents included', async () => {
    const { sessions } = await listSessions(db, all, options);
    const byId = new Map(sessions.map((row) => [row.id, row]));
    expect(byId.get('working-1')).toMatchObject({
      title: 'Build the thing',
      project: '/work/app',
      gitBranch: 'feat/x',
      tokens: 1_000_020,
      costUsd: 4,
    });
    expect(byId.get('agent-busy')).toMatchObject({
      project: 'unassigned',
      gitBranch: '',
      tokens: 1_100_010,
    });
    expect(byId.get('agent-busy')?.costUsd).toBeCloseTo(1.1);
    expect(byId.get('old-ended')?.costUsd).toBeNull();
    expect(byId.get('waiting-1')).toMatchObject({ tokens: 0, costUsd: 0 });
  });

  it('filters by project, state and period, counting states before the state filter', async () => {
    const app = await listSessions(
      db,
      { ...all, project: '/work/app' },
      options,
    );
    expect(app.sessions.map((row) => row.id)).toEqual([
      'waiting-1',
      'working-1',
    ]);
    expect(app.counts).toEqual({ working: 1, waiting: 1, inactive: 0 });
    const inactive = await listSessions(
      db,
      { ...all, state: 'inactive' },
      options,
    );
    expect(inactive.sessions.map((row) => row.id)).toEqual([
      'edge-inactive',
      'old-ended',
    ]);
    expect(inactive.total).toBe(2);
    expect(inactive.counts).toEqual({ working: 2, waiting: 1, inactive: 2 });
    const week = await listSessions(db, { ...all, period: '7d' }, options);
    expect(week.sessions.map((row) => row.id)).toEqual([
      'waiting-1',
      'agent-busy',
      'working-1',
      'edge-inactive',
    ]);
    expect(week.projects).toEqual(['/work/app', '/work/lib', 'unassigned']);
    const none = await listSessions(
      db,
      { ...all, project: '/work/lib', state: 'waiting' },
      options,
    );
    expect(none).toMatchObject({ sessions: [], total: 0 });
  });

  it('pages by the limit', async () => {
    const first = await listSessions(db, { ...all, limit: 2 }, options);
    expect(first.sessions.map((row) => row.id)).toEqual([
      'waiting-1',
      'agent-busy',
    ]);
    expect(first.total).toBe(5);
  });
});

describe('sessionDetail', () => {
  it('gives the session with its four token kinds and its sub-agents in start order', async () => {
    const detail = await sessionDetail(db, 'agent-busy', options);
    expect(detail).toMatchObject({
      id: 'agent-busy',
      state: 'working',
      cwd: null,
      tokens: {
        input: 1_000_001,
        cacheWrite: 2,
        cacheRead: 3,
        output: 100_004,
      },
    });
    expect(detail?.costUsd).toBeCloseTo(1.1);
    expect(detail?.skills).toMatchObject([{ skill: null, tokens: 1_100_010 }]);
    expect(detail?.skills[0]?.costUsd).toBeCloseTo(1.1, 10);
    expect(detail?.subAgents).toEqual([
      {
        id: 'a-first',
        agentType: '',
        role: 'unassigned',
        workItem: null,
        description: '',
        model: '',
        firstAt: ago(85).toISOString(),
        lastAt: ago(75).toISOString(),
        tokens: 10,
        costUsd: null,
      },
      {
        id: 'b-second',
        agentType: 'Explore',
        role: 'Explore',
        workItem: null,
        description: 'Look around',
        model: 'claude-haiku-9',
        firstAt: ago(70).toISOString(),
        lastAt: ago(5).toISOString(),
        tokens: 1_000_000,
        costUsd: 0.1,
      },
    ]);
  });

  it('gives a session without sub-agents, with the figures of its row', async () => {
    const detail = await sessionDetail(db, 'working-1', options);
    expect(detail).toMatchObject({
      cwd: '/work/app',
      gitBranch: 'feat/x',
      subAgents: [],
      costUsd: 4,
    });
    expect(detail?.tokens).toEqual({
      input: 1_000_005,
      cacheWrite: 5,
      cacheRead: 5,
      output: 5,
    });
  });

  it('gives nothing for an unknown session', async () => {
    await expect(sessionDetail(db, 'nope', options)).resolves.toBeUndefined();
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { apiCall, session, subAgent } from '../db/schema.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { featureDetail, listFeatures } from './query.ts';
import type { FeatureQuery } from './types.ts';

const APP = '/work/threads-app';
const NOW = new Date('2026-05-20T12:00:00Z');
const OLD = new Date('2026-04-01T09:00:00Z');
const SONNET = 'claude-sonnet-4-5';
const state = { inactiveAfterMinutes: 30, now: NOW };
const week: FeatureQuery = {
  period: '7d',
  timeZone: 'UTC',
  project: APP,
  now: NOW,
};
const allTime: FeatureQuery = { ...week, period: 'all' };

function at(hour: number): Date {
  return new Date(`2026-05-19T${String(hour).padStart(2, '0')}:00:00Z`);
}

let request = 0;

function call(
  sessionId: string,
  input: number,
  when: Date,
  subAgentId: string | null = null,
) {
  request += 1;
  return {
    sourcePath: `/logs/${sessionId}.jsonl`,
    requestKey: `req_${String(request)}`,
    sessionId,
    subAgentId,
    at: when,
    model: SONNET,
    inputTokens: input,
    cacheWriteTokens: 0,
    cacheReadTokens: 100,
    outputTokens: 10,
  };
}

function agent(
  sessionId: string,
  id: string,
  agentType: string,
  description: string,
) {
  return { sessionId, id, agentType, description, firstAt: at(1) };
}

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await db.insert(session).values([
    { id: 'orch', project: APP, title: 'Run the queue', lastAt: at(9) },
    { id: 'rev', project: APP, title: 'Review queue', lastAt: at(9) },
    { id: 'main5', project: APP, title: 'Polish #5 by hand', lastAt: at(9) },
  ]);
  await db
    .insert(subAgent)
    .values([
      agent('orch', 'b5', 'builder', 'Build #5'),
      agent('orch', 'b6', 'builder', 'Build #6'),
      agent('rev', 'r2', 'reviewer', 'Review #5'),
      agent('rev', 'r1', 'reviewer', 'Review #5'),
      agent('rev', 'r0', 'reviewer', 'Review #5 again'),
    ]);
  await db
    .insert(apiCall)
    .values([
      call('orch', 1_000, at(1)),
      call('orch', 3_000, at(2), 'b5'),
      call('orch', 1_000, at(3), 'b5'),
      call('orch', 1_000, at(2), 'b6'),
      call('rev', 500, at(4)),
      call('rev', 800, at(5), 'r1'),
      call('rev', 600, at(5), 'r2'),
      call('rev', 400, OLD, 'r0'),
      call('main5', 2_000, at(6)),
      call('main5', 1_000, at(7)),
    ]);
});

afterAll(async () => {
  await close();
});

async function issueRow(query: FeatureQuery, number: number) {
  const { rows } = await listFeatures(db, query, DEFAULT_CONFIG);
  return rows.find((row) => row.number === number);
}

async function detailOf(query: FeatureQuery, number: number) {
  return featureDetail(db, { project: APP, number }, query, {
    config: DEFAULT_CONFIG,
    state,
  });
}

describe('issue roles on the features list', () => {
  it('splits an issue between roles by tokens, then its orchestration share', async () => {
    const row = await issueRow(week, 5);
    expect(row?.roles.map(({ role, tokens }) => ({ role, tokens }))).toEqual([
      { role: 'builder', tokens: 4_220 },
      { role: 'main', tokens: 3_220 },
      { role: 'reviewer', tokens: 1_620 },
      { role: 'Orchestration', tokens: 1_489 },
    ]);
    expect(row?.roles[0]).toEqual({
      role: 'builder',
      tokens: 4_220,
      tokenCounts: { input: 4_000, cacheWrite: 0, cacheRead: 200, output: 20 },
      costUsd: expect.any(Number) as number,
    });
    const sum = row?.roles.reduce((total, role) => total + role.tokens, 0);
    expect(sum).toBe(row?.tokens);
  });

  it('has no orchestration entry when the issue has no share', async () => {
    const { rows } = await listFeatures(db, week, DEFAULT_CONFIG);
    for (const row of rows) {
      const sum = row.roles.reduce((total, role) => total + role.tokens, 0);
      expect(sum).toBe(row.tokens);
      expect(
        row.roles.filter((role) => role.role === 'Orchestration').length,
      ).toBe(row.orchestrationCostUsd === null ? 0 : 1);
    }
  });
});

describe('issue threads on the feature detail', () => {
  it('lists every thread that worked on the issue, in the order they ran', async () => {
    const detail = await detailOf(week, 5);
    expect(detail?.threads).toEqual([
      {
        sessionId: 'orch',
        sessionTitle: 'Run the queue',
        threadId: 'b5',
        role: 'builder',
        description: 'Build #5',
        firstAt: at(2).toISOString(),
        lastAt: at(3).toISOString(),
        tokens: 4_220,
        tokenCounts: {
          input: 4_000,
          cacheWrite: 0,
          cacheRead: 200,
          output: 20,
        },
        costUsd: expect.any(Number) as number,
      },
      expect.objectContaining({
        sessionId: 'rev',
        sessionTitle: 'Review queue',
        threadId: 'r1',
        role: 'reviewer',
        description: 'Review #5',
        firstAt: at(5).toISOString(),
        lastAt: at(5).toISOString(),
        tokens: 910,
      }),
      expect.objectContaining({
        sessionId: 'rev',
        threadId: 'r2',
        role: 'reviewer',
        tokens: 710,
      }),
      expect.objectContaining({
        sessionId: 'main5',
        sessionTitle: 'Polish #5 by hand',
        threadId: 'main5',
        role: 'main',
        description: null,
        firstAt: at(6).toISOString(),
        lastAt: at(7).toISOString(),
        tokens: 3_220,
      }),
    ]);
  });

  it('adds up, with the orchestration share, to the issue tokens on the list', async () => {
    for (const number of [5, 6]) {
      const [detail, row] = await Promise.all([
        detailOf(week, number),
        issueRow(week, number),
      ]);
      const threads = (detail?.threads ?? []).reduce(
        (total, thread) => total + thread.tokens,
        0,
      );
      expect(threads + (detail?.orchestration?.tokens ?? 0)).toBe(row?.tokens);
    }
  });

  it('keeps a sub-agent of a session that works on several issues to its own issue', async () => {
    const detail = await detailOf(week, 6);
    expect(detail?.threads.map((thread) => thread.threadId)).toEqual(['b6']);
    expect(detail?.orchestration).not.toBeNull();
  });

  it('includes a thread only when it has calls in the period', async () => {
    const recent = await detailOf(week, 5);
    expect(recent?.threads.map((thread) => thread.threadId)).not.toContain(
      'r0',
    );
    const all = await detailOf(allTime, 5);
    expect(all?.threads.map((thread) => thread.threadId)).toEqual([
      'r0',
      'b5',
      'r1',
      'r2',
      'main5',
    ]);
  });

  it('has no threads when the issue has no calls in the period', async () => {
    const detail = await detailOf(
      { ...week, now: new Date('2026-06-30T12:00:00Z') },
      5,
    );
    expect(detail?.threads).toEqual([]);
    expect(detail?.orchestration).toBeNull();
  });
});

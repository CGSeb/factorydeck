import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { apiCall, session, subAgent } from '../db/schema.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { usageOverview } from './query.ts';

const NOW = new Date('2026-11-21T12:00:00Z');
const PARIS = 'Europe/Paris';

let db: Database;
let close: () => Promise<void>;

interface Call {
  session: string;
  at: string;
  model: string;
  tokens: [number, number, number, number];
  subAgent?: string;
}

let key = 0;
async function insertCalls(target: Database, calls: Call[]): Promise<void> {
  await target.insert(apiCall).values(
    calls.map((call) => {
      key += 1;
      return {
        sourcePath: `/synthetic/${call.session}.jsonl`,
        requestKey: `req_${key}`,
        sessionId: call.session,
        subAgentId: call.subAgent ?? null,
        at: new Date(call.at),
        model: call.model,
        inputTokens: call.tokens[0],
        cacheWriteTokens: call.tokens[1],
        cacheReadTokens: call.tokens[2],
        outputTokens: call.tokens[3],
      };
    }),
  );
}

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await db
    .insert(session)
    .values([
      { id: 's-app-1', project: '/work/app' },
      { id: 's-app-2', project: '/work/app' },
      { id: 's-lib', project: '/work/lib' },
      { id: 's-loose' },
      { id: 's-idle', project: '/work/idle' },
    ]);
  await db
    .insert(subAgent)
    .values({ sessionId: 's-lib', id: 'agent-1', model: 'claude-haiku-9' });
  await insertCalls(db, [
    {
      session: 's-app-1',
      at: '2026-11-20T23:30:00Z',
      model: 'claude-opus-9',
      tokens: [1_000_000, 0, 0, 0],
    },
    {
      session: 's-app-1',
      at: '2026-11-20T22:30:00Z',
      model: 'claude-sonnet-9',
      tokens: [0, 0, 0, 100_000],
    },
    {
      session: 's-app-2',
      at: '2026-11-15T10:00:00Z',
      model: 'claude-sonnet-9',
      tokens: [0, 0, 0, 100_000],
    },
    {
      session: 's-lib',
      subAgent: 'agent-1',
      at: '2026-11-21T09:15:00Z',
      model: 'claude-haiku-9',
      tokens: [1_000_000, 0, 0, 0],
    },
    {
      session: 's-loose',
      at: '2026-11-21T08:00:00Z',
      model: 'mystery-model',
      tokens: [10, 20, 30, 40],
    },
    {
      session: 's-loose',
      at: '2026-11-21T08:05:00Z',
      model: 'claude-opus-9',
      tokens: [0, 0, 0, 1000],
    },
    {
      session: 's-app-1',
      at: '2026-10-01T10:00:00Z',
      model: 'claude-opus-9',
      tokens: [0, 0, 1_000_000, 0],
    },
  ]);
});

afterAll(async () => {
  await close();
});

describe('usageOverview', () => {
  it('counts the calls since local midnight for today, per hour', async () => {
    const today = await usageOverview(db, {
      period: 'today',
      timeZone: PARIS,
      now: NOW,
    });
    expect(today.bucket).toBe('hour');
    expect(today.totals.apiCalls).toBe(4);
    expect(today.totals.sessions).toBe(3);
    expect(today.totals.costUsd).toBeCloseTo(4 + 0.1 + 0.02, 6);
    expect(today.series.map((point) => point.bucket)).toEqual(
      Array.from(
        { length: 14 },
        (_, hour) => `2026-11-21T${String(hour).padStart(2, '0')}:00`,
      ),
    );
    expect(today.series[0]?.opus).toBeCloseTo(4, 6);
    expect(today.series[1]).toEqual({
      bucket: '2026-11-21T01:00',
      opus: 0,
      sonnet: 0,
      haiku: 0,
      other: 0,
    });
    expect(today.series[10]?.haiku).toBeCloseTo(0.1, 6);
  });

  it('fills every day of the last 7 days, days without calls at zero', async () => {
    const week = await usageOverview(db, {
      period: '7d',
      timeZone: PARIS,
      now: NOW,
    });
    expect(week.bucket).toBe('day');
    expect(week.totals.apiCalls).toBe(6);
    expect(week.series.map((point) => point.bucket)).toEqual([
      '2026-11-15',
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
    ]);
    expect(week.series[0]?.sonnet).toBeCloseTo(1, 6);
    expect(week.series[3]).toEqual({
      bucket: '2026-11-18',
      opus: 0,
      sonnet: 0,
      haiku: 0,
      other: 0,
    });
    expect(week.series[5]?.sonnet).toBeCloseTo(1, 6);
    expect(week.series[6]?.opus).toBeCloseTo(4.02, 6);
  });

  it('places a call by the local day of the given time zone', async () => {
    const utc = await usageOverview(db, {
      period: 'today',
      timeZone: 'UTC',
      now: NOW,
    });
    expect(utc.totals.apiCalls).toBe(3);
    expect(utc.series).toHaveLength(13);
  });

  it('includes every stored call for all time, from the first day', async () => {
    const all = await usageOverview(db, {
      period: 'all',
      timeZone: PARIS,
      now: NOW,
    });
    expect(all.totals.apiCalls).toBe(7);
    expect(all.series[0]?.bucket).toBe('2026-10-01');
    expect(all.series.at(-1)?.bucket).toBe('2026-11-21');
    expect(all.series).toHaveLength(52);
    expect(all.totals.tokens).toEqual({
      input: 2_000_010,
      cacheWrite: 20,
      cacheRead: 1_000_030,
      output: 201_040,
    });
  });

  it('lists projects by cost, unassigned included and sub-agent calls in their parent project', async () => {
    const week = await usageOverview(db, {
      period: '7d',
      timeZone: PARIS,
      now: NOW,
    });
    expect(week.projects.map((row) => row.project)).toEqual([
      '/work/app',
      '/work/lib',
      'unassigned',
    ]);
    const [app, lib, loose] = week.projects;
    expect(app).toMatchObject({ sessions: 2, apiCalls: 3, tokens: 1_200_000 });
    expect(app?.costUsd).toBeCloseTo(6, 6);
    expect(lib).toMatchObject({ sessions: 1, apiCalls: 1, tokens: 1_000_000 });
    expect(lib?.costUsd).toBeCloseTo(0.1, 6);
    expect(loose).toMatchObject({ sessions: 1, apiCalls: 2, tokens: 1100 });
    expect(loose?.costUsd).toBeCloseTo(0.02, 6);
  });

  it('counts calls of an unknown price in tokens and calls, never in cost', async () => {
    const week = await usageOverview(db, {
      period: '7d',
      timeZone: PARIS,
      now: NOW,
    });
    expect(week.totals.unknownPriceCalls).toBe(1);
    expect(week.models.map((row) => row.model)).toEqual([
      'claude-opus-9',
      'claude-sonnet-9',
      'claude-haiku-9',
      'mystery-model',
    ]);
    expect(week.models.at(-1)).toEqual({
      model: 'mystery-model',
      apiCalls: 1,
      tokens: 100,
      costUsd: null,
    });
    expect(week.series.every((point) => point.other === 0)).toBe(true);
  });

  it('reports no data on an empty database', async () => {
    const empty = await createTestDatabase();
    try {
      const all = await usageOverview(empty.db, {
        period: 'all',
        timeZone: PARIS,
        now: NOW,
      });
      expect(all).toEqual({
        hasData: false,
        bucket: 'day',
        totals: {
          costUsd: 0,
          unknownPriceCalls: 0,
          tokens: { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 },
          sessions: 0,
          apiCalls: 0,
        },
        series: [],
        projects: [],
        models: [],
      });
      const week = await usageOverview(empty.db, {
        period: '7d',
        timeZone: PARIS,
        now: NOW,
      });
      expect(week.series).toHaveLength(7);
    } finally {
      await empty.close();
    }
  });

  it('reports data once a session exists, even with no call in the period', async () => {
    const today = await usageOverview(db, {
      period: 'today',
      timeZone: PARIS,
      now: new Date('2027-03-01T12:00:00Z'),
    });
    expect(today.hasData).toBe(true);
    expect(today.totals.apiCalls).toBe(0);
    expect(today.projects).toEqual([]);
  });
});

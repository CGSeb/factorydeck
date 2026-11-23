import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { featureDetail } from '../features/query.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
import { sessionDetail } from '../sessions/query.ts';
import { API, APP, NOW, seedBreakdown } from '../test/friction-breakdown.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  type FrictionQuery,
  frictionStats,
  issueFrictionCount,
} from './query.ts';

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await seedBreakdown(db);
});

afterAll(async () => {
  await close();
});

function stats(query: Partial<FrictionQuery> = {}) {
  return frictionStats(
    db,
    { period: '7d', timeZone: 'UTC', now: NOW, ...query },
    DEFAULT_CONFIG,
  );
}

describe('a session filter', () => {
  it('counts only the frictions, calls and threads of that session', async () => {
    const result = await stats({ filter: { session: 's-mark' } });
    expect(result.subject).toEqual({
      kind: 'session',
      id: 's-mark',
      title: '',
      agent: 'claude-code',
    });
    expect(result.frictions).toBe(1);
    expect(result.apiCalls).toBe(2);
    expect(
      result.roles.map((row) => [row.role, row.threads, row.frictions]),
    ).toEqual([
      ['builder', 1, 1],
      ['reviewer', 1, 0],
    ]);
    expect(result.issues.map((row) => row.number)).toEqual([21]);
    expect(result.context.threads.map((thread) => thread.peak)).toEqual([
      70_000,
    ]);
    expect(result.context.compacted).toBe(1);
    expect(result.buckets.at(-3)).toEqual({
      start: '2026-03-16',
      frictions: 1,
      apiCalls: 2,
    });
  });

  it('shows an unknown session with no activity', async () => {
    const result = await stats({ filter: { session: 'nobody' } });
    expect(result.subject).toEqual({
      kind: 'session',
      id: 'nobody',
      title: null,
      agent: '',
    });
    expect(result.apiCalls).toBe(0);
    expect(result.frictions).toBe(0);
    expect(result.roles).toEqual([]);
  });
});

describe('an issue filter', () => {
  it('counts only the frictions, calls and threads on that issue', async () => {
    const result = await stats({ project: APP, filter: { issue: 7 } });
    expect(result.subject).toEqual({
      kind: 'issue',
      project: APP,
      number: 7,
      issue: {
        status: 'found',
        title: 'Fix the login',
        url: 'https://git.example/app/issues/7',
      },
    });
    expect(result.frictions).toBe(3);
    expect(result.apiCalls).toBe(4);
    expect(result.issues).toEqual([]);
    expect(
      result.roles.map((row) => [row.role, row.threads, row.frictions]),
    ).toEqual([
      ['main', 1, 2],
      ['unassigned', 1, 1],
      ['reviewer', 1, 0],
    ]);
    expect(
      result.context.threads
        .map((thread) => thread.peak)
        .sort((left, right) => left - right),
    ).toEqual([10_000, 20_000, 30_000]);
    expect(result.context.compacted).toBe(1);
    expect(result.buckets.at(-3)).toEqual({
      start: '2026-03-16',
      frictions: 3,
      apiCalls: 4,
    });
  });

  it('gives a main thread split by markers only its calls on the issue', async () => {
    const result = await stats({ project: APP, filter: { issue: 21 } });
    expect(result.frictions).toBe(1);
    expect(result.apiCalls).toBe(1);
    expect(result.context.threads).toEqual([
      {
        sessionId: 's-mark',
        sessionTitle: '',
        sessionAgent: 'claude-code',
        description: null,
        peak: 40_000,
      },
    ]);
    expect(result.context.compacted).toBe(0);
    expect(result.roles.map((row) => row.role)).toEqual(['builder']);
  });

  it('shows an issue without activity as not found', async () => {
    const result = await stats({ project: API, filter: { issue: 404 } });
    expect(result.subject).toEqual({
      kind: 'issue',
      project: API,
      number: 404,
      issue: { status: 'not-collected' },
    });
    expect(result.apiCalls).toBe(0);
  });
});

describe('issueFrictionCount', () => {
  it('counts the frictions of an issue in the period', async () => {
    const week = '2026-03-12T00:00:00Z';
    expect(
      await issueFrictionCount(
        db,
        DEFAULT_CONFIG,
        { project: APP, number: 7 },
        week,
      ),
    ).toBe(3);
    expect(
      await issueFrictionCount(
        db,
        DEFAULT_CONFIG,
        { project: APP, number: 7 },
        null,
      ),
    ).toBe(4);
    expect(
      await issueFrictionCount(
        db,
        DEFAULT_CONFIG,
        { project: APP, number: 8 },
        null,
      ),
    ).toBe(0);
  });
});

describe('the friction counts of the detail APIs', () => {
  const state = { inactiveAfterMinutes: 30, now: NOW };

  it('gives a session every friction of its life, sub-agents included', async () => {
    expect(
      (await sessionDetail(db, 's-main', state, DEFAULT_CONFIG))?.frictions,
    ).toBe(8);
    expect(
      (await sessionDetail(db, 's-api', state, DEFAULT_CONFIG))?.frictions,
    ).toBe(1);
  });

  it('gives an issue its frictions in the period', async () => {
    const context = { config: DEFAULT_CONFIG, state };
    const key = { project: APP, number: 7 };
    const week = { period: '7d', timeZone: 'UTC', now: NOW } as const;
    expect((await featureDetail(db, key, week, context))?.frictions).toBe(3);
    expect(
      (await featureDetail(db, key, { ...week, period: 'all' }, context))
        ?.frictions,
    ).toBe(4);
    expect(
      (await featureDetail(db, { project: APP, number: 21 }, week, context))
        ?.frictions,
    ).toBe(1);
  });
});

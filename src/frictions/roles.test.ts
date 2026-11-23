import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
import { APP, NOW, seedBreakdown } from '../test/friction-breakdown.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { type FrictionQuery, frictionStats } from './query.ts';

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

describe('a role filter', () => {
  it('gives one pill per role with a thread in the period, by frictions, unassigned last', async () => {
    const result = await stats();
    expect(result.role).toBeNull();
    expect(result.roleOptions).toEqual([
      { role: 'builder', frictions: 5 },
      { role: 'main', frictions: 3 },
      { role: 'reviewer', frictions: 0 },
      { role: 'shipper', frictions: 0 },
      { role: 'unassigned', frictions: 1 },
    ]);
  });

  it('counts the selected kind on each pill', async () => {
    const result = await stats({ kind: 'stop-blocked' });
    expect(result.roleOptions).toEqual([
      { role: 'builder', frictions: 1 },
      { role: 'main', frictions: 1 },
      { role: 'reviewer', frictions: 0 },
      { role: 'shipper', frictions: 0 },
      { role: 'unassigned', frictions: 0 },
    ]);
  });

  it('counts only the threads, calls and frictions of the role, a main thread split by markers included', async () => {
    const result = await stats({ role: 'builder' });
    expect(result.role).toBe('builder');
    expect(result.frictions).toBe(5);
    expect(result.apiCalls).toBe(2);
    expect(result.counts).toEqual({ 'tool-error': 4, 'stop-blocked': 1 });
    expect(result.roles).toEqual([]);
    expect(result.tools.map((row) => [row.tool, row.errors])).toEqual([
      ['Bash', 4],
    ]);
    expect(result.hooks.map((row) => row.blocks)).toEqual([1]);
    expect(result.issues.map((row) => [row.number, row.frictions])).toEqual([
      [9, 4],
      [21, 1],
    ]);
    expect(
      result.context.threads
        .map((thread) => [thread.sessionId, thread.peak])
        .sort((left, right) => Number(left[1]) - Number(right[1])),
    ).toEqual([
      ['s-mark', 40_000],
      ['s-main', 50_000],
    ]);
    expect(result.context.compacted).toBe(0);
    expect(result.buckets.at(-3)).toEqual({
      start: '2026-03-16',
      frictions: 5,
      apiCalls: 2,
    });
    expect(result.roleOptions.map((option) => option.role)).toContain('main');
  });

  it('reads the compacted threads of the role from the stored compactions', async () => {
    const result = await stats({ role: 'reviewer' });
    expect(result.frictions).toBe(0);
    expect(result.apiCalls).toBe(2);
    expect(
      result.context.threads
        .map((thread) => thread.peak)
        .sort((left, right) => left - right),
    ).toEqual([20_000, 70_000]);
    expect(result.context.compacted).toBe(1);
  });

  it('keeps a role with no thread in the period at 0, with no activity', async () => {
    const result = await stats({ role: 'nobody' });
    expect(result.apiCalls).toBe(0);
    expect(result.frictions).toBe(0);
    expect(result.roleOptions).toContainEqual({ role: 'nobody', frictions: 0 });
    expect(result.roleOptions.at(-1)).toEqual({
      role: 'unassigned',
      frictions: 1,
    });
  });

  it('combines with the kind, a session and an issue', async () => {
    const kind = await stats({ role: 'builder', kind: 'stop-blocked' });
    expect(kind.frictions).toBe(1);
    expect(kind.counts).toEqual({ 'tool-error': 4, 'stop-blocked': 1 });
    const errors = await stats({ role: 'builder', kind: 'tool-error' });
    expect(errors.frictions).toBe(4);
    expect(errors.hooks).toEqual([]);
    expect(errors.tools.map((row) => [row.tool, row.errors])).toEqual([
      ['Bash', 4],
    ]);
    expect(errors.roleOptions.slice(0, 2)).toEqual([
      { role: 'builder', frictions: 4 },
      { role: 'main', frictions: 2 },
    ]);
    const session = await stats({
      role: 'builder',
      filter: { session: 's-mark' },
    });
    expect(session.frictions).toBe(1);
    expect(session.apiCalls).toBe(1);
    expect(session.roleOptions).toEqual([
      { role: 'builder', frictions: 1 },
      { role: 'reviewer', frictions: 0 },
    ]);
    const issue = await stats({
      project: APP,
      role: 'unassigned',
      filter: { issue: 7 },
    });
    expect(issue.frictions).toBe(1);
    expect(issue.apiCalls).toBe(1);
    expect(issue.roleOptions).toEqual([
      { role: 'main', frictions: 2 },
      { role: 'reviewer', frictions: 0 },
      { role: 'unassigned', frictions: 1 },
    ]);
  });

  it('starts the All time trend on the earliest API call of the role', async () => {
    const main = await stats({ period: 'all', role: 'main' });
    expect(main.unit).toBe('week');
    expect(main.buckets.map((bucket) => bucket.start)).toEqual([
      '2026-03-02',
      '2026-03-09',
      '2026-03-16',
    ]);
    expect(main.buckets[0]).toEqual({
      start: '2026-03-02',
      frictions: 1,
      apiCalls: 1,
    });
    const shipper = await stats({ period: 'all', role: 'shipper' });
    expect(shipper.buckets.map((bucket) => bucket.start)).toEqual([
      '2026-03-16',
    ]);
  });

  it('cuts the last 30 days by day', async () => {
    const result = await stats({ period: '30d', role: 'builder' });
    expect(result.unit).toBe('day');
    expect(result.buckets).toHaveLength(30);
    expect(result.buckets[0]?.start).toBe('2026-02-17');
    expect(result.buckets.at(-1)?.start).toBe('2026-03-18');
  });
});

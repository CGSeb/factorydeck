import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
import { API, APP, NOW, seedBreakdown } from '../test/friction-breakdown.ts';
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

describe('frictions by role', () => {
  it('gives every role with a thread, unassigned and frictionless roles included', async () => {
    const { roles } = await stats();
    expect(roles).toEqual([
      {
        role: 'builder',
        threads: 2,
        frictions: 5,
        perThread: 2.5,
        mainKind: 'tool-error',
      },
      {
        role: 'main',
        threads: 2,
        frictions: 3,
        perThread: 1.5,
        mainKind: 'tool-error',
      },
      {
        role: 'unassigned',
        threads: 1,
        frictions: 1,
        perThread: 1,
        mainKind: 'tool-error',
      },
      {
        role: 'reviewer',
        threads: 2,
        frictions: 0,
        perThread: 0,
        mainKind: null,
      },
      {
        role: 'shipper',
        threads: 1,
        frictions: 0,
        perThread: 0,
        mainKind: null,
      },
    ]);
  });

  it('counts the selected kind and breaks ties by frictions, then role name', async () => {
    const { roles } = await stats({ kind: 'stop-blocked' });
    expect(
      roles.map((row) => [row.role, row.frictions, row.perThread]),
    ).toEqual([
      ['builder', 1, 0.5],
      ['main', 1, 0.5],
      ['reviewer', 0, 0],
      ['shipper', 0, 0],
      ['unassigned', 0, 0],
    ]);
    expect(roles[0]?.mainKind).toBe('stop-blocked');
  });
});

describe('issues with the most frictions', () => {
  it('gives each issue its frictions and repeated failures, compactions left out', async () => {
    const { issues } = await stats();
    expect(
      issues.map((row) => [
        row.project,
        row.number,
        row.frictions,
        row.repeated,
      ]),
    ).toEqual([
      [APP, 9, 4, 1],
      [APP, 7, 3, 0],
      [APP, 21, 1, 0],
      [API, 3, 1, 0],
    ]);
    expect(issues[0]).not.toHaveProperty('compactions');
  });

  it('says which issues are found, not found or not collected', async () => {
    const { issues } = await stats();
    const seven = issues.find((row) => row.number === 7);
    expect(seven?.issue).toEqual({
      status: 'found',
      title: 'Fix the login',
      url: 'https://git.example/app/issues/7',
    });
    expect(seven?.stage).toBe('open');
    expect(seven?.projectName).toBe('app');
    const nine = issues.find((row) => row.number === 9);
    expect(nine?.issue).toEqual({ status: 'not-found' });
    expect(nine?.stage).toBeNull();
    const three = issues.find((row) => row.number === 3);
    expect(three?.issue).toEqual({ status: 'not-collected' });
    expect(three?.stage).toBeNull();
  });

  it('keeps only issues with a friction of the kind', async () => {
    const { issues } = await stats({ kind: 'stop-blocked' });
    expect(issues.map((row) => [row.number, row.frictions])).toEqual([
      [9, 1],
      [3, 1],
    ]);
  });
});

describe('context peaks', () => {
  it('takes the largest input, cache write and cache read of each thread in the period', async () => {
    const { context } = await stats();
    expect(
      context.threads
        .map((thread) => [thread.sessionId, thread.description, thread.peak])
        .sort((left, right) => Number(left[2]) - Number(right[2])),
    ).toEqual([
      ['s-api', null, 5_000],
      ['s-api', 'Ship #3', 8_000],
      ['s-main', null, 10_000],
      ['s-main', 'Review #7', 20_000],
      ['s-main', 'Look around', 30_000],
      ['s-main', 'Build #9', 50_000],
      ['s-mark', null, 70_000],
    ]);
    expect(context.medianPeak).toBe(20_000);
    expect(context.compacted).toBe(2);
    expect(context.previous).toEqual({ medianPeak: 900_000, threads: 1 });
  });

  it('gives the session title and agent of each thread', async () => {
    const { context } = await stats({ project: APP });
    const main = context.threads.find(
      (thread) => thread.sessionId === 's-main' && thread.description === null,
    );
    expect(main).toMatchObject({
      sessionTitle: 'Fix login #7',
      sessionAgent: 'claude-code',
    });
  });

  it('has no previous period with all time', async () => {
    const { context } = await stats({ period: 'all' });
    expect(context.previous).toBeUndefined();
    expect(
      context.threads.find(
        (thread) =>
          thread.sessionId === 's-main' && thread.description === null,
      )?.peak,
    ).toBe(900_000);
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { OVERVIEW_NOW as NOW, PARIS, seedOverview } from '../test/overview.ts';
import { usageOverview } from './query.ts';

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await seedOverview(db);
});

afterAll(async () => {
  await close();
});

describe('usageOverview of one project', () => {
  it('keeps only the calls of the given project, in every part', async () => {
    const all = await usageOverview(db, {
      period: '7d',
      timeZone: PARIS,
      now: NOW,
    });
    const app = await usageOverview(db, {
      period: '7d',
      timeZone: PARIS,
      project: '/work/app',
      now: NOW,
    });
    const appRow = all.projects.find((row) => row.project === '/work/app');
    expect(app.hasData).toBe(true);
    expect(app.projects).toEqual([appRow]);
    expect(app.totals).toMatchObject({
      sessions: 2,
      apiCalls: 3,
      unknownPriceCalls: 0,
      tokens: {
        input: 1_000_000,
        cacheWrite: 0,
        cacheRead: 0,
        output: 200_000,
      },
    });
    expect(app.totals.costUsd).toBeCloseTo(appRow?.costUsd ?? 0, 6);
    expect(app.models.map((row) => row.model)).toEqual([
      'claude-opus-9',
      'claude-sonnet-9',
    ]);
    expect(app.series.map((point) => point.bucket)).toEqual(
      all.series.map((point) => point.bucket),
    );
    expect(app.series.reduce((sum, point) => sum + point.haiku, 0)).toBe(0);
    expect(
      app.series.reduce(
        (sum, point) => sum + point.opus + point.sonnet + point.other,
        0,
      ),
    ).toBeCloseTo(appRow?.costUsd ?? 0, 6);
  });

  it('starts all time at the first call of the given project', async () => {
    const lib = await usageOverview(db, {
      period: 'all',
      timeZone: PARIS,
      project: '/work/lib',
      now: NOW,
    });
    expect(lib.series.map((point) => point.bucket)).toEqual(['2026-11-21']);
    expect(lib.models.map((row) => row.model)).toEqual(['claude-haiku-9']);
  });

  it('shows nothing for a project with no stored session or another spelling', async () => {
    for (const project of ['/work/none', '/work/app/', '/WORK/APP']) {
      const unknown = await usageOverview(db, {
        period: '7d',
        timeZone: PARIS,
        project,
        now: NOW,
      });
      expect(unknown.hasData).toBe(true);
      expect(unknown.projects).toEqual([]);
      expect(unknown.models).toEqual([]);
      expect(unknown.totals).toMatchObject({
        sessions: 0,
        apiCalls: 0,
        costUsd: 0,
      });
      expect(unknown.series.every((point) => point.opus === 0)).toBe(true);
    }
  });
});

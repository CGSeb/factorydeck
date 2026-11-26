import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  APP,
  DAY,
  PLAIN,
  factory,
  query,
  seedKinds,
} from '../test/kind-seed.ts';
import { bugStats } from './bugs.ts';
import { mergedByKind } from './kinds.ts';

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await seedKinds(db);
});

afterAll(async () => {
  await close();
});

describe('bug stats', () => {
  it('counts the merged issues, the merged bugs, the reopened ones and their times to fix', async () => {
    const bugs = await bugStats(db, query('7d'), factory);
    expect(bugs.current).toEqual({
      merged: 3,
      bugs: 2,
      reopened: 1,
      fixMs: [DAY, 2 * DAY],
      openings: { created: 3, reopened: 0 },
    });
    expect(bugs.kinds).toEqual({ feature: 1, bug: 2 });
    expect(bugs.bugTickets).toBe(true);
  });

  it('counts a bug merged twice after a reopen once, at its latest merge', async () => {
    const bugs = await bugStats(db, query('7d'), factory);
    expect(bugs.issues).toEqual([
      { project: APP, number: 2, title: 'Issue 2', fixMs: 2 * DAY },
      { project: APP, number: 5, title: 'Issue 5', fixMs: DAY },
    ]);
  });

  it('counts a bug merged before the period in the previous one only', async () => {
    const bugs = await bugStats(db, query('7d'), factory);
    expect(bugs.previous).toEqual({
      merged: 1,
      bugs: 1,
      reopened: 0,
      fixMs: [7 * DAY],
      openings: { created: 1, reopened: 0 },
    });
  });

  it('cuts the merged issues and bugs by day', async () => {
    const { unit, buckets } = await bugStats(db, query('7d'), factory);
    expect(unit).toBe('day');
    expect(
      buckets.flatMap(({ start, merged, bugs }) =>
        merged > 0 ? [`${start} ${String(bugs)}/${String(merged)}`] : [],
      ),
    ).toEqual(['2026-03-14 0/1', '2026-03-15 1/1', '2026-03-17 1/1']);
  });

  it('counts the openings of bugs only, by day, with only the creation of a bug whose state events were not collected', async () => {
    const { buckets } = await bugStats(db, query('7d'), factory);
    expect(
      buckets.flatMap(({ start, opened }) =>
        opened > 0 ? [`${start} ${String(opened)}`] : [],
      ),
    ).toEqual(['2026-03-13 1', '2026-03-16 2']);
  });

  it('has no previous period for all time', async () => {
    const bugs = await bugStats(db, query('all'), factory);
    expect(bugs.current.bugs).toBe(3);
    expect(bugs).not.toHaveProperty('previous');
  });

  it('counts the merged issues of each kind as the overview does', async () => {
    for (const period of ['today', '7d', '30d', 'all'] as const) {
      const [bugs, overview] = await Promise.all([
        bugStats(db, query(period), factory),
        mergedByKind(db, query(period), factory),
      ]);
      expect(bugs.kinds).toEqual(overview);
    }
  });

  it('says when no project of the selection has a bug label', async () => {
    const bugs = await bugStats(db, query('7d', undefined, PLAIN), factory);
    expect(bugs.bugTickets).toBe(false);
    expect(bugs.kinds).toEqual({ feature: 1, bug: 0 });
  });
});

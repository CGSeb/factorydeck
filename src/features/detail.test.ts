import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
import {
  APP,
  LIB,
  allTime,
  seedFeatures,
  state,
  week,
} from '../test/features.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { featureDetail } from './query.ts';

const RECENT = new Date('2026-03-12T10:00:00Z');

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await seedFeatures(db);
});

afterAll(async () => {
  await close();
});

function near(value: number): number {
  return expect.closeTo(value, 6) as number;
}

describe('featureDetail', () => {
  it('splits an issue by role, with its orchestration share and sessions', async () => {
    const detail = await featureDetail(db, { project: APP, number: 7 }, week, {
      config: DEFAULT_CONFIG,
      state,
    });
    expect(detail?.issue.status).toBe('found');
    expect(detail?.detail?.outcome.stage).toBe('merged');
    expect(detail?.roles).toEqual([
      {
        role: 'builder',
        threads: 2,
        apiCalls: 2,
        tokens: 3_200_000,
        tokenCounts: {
          input: 3_200_000,
          cacheWrite: 0,
          cacheRead: 0,
          output: 0,
        },
        costUsd: near(6.4),
      },
    ]);
    expect(detail?.orchestration).toEqual({
      role: 'Orchestration',
      threads: 1,
      apiCalls: 2,
      tokens: 825_000,
      tokenCounts: { input: 825_000, cacheWrite: 0, cacheRead: 0, output: 0 },
      costUsd: near(1.5),
    });
    expect(detail?.sessions).toEqual([
      {
        id: 's1',
        title: 'Build queue',
        state: 'inactive',
        lastAt: RECENT.toISOString(),
        tokens: 3_825_000,
        tokenCounts: {
          input: 3_825_000,
          cacheWrite: 0,
          cacheRead: 0,
          output: 0,
        },
        costUsd: near(7.5),
      },
      expect.objectContaining({
        id: 's2',
        tokens: 200_000,
        costUsd: near(0.4),
      }),
    ]);
  });

  it('gives the milestones inside the period only', async () => {
    const context = { config: DEFAULT_CONFIG, state };
    const key = { project: APP, number: 8 };
    const recent = await featureDetail(db, key, week, context);
    expect(recent?.detail?.milestones).toEqual([
      {
        kind: 'report',
        at: '2026-03-12T10:00:00.000Z',
        request: { number: 102, url: 'https://git.example/app/pull/102' },
        score: 60,
        threshold: 80,
        refused: true,
        reasons: ['below-threshold'],
      },
    ]);
    const all = await featureDetail(db, key, allTime, context);
    expect(all?.detail?.milestones.map((milestone) => milestone.kind)).toEqual([
      'report',
      'needs-spec',
      'report',
    ]);
  });

  it('keeps the calls of a main thread with a work item on it', async () => {
    const detail = await featureDetail(db, { project: APP, number: 9 }, week, {
      config: DEFAULT_CONFIG,
      state,
    });
    expect(detail?.roles.map((row) => [row.role, row.tokens])).toEqual([
      ['main', 400_000],
    ]);
    expect(detail?.orchestration).toBeNull();
  });

  it('shows a collected issue with no call in the period', async () => {
    const detail = await featureDetail(db, { project: APP, number: 10 }, week, {
      config: DEFAULT_CONFIG,
      state,
    });
    expect(detail).toMatchObject({
      roles: [],
      sessions: [],
      orchestration: null,
    });
    expect(detail?.detail?.title).toBe('Issue 10');
  });

  it('knows an issue of a project never collected by its older calls', async () => {
    const detail = await featureDetail(db, { project: LIB, number: 3 }, week, {
      config: DEFAULT_CONFIG,
      state,
    });
    expect(detail).toMatchObject({
      issue: { status: 'not-collected' },
      detail: null,
      roles: [],
    });
  });

  it('does not know an issue with no call and no record', async () => {
    for (const key of [
      { project: APP, number: 12_345 },
      { project: '/work/none', number: 7 },
    ]) {
      expect(
        await featureDetail(db, key, allTime, {
          config: DEFAULT_CONFIG,
          state,
        }),
      ).toBeUndefined();
    }
  });
});

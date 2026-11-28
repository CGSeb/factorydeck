import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { gitHostProject } from '../db/schema.ts';
import { createTestDatabase, testRemote } from '../test/postgres.ts';
import { mergedIssue, report, seedIssues } from '../test/stats-seed.ts';
import { qualityStats } from './quality.ts';

const GAIN = '/work/gain';
const NOW = new Date('2026-03-18T12:00:00Z');

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await db.insert(gitHostProject).values({
    remote: testRemote(GAIN),
    autoMerge: true,
    gitHost: 'github',
    syncedFrom: NOW,
  });
  await seedIssues(db, [
    mergedIssue(GAIN, 1, '2026-03-15T10:00:00Z', [
      report('2026-03-15T08:00:00Z'),
    ]),
    mergedIssue(GAIN, 2, '2026-03-14T10:00:00Z', [
      report('2026-03-14T06:00:00Z', { score: 70 }),
      report('2026-03-14T08:00:00Z', { score: 88 }),
    ]),
    {
      project: GAIN,
      number: 3,
      state: 'closed',
      requests: [
        {
          state: 'closed',
          reports: [report('2026-03-12T00:00:00Z', { score: 60 })],
        },
        {
          state: 'merged',
          mergedAt: '2026-03-13T10:00:00Z',
          reports: [
            report('2026-03-13T00:00:00Z', { score: 75 }),
            report('2026-03-13T05:00:00Z', { score: 92 }),
          ],
        },
      ],
    },
    mergedIssue(GAIN, 4, '2026-03-15T10:00:00Z', [
      report('2026-03-15T08:00:00Z', { score: 80 }),
      report('2026-03-15T09:00:00Z', { score: 85 }),
      report('2026-03-15T11:00:00Z', { score: 40 }),
    ]),
    mergedIssue(GAIN, 5, '2026-03-16T10:00:00Z', [
      report('2026-03-16T06:00:00Z', { score: 95 }),
      report('2026-03-16T08:00:00Z', { score: 85 }),
    ]),
    mergedIssue(GAIN, 6, '2026-03-16T10:00:00Z', [
      report('2026-03-16T07:00:00Z', { score: 70 }),
      report('2026-03-16T07:00:00Z', { score: 90 }),
    ]),
    mergedIssue(GAIN, 7, '2026-03-12T10:00:00Z', [
      report('2026-03-12T08:00:00Z', { score: 70 }),
      report('2026-03-12T10:00:00Z', { score: 80 }),
    ]),
    mergedIssue(GAIN, 8, '2026-03-05T04:00:00Z', [
      report('2026-03-05T00:00:00Z', { score: 60 }),
      report('2026-03-05T02:00:00Z', { score: 90 }),
    ]),
  ]);
});

afterAll(async () => {
  await close();
});

describe('score gain', () => {
  it('sums the gain from the first to the last report up to the merge, for the period and the previous one', async () => {
    const quality = await qualityStats(db, {
      period: '7d',
      timeZone: 'UTC',
      project: GAIN,
      now: NOW,
    });
    expect(quality.current).toMatchObject({
      merged: 7,
      gainSum: 55,
      gainCount: 6,
    });
    expect(quality.previous).toMatchObject({ gainSum: 30, gainCount: 1 });
  });
});

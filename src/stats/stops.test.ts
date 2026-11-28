import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { gitHostProject } from '../db/schema.ts';
import type { SerenityReport } from '../git-host/types.ts';
import { createTestDatabase, testRemote } from '../test/postgres.ts';
import {
  type IssueSeed,
  mergedIssue,
  report,
  seedIssues,
} from '../test/stats-seed.ts';
import { autonomyStats } from './autonomy.ts';

const APP = '/work/app';
const API = '/work/api';
const NOW = new Date('2026-03-18T12:00:00Z');
const HOUR = 3_600_000;

let db: Database;
let close: () => Promise<void>;

function merged(
  number: number,
  at: string,
  reports: SerenityReport[],
): IssueSeed {
  return mergedIssue(APP, number, at, reports);
}

function openWith(number: number, reports: SerenityReport[]): IssueSeed {
  return {
    project: APP,
    number,
    state: 'open',
    requests: [{ state: 'open', reports }],
  };
}

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await db.insert(gitHostProject).values(
    [
      { remote: testRemote(APP), autoMerge: true },
      { remote: testRemote(API), autoMerge: false },
    ].map((row) => ({ ...row, gitHost: 'github', syncedFrom: NOW })),
  );
  await seedIssues(db, [
    merged(1, '2026-03-15T10:00:00Z', [
      report('2026-03-14T08:00:00Z', { score: 75, rounds: 2 }),
      report('2026-03-14T11:00:00Z'),
    ]),
    merged(2, '2026-03-14T10:00:00Z', [
      report('2026-03-14T06:00:00Z', { score: 74, rounds: null }),
    ]),
    merged(3, '2026-03-13T12:00:00Z', [
      report('2026-03-13T10:00:00Z', { score: 65, rounds: 3 }),
    ]),
    merged(4, '2026-03-13T12:00:00Z', [
      report('2026-03-13T07:00:00Z', { score: 64 }),
    ]),
    merged(5, '2026-03-15T12:00:00Z', [
      report('2026-03-15T01:00:00Z', { score: 70 }),
      report('2026-03-15T02:00:00Z', { gatesPassed: false, rounds: 2 }),
      report('2026-03-15T06:00:00Z'),
    ]),
    {
      ...merged(6, '2026-03-16T10:00:00Z', [report('2026-03-16T08:00:00Z')]),
      needsSpec: [
        { added: true, at: '2026-03-14T00:00:00Z' },
        { added: false, at: '2026-03-15T00:00:00Z' },
      ],
    },
    mergedIssue(API, 7, '2026-03-16T10:00:00Z', [
      report('2026-03-16T08:00:00Z'),
    ]),
    {
      project: APP,
      number: 8,
      state: 'closed',
      closedAt: '2026-03-12T09:00:00Z',
      requests: [
        {
          state: 'closed',
          reports: [report('2026-03-12T06:00:00Z', { score: 50 })],
        },
      ],
    },
    openWith(9, [report('2026-03-17T00:00:00Z', { score: 50 })]),
    openWith(10, [
      report('2026-03-05T00:00:00Z', { score: 50 }),
      report('2026-03-05T06:00:00Z'),
    ]),
    {
      project: APP,
      number: 11,
      state: 'closed',
      closedAt: '2026-03-12T10:00:00Z',
      requests: [
        {
          state: 'merged',
          mergedAt: '2026-03-12T10:00:00Z',
          reports: [report('2026-03-12T08:00:00Z')],
        },
        {
          state: 'closed',
          reports: [report('2026-03-12T11:00:00Z', { score: 40 })],
        },
      ],
    },
    openWith(12, [
      report('2026-03-16T00:00:00Z', { score: 50 }),
      report('2026-03-16T00:00:00Z'),
    ]),
    {
      project: APP,
      number: 13,
      state: 'open',
      needsSpec: [{ added: true, at: '2026-03-17T00:00:00Z' }],
    },
  ]);
});

afterAll(async () => {
  await close();
});

describe('stops', () => {
  it('times the stops answered in the period, ended by a next report, the merge, the close or the label removal', async () => {
    const autonomy = await autonomyStats(db, {
      period: '7d',
      timeZone: 'UTC',
      now: NOW,
    });
    expect(autonomy.current.stopWaitsMs).toEqual(
      [1, 2, 3, 3, 4, 4, 5, 24].map((hours) => hours * HOUR),
    );
    expect(autonomy.previous?.stopWaitsMs).toEqual([6 * HOUR]);
  });

  it('counts open issues with an open stop, including two reports at the same time', async () => {
    const autonomy = await autonomyStats(db, {
      period: '7d',
      timeZone: 'UTC',
      now: NOW,
    });
    expect(autonomy.waitingNow).toBe(3);
  });

  it('puts each merged issue a person helped in one row, with the rounds of its refusing reports', async () => {
    const autonomy = await autonomyStats(db, {
      period: '7d',
      timeZone: 'UTC',
      now: NOW,
    });
    expect(autonomy.reasons).toEqual({
      below1To5: 1,
      below6To15: 2,
      below16Plus: 1,
      gatesFailed: 1,
      specQuestion: 1,
      autoMergeOff: 1,
      total: 7,
      roundsSum: 9,
      roundsCount: 5,
    });
  });

  it('keeps to one project', async () => {
    const autonomy = await autonomyStats(db, {
      period: '7d',
      timeZone: 'UTC',
      project: API,
      now: NOW,
    });
    expect(autonomy.reasons).toMatchObject({ autoMergeOff: 1, total: 1 });
    expect(autonomy.current.stopWaitsMs).toEqual([]);
  });
});

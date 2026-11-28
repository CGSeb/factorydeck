import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { gitHostIssue, gitHostProject, gitHostRequest } from '../db/schema.ts';
import type { SerenityReport } from '../git-host/types.ts';
import { createTestDatabase, testRemote } from '../test/postgres.ts';
import { qualityStats } from './quality.ts';

const APP = '/work/app';
const API = '/work/api';
const OTHER = '/work/no-project';
const NO_PROJECT_REMOTE = 'github.com/example-org/no-project';

function remoteOf(root: string): string {
  return root === OTHER ? NO_PROJECT_REMOTE : testRemote(root);
}
const NOW = new Date('2026-03-18T12:00:00Z');
const CREATED = new Date('2026-01-01T00:00:00Z');

let db: Database;
let close: () => Promise<void>;

function report(
  at: string,
  {
    score = 90,
    gatesPassed = true,
    rounds = 1,
  }: { score?: number; gatesPassed?: boolean; rounds?: number | null } = {},
): SerenityReport {
  return { score, threshold: 80, rounds, gatesPassed, at };
}

interface RequestSeed {
  number: number;
  state: 'open' | 'merged' | 'closed';
  mergedAt?: string;
  reports?: SerenityReport[];
}

interface Seed {
  project: string;
  number: number;
  state: 'open' | 'closed';
  closedAt?: string;
  reopened?: boolean;
  requests?: RequestSeed[];
}

async function seed(issue: Seed): Promise<void> {
  await db.insert(gitHostIssue).values({
    remote: remoteOf(issue.project),
    number: issue.number,
    title: `Issue ${String(issue.number)}`,
    state: issue.state,
    labels: [],
    url: `https://git.example/issues/${String(issue.number)}`,
    createdAt: CREATED,
    closedAt: issue.closedAt === undefined ? null : new Date(issue.closedAt),
    updatedAt: CREATED,
    reopened: issue.reopened ?? false,
  });
  for (const request of issue.requests ?? []) {
    const reports = request.reports ?? [];
    await db.insert(gitHostRequest).values({
      remote: remoteOf(issue.project),
      number: request.number,
      title: `Request ${String(request.number)}`,
      state: request.state,
      draft: false,
      headBranch: `feat/${String(request.number)}`,
      url: `https://git.example/pull/${String(request.number)}`,
      createdAt: CREATED,
      mergedAt:
        request.mergedAt === undefined ? null : new Date(request.mergedAt),
      updatedAt: new Date(request.mergedAt ?? CREATED),
      closes: [issue.number],
      checks: 'passing',
      report: reports.at(-1) ?? null,
      reports,
    });
  }
}

function merged(
  number: number,
  at: string,
  reports: SerenityReport[] = [],
): RequestSeed {
  return { number, state: 'merged', mergedAt: at, reports };
}

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await db.insert(gitHostProject).values(
    [
      { remote: remoteOf(APP), autoMerge: true },
      { remote: remoteOf(API), autoMerge: false },
      { remote: remoteOf(OTHER), autoMerge: true },
    ].map((row) => ({ ...row, gitHost: 'github', syncedFrom: NOW })),
  );
  await seed({
    project: APP,
    number: 1,
    state: 'closed',
    requests: [
      {
        number: 101,
        state: 'closed',
        reports: [report('2026-03-10T10:00:00Z', { score: 60 })],
      },
      merged(102, '2026-03-15T10:00:00Z', [
        report('2026-03-14T10:00:00Z', { rounds: 2 }),
      ]),
    ],
  });
  await seed({
    project: APP,
    number: 2,
    state: 'closed',
    requests: [
      merged(103, '2026-03-14T10:00:00Z', [
        report('2026-03-13T10:00:00Z', { score: 85 }),
        report('2026-03-13T10:00:00Z', { score: 70, rounds: 3 }),
      ]),
    ],
  });
  await seed({
    project: APP,
    number: 3,
    state: 'closed',
    reopened: true,
    requests: [
      merged(104, '2026-03-13T10:00:00Z', [
        report('2026-03-12T08:00:00Z', { gatesPassed: false }),
        report('2026-03-12T12:00:00Z', { rounds: null }),
      ]),
    ],
  });
  await seed({
    project: API,
    number: 1,
    state: 'closed',
    requests: [
      merged(101, '2026-03-15T10:00:00Z', [report('2026-03-15T08:00:00Z')]),
    ],
  });
  await seed({
    project: APP,
    number: 4,
    state: 'closed',
    requests: [merged(105, '2026-03-16T10:00:00Z')],
  });
  await seed({
    project: APP,
    number: 5,
    state: 'closed',
    closedAt: '2026-03-16T09:00:00Z',
  });
  await seed({
    project: APP,
    number: 6,
    state: 'closed',
    closedAt: '2026-03-01T09:00:00Z',
  });
  await seed({
    project: APP,
    number: 7,
    state: 'closed',
    closedAt: '2026-03-08T09:00:00Z',
  });
  await seed({ project: APP, number: 8, state: 'closed' });
  await seed({
    project: APP,
    number: 9,
    state: 'closed',
    requests: [
      merged(106, '2026-03-08T10:00:00Z', [report('2026-03-08T08:00:00Z')]),
    ],
  });
  await seed({
    project: APP,
    number: 10,
    state: 'closed',
    requests: [
      merged(107, '2026-02-10T10:00:00Z', [
        report('2026-02-10T08:00:00Z', { score: 50 }),
      ]),
    ],
  });
  await seed({
    project: APP,
    number: 11,
    state: 'open',
    requests: [
      {
        number: 108,
        state: 'open',
        reports: [report('2026-03-16T08:00:00Z', { score: 40 })],
      },
    ],
  });
  await seed({
    project: OTHER,
    number: 1,
    state: 'closed',
    requests: [
      merged(101, '2026-03-15T10:00:00Z', [
        report('2026-03-15T08:00:00Z', { score: 10 }),
      ]),
    ],
  });
});

afterAll(async () => {
  await close();
});

function stats(period: 'today' | '7d' | '30d' | 'all', project?: string) {
  return qualityStats(db, { period, timeZone: 'UTC', project, now: NOW });
}

describe('quality stats', () => {
  it('counts first reports, rounds and score gains of the period across projects', async () => {
    const quality = await stats('7d');
    expect(quality.current).toEqual({
      merged: 5,
      mergedWithReport: 4,
      firstPassed: 2,
      roundsSum: 6,
      roundsCount: 3,
      gainSum: 30,
      gainCount: 3,
    });
  });

  it('counts the previous period of the same length', async () => {
    const quality = await stats('7d');
    expect(quality.previous).toEqual({
      merged: 1,
      mergedWithReport: 1,
      firstPassed: 1,
      roundsSum: 1,
      roundsCount: 1,
      gainSum: 0,
      gainCount: 0,
    });
  });

  it('lists the first report of each merged issue of the period, in time order', async () => {
    const quality = await stats('7d');
    expect(quality.firstReports).toEqual([
      { score: 60, threshold: 80, time: '2026-03-10T10:00:00Z' },
      { score: 90, threshold: 80, time: '2026-03-12T08:00:00Z' },
      { score: 85, threshold: 80, time: '2026-03-13T10:00:00Z' },
      { score: 90, threshold: 80, time: '2026-03-15T08:00:00Z' },
    ]);
  });

  it('keeps to one project, where auto-merge off does not fail the first report', async () => {
    const quality = await stats('7d', API);
    expect(quality.current).toMatchObject({
      merged: 1,
      mergedWithReport: 1,
      firstPassed: 1,
      gainCount: 0,
    });
  });

  it('takes every issue for all time, with no previous period', async () => {
    const quality = await stats('all');
    expect(quality.current).toEqual({
      merged: 7,
      mergedWithReport: 6,
      firstPassed: 3,
      roundsSum: 8,
      roundsCount: 5,
      gainSum: 30,
      gainCount: 3,
    });
    expect(quality).not.toHaveProperty('previous');
  });

  it('has no merged issue today', async () => {
    const quality = await stats('today');
    expect(quality.current.merged).toBe(0);
    expect(quality.firstReports).toEqual([]);
  });

  it('counts all time by week, from the week of the first merge, the current one last', async () => {
    const { unit, buckets } = await stats('all');
    expect(unit).toBe('week');
    expect(buckets.find((bucket) => bucket.start === '2026-02-09')).toEqual({
      start: '2026-02-09',
      mergedWithReport: 1,
      firstPassed: 0,
    });
    expect(buckets.slice(-3)).toEqual([
      { start: '2026-03-02', mergedWithReport: 1, firstPassed: 1 },
      { start: '2026-03-09', mergedWithReport: 4, firstPassed: 2 },
      { start: '2026-03-16', mergedWithReport: 0, firstPassed: 0 },
    ]);
  });

  it('counts today by hour, from midnight', async () => {
    const { unit, buckets } = await stats('today');
    expect(unit).toBe('hour');
    expect(buckets).toHaveLength(24);
    expect(buckets[0]?.start).toBe('2026-03-18T00:00');
    expect(buckets.at(-1)?.start).toBe('2026-03-18T23:00');
    expect(buckets.every((bucket) => bucket.mergedWithReport === 0)).toBe(true);
  });
});

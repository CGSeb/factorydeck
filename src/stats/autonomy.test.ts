import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { gitHostIssue, gitHostProject, gitHostRequest } from '../db/schema.ts';
import type { LabelChange, SerenityReport } from '../git-host/types.ts';
import { createTestDatabase, testRemote } from '../test/postgres.ts';
import { autonomyStats } from './autonomy.ts';
import { statsBounds } from './bounds.ts';

const APP = '/work/app';
const API = '/work/api';
const OTHER = '/work/no-project';
const NO_PROJECT_REMOTE = 'github.com/example-org/no-project';

function remoteOf(root: string): string {
  return root === OTHER ? NO_PROJECT_REMOTE : testRemote(root);
}
const NOW = new Date('2026-03-18T12:00:00Z');
const HOUR = 3_600_000;
const LABELS = {
  ready: 'agent:ready',
  working: 'agent:working',
  needs_spec: 'agent:needs-spec',
  review: 'agent:review',
  blocked: 'agent:blocked',
};

let db: Database;
let close: () => Promise<void>;

function report(at: string, score = 90, gatesPassed = true): SerenityReport {
  return { score, threshold: 80, rounds: 1, gatesPassed, at };
}

function episode(addedAt: string, removedAt?: string): LabelChange[] {
  return [
    { added: true, at: addedAt },
    ...(removedAt === undefined ? [] : [{ added: false, at: removedAt }]),
  ];
}

interface Seed {
  project: string;
  number: number;
  state?: 'open' | 'closed';
  needsSpec?: LabelChange[];
  labels?: string[];
  merged?: { at: string | null; updatedAt?: string };
  reports?: SerenityReport[];
}

async function seed(issue: Seed): Promise<void> {
  const created = new Date('2026-01-01T00:00:00Z');
  await db.insert(gitHostIssue).values({
    remote: remoteOf(issue.project),
    number: issue.number,
    title: `Issue ${String(issue.number)}`,
    state: issue.state ?? (issue.merged === undefined ? 'open' : 'closed'),
    labels: (issue.labels ?? []).map((name) => ({ name, color: null })),
    url: `https://git.example/issues/${String(issue.number)}`,
    createdAt: created,
    updatedAt: created,
    needsSpec: issue.needsSpec ?? [],
  });
  if (issue.merged === undefined) return;
  const reports = issue.reports ?? [];
  const mergedAt = issue.merged.at === null ? null : new Date(issue.merged.at);
  await db.insert(gitHostRequest).values({
    remote: remoteOf(issue.project),
    number: 100 + issue.number,
    title: `Request ${String(issue.number)}`,
    state: 'merged',
    draft: false,
    headBranch: `feat/${String(issue.number)}`,
    url: `https://git.example/pull/${String(issue.number)}`,
    createdAt: created,
    mergedAt,
    updatedAt: new Date(issue.merged.updatedAt ?? issue.merged.at ?? ''),
    closes: [issue.number],
    checks: 'passing',
    report: reports.at(-1) ?? null,
    reports,
  });
}

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await db.insert(gitHostProject).values(
    [
      { remote: remoteOf(APP), autoMerge: true },
      { remote: remoteOf(API), autoMerge: false },
      { remote: remoteOf(OTHER), autoMerge: true },
    ].map((row) => ({
      ...row,
      gitHost: 'github',
      syncedFrom: NOW,
      stageLabels: LABELS,
    })),
  );
  await seed({
    project: APP,
    number: 1,
    merged: { at: '2026-03-15T10:00:00Z' },
  });
  await seed({
    project: APP,
    number: 2,
    merged: { at: '2026-03-14T10:00:00Z' },
    reports: [
      report('2026-03-13T10:00:00Z', 60),
      report('2026-03-14T08:00:00Z'),
    ],
  });
  await seed({
    project: APP,
    number: 3,
    merged: { at: '2026-03-13T10:00:00Z' },
    needsSpec: episode('2026-03-10T00:00:00Z', '2026-03-12T06:00:00Z'),
    reports: [report('2026-03-13T08:00:00Z', 90, false)],
  });
  await seed({
    project: APP,
    number: 4,
    merged: { at: '2026-03-08T10:00:00Z' },
  });
  await seed({
    project: APP,
    number: 5,
    merged: { at: '2026-03-01T10:00:00Z' },
  });
  await seed({
    project: APP,
    number: 6,
    merged: { at: null, updatedAt: '2026-03-16T10:00:00Z' },
  });
  await seed({
    project: APP,
    number: 7,
    merged: { at: '2026-03-15T10:00:00Z' },
    needsSpec: episode('2026-03-16T00:00:00Z', '2026-03-17T00:00:00Z'),
  });
  await seed({
    project: APP,
    number: 8,
    labels: ['agent:needs-spec'],
    needsSpec: episode('2026-03-17T00:00:00Z'),
  });
  await seed({
    project: APP,
    number: 9,
    state: 'closed',
    needsSpec: episode('2026-03-17T00:00:00Z'),
  });
  await seed({
    project: APP,
    number: 10,
    needsSpec: [
      ...episode('2026-02-01T00:00:00Z', '2026-02-02T00:00:00Z'),
      ...episode('2026-03-06T00:00:00Z', '2026-03-06T03:00:00Z'),
    ],
  });
  await seed({
    project: API,
    number: 1,
    merged: { at: '2026-03-15T10:00:00Z' },
    reports: [report('2026-03-15T08:00:00Z')],
  });
  await seed({
    project: OTHER,
    number: 1,
    merged: { at: '2026-03-15T10:00:00Z' },
  });
});

afterAll(async () => {
  await close();
});

function stats(period: 'today' | '7d' | '30d' | 'all', project?: string) {
  return autonomyStats(db, { period, timeZone: 'UTC', project, now: NOW });
}

describe('autonomy stats', () => {
  it('counts the merges of the period, its previous period and the reasons, across projects, none of which has a factory file on disk', async () => {
    const autonomy = await stats('7d');
    expect(autonomy.current).toEqual({
      merged: 6,
      mergedWithoutPerson: 3,
      mergedAfterQuestion: 1,
      stopWaitsMs: [2 * HOUR, 22 * HOUR, 24 * HOUR, 54 * HOUR],
    });
    expect(autonomy.previous).toEqual({
      merged: 1,
      mergedWithoutPerson: 1,
      mergedAfterQuestion: 0,
      stopWaitsMs: [3 * HOUR],
    });
    expect(autonomy.waitingNow).toBe(1);
    expect(autonomy.reasons).toEqual({
      below1To5: 0,
      below6To15: 0,
      below16Plus: 1,
      gatesFailed: 1,
      specQuestion: 0,
      autoMergeOff: 1,
      total: 3,
      roundsSum: 2,
      roundsCount: 2,
    });
  });

  it('keeps to one project', async () => {
    const autonomy = await stats('7d', API);
    expect(autonomy.current.merged).toBe(1);
    expect(autonomy.current.mergedWithoutPerson).toBe(0);
    expect(autonomy.reasons).toEqual({
      below1To5: 0,
      below6To15: 0,
      below16Plus: 0,
      gatesFailed: 0,
      specQuestion: 0,
      autoMergeOff: 1,
      total: 1,
      roundsSum: 0,
      roundsCount: 0,
    });
    expect(autonomy.waitingNow).toBe(0);
  });

  it('takes every merge for all time, with no previous period', async () => {
    const autonomy = await stats('all');
    expect(autonomy.current.merged).toBe(8);
    expect(autonomy.current.stopWaitsMs).toHaveLength(6);
    expect(autonomy).not.toHaveProperty('previous');
  });

  it('compares today with yesterday', async () => {
    const autonomy = await stats('today');
    expect(autonomy.current.merged).toBe(0);
    expect(autonomy.previous?.merged).toBe(0);
    expect(autonomy.previous?.stopWaitsMs).toEqual([24 * HOUR]);
  });

  it('counts all time by week, from the week of the first merge, the current one last', async () => {
    const { unit, buckets } = await stats('all');
    expect(unit).toBe('week');
    expect(buckets).toEqual([
      { start: '2026-02-23', merged: 1, mergedWithoutPerson: 1 },
      { start: '2026-03-02', merged: 1, mergedWithoutPerson: 1 },
      { start: '2026-03-09', merged: 5, mergedWithoutPerson: 2 },
      { start: '2026-03-16', merged: 1, mergedWithoutPerson: 1 },
    ]);
  });

  it('counts the last 7 days by day, today last', async () => {
    const { unit, buckets } = await stats('7d');
    expect(unit).toBe('day');
    expect(buckets).toEqual([
      { start: '2026-03-12', merged: 0, mergedWithoutPerson: 0 },
      { start: '2026-03-13', merged: 1, mergedWithoutPerson: 0 },
      { start: '2026-03-14', merged: 1, mergedWithoutPerson: 0 },
      { start: '2026-03-15', merged: 3, mergedWithoutPerson: 2 },
      { start: '2026-03-16', merged: 1, mergedWithoutPerson: 1 },
      { start: '2026-03-17', merged: 0, mergedWithoutPerson: 0 },
      { start: '2026-03-18', merged: 0, mergedWithoutPerson: 0 },
    ]);
  });

  it('places the period and the days in the browser time zone', async () => {
    const bounds = await statsBounds(db, {
      period: '7d',
      timeZone: 'Europe/Paris',
      now: NOW,
    });
    expect(new Date(bounds.start ?? 0).toISOString()).toBe(
      '2026-03-11T23:00:00.000Z',
    );
    expect(new Date(bounds.previousStart ?? 0).toISOString()).toBe(
      '2026-03-04T23:00:00.000Z',
    );
    expect(new Date(bounds.buckets.at(-1)?.start ?? 0).toISOString()).toBe(
      '2026-03-17T23:00:00.000Z',
    );
  });
});

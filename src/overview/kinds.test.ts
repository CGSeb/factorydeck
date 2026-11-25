import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listBugs } from '../bugs/query.ts';
import type { Database } from '../db/client.ts';
import { gitHostIssue, gitHostProject, gitHostRequest } from '../db/schema.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
import { autonomyStats } from '../stats/autonomy.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { overviewKinds } from './kinds.ts';
import { PERIODS, type Period } from './types.ts';

const APP = '/work/app';
const API = '/work/api';
const OTHER = '/work/no-factory';
const NOW = new Date('2026-03-18T12:00:00Z');
const LABELS = {
  ready: 'agent:ready',
  working: 'agent:working',
  needs_spec: 'agent:needs-spec',
  review: 'agent:review',
  blocked: 'agent:blocked',
};

let db: Database;
let close: () => Promise<void>;

interface Seed {
  project: string;
  number: number;
  labels?: string[];
  merged?: string;
  closed?: string;
  review?: boolean;
}

async function seed(issue: Seed): Promise<void> {
  const created = new Date('2026-01-01T00:00:00Z');
  const ended = issue.merged ?? issue.closed;
  await db.insert(gitHostIssue).values({
    project: issue.project,
    number: issue.number,
    title: `Issue ${String(issue.number)}`,
    state: ended === undefined ? 'open' : 'closed',
    labels: (issue.labels ?? []).map((name) => ({ name, color: null })),
    url: `https://git.example/issues/${String(issue.number)}`,
    createdAt: created,
    updatedAt: created,
    closedAt: ended === undefined ? null : new Date(ended),
    needsSpec: [],
  });
  if (issue.merged === undefined && issue.review !== true) return;
  const at = issue.merged === undefined ? created : new Date(issue.merged);
  await db.insert(gitHostRequest).values({
    project: issue.project,
    number: 100 + issue.number,
    title: `Request ${String(issue.number)}`,
    state: issue.merged === undefined ? 'open' : 'merged',
    draft: false,
    headBranch: `feat/${String(issue.number)}`,
    url: `https://git.example/pull/${String(issue.number)}`,
    createdAt: created,
    mergedAt: issue.merged === undefined ? null : at,
    updatedAt: at,
    closes: [issue.number],
    checks: 'passing',
    report: null,
    reports: [],
  });
}

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await db.insert(gitHostProject).values(
    [
      { project: APP, bugLabel: 'Bug' },
      { project: API, bugLabel: null },
      { project: OTHER, bugLabel: 'bug' },
    ].map((row) => ({
      ...row,
      autoMerge: true,
      gitHost: 'github',
      syncedFrom: NOW,
      stageLabels: LABELS,
    })),
  );
  const seeds: Seed[] = [
    { project: APP, number: 1, merged: '2026-03-15T10:00:00Z' },
    {
      project: APP,
      number: 2,
      labels: ['bug'],
      merged: '2026-03-16T10:00:00Z',
    },
    {
      project: APP,
      number: 3,
      labels: [' BUG '],
      merged: '2026-03-18T08:00:00Z',
    },
    {
      project: APP,
      number: 4,
      labels: ['bug'],
      merged: '2026-02-01T10:00:00Z',
    },
    { project: APP, number: 5, labels: ['bug'] },
    { project: APP, number: 6, labels: ['bug', 'agent:working'] },
    { project: APP, number: 7, labels: ['bug'], review: true },
    {
      project: APP,
      number: 8,
      labels: ['bug'],
      closed: '2026-03-17T10:00:00Z',
    },
    { project: APP, number: 9 },
    {
      project: API,
      number: 1,
      labels: ['bug'],
      merged: '2026-03-17T10:00:00Z',
    },
    { project: API, number: 2, labels: ['bug'] },
    {
      project: OTHER,
      number: 1,
      labels: ['bug'],
      merged: '2026-03-17T10:00:00Z',
    },
  ];
  for (const issue of seeds) await seed(issue);
});

afterAll(async () => {
  await close();
});

const factory = (project: string): Promise<boolean> =>
  Promise.resolve(project !== OTHER);

function query(period: Period, project?: string) {
  return { period, timeZone: 'UTC', project, now: NOW };
}

function kinds(period: Period, project?: string) {
  return overviewKinds(db, query(period, project), factory);
}

describe('overview kinds', () => {
  it('counts the merges of the period by the kind of their current labels', async () => {
    expect((await kinds('7d')).merged).toEqual({ feature: 2, bug: 2 });
    expect((await kinds('today')).merged).toEqual({ feature: 0, bug: 1 });
    expect((await kinds('all')).merged).toEqual({ feature: 2, bug: 3 });
  });

  it('counts a bug label of a project without bug tickets as a feature', async () => {
    expect((await kinds('7d', API)).merged).toEqual({ feature: 1, bug: 0 });
  });

  it('adds up to the merges of the stats header for every period and project', async () => {
    for (const project of [undefined, APP, API]) {
      for (const period of PERIODS) {
        const { merged } = await kinds(period, project);
        const autonomy = await autonomyStats(
          db,
          query(period, project),
          factory,
        );
        expect(merged.feature + merged.bug).toBe(autonomy.current.merged);
      }
    }
  });

  it('counts the open bugs of the bugs page, whatever the period', async () => {
    for (const period of PERIODS) {
      const found = await kinds(period, APP);
      const bugs = await listBugs(db, query(period, APP), DEFAULT_CONFIG);
      expect(found.openBugs).toBe(3);
      expect(found.openBugs).toBe(bugs.counts.open);
      expect(found.bugTickets).toBe(true);
    }
  });

  it('says when no project of the selection uses bug tickets', async () => {
    expect(await kinds('7d', API)).toEqual({
      merged: { feature: 1, bug: 0 },
      openBugs: 0,
      bugTickets: false,
    });
  });
});

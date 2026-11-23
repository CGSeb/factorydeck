import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import {
  apiCall,
  gitHostIssue,
  gitHostProject,
  gitHostRequest,
  session,
  subAgent,
} from '../db/schema.ts';
import { usageOverview } from '../overview/query.ts';
import type { Period } from '../overview/types.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { flowStats } from './flow.ts';

const APP = '/work/app';
const API = '/work/api';
const OTHER = '/work/no-factory';
const NOW = new Date('2026-03-18T12:00:00Z');
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const SONNET = 'claude-sonnet-4-5';

let db: Database;
let close: () => Promise<void>;
let request = 0;

interface Tokens {
  input?: number;
  cacheWrite?: number;
  cacheRead?: number;
  output?: number;
}

function call(
  sessionId: string,
  at: string,
  tokens: Tokens,
  subAgentId: string | null = null,
) {
  request += 1;
  return {
    sourcePath: `/logs/${sessionId}.jsonl`,
    requestKey: `req_${String(request)}`,
    sessionId,
    subAgentId,
    at: new Date(at),
    model: SONNET,
    inputTokens: tokens.input ?? 0,
    cacheWriteTokens: tokens.cacheWrite ?? 0,
    cacheReadTokens: tokens.cacheRead ?? 0,
    outputTokens: tokens.output ?? 0,
  };
}

function agent(sessionId: string, id: string, type: string, text: string) {
  return {
    sessionId,
    id,
    agentType: type,
    description: text,
    firstAt: new Date('2026-01-01T00:00:00Z'),
  };
}

interface Seed {
  project?: string;
  number: number;
  createdAt: string;
  mergedAt?: string;
  closed?: boolean;
}

async function seedIssue({
  project = APP,
  number,
  createdAt,
  mergedAt,
  closed = false,
}: Seed): Promise<void> {
  const created = new Date(createdAt);
  await db.insert(gitHostIssue).values({
    project,
    number,
    title: `Issue ${String(number)}`,
    state: closed || mergedAt !== undefined ? 'closed' : 'open',
    labels: [],
    url: `https://git.example/issues/${String(number)}`,
    createdAt: created,
    updatedAt: created,
  });
  if (mergedAt === undefined) return;
  await db.insert(gitHostRequest).values({
    project,
    number: 100 + number,
    title: `Request ${String(number)}`,
    state: 'merged',
    draft: false,
    headBranch: `feat/${String(number)}`,
    url: `https://git.example/pull/${String(number)}`,
    createdAt: created,
    mergedAt: new Date(mergedAt),
    updatedAt: new Date(mergedAt),
    closes: [number],
    checks: 'passing',
  });
}

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await db.insert(gitHostProject).values(
    [APP, API, OTHER].map((project) => ({
      project,
      gitHost: 'github',
      syncedFrom: NOW,
      autoMerge: true,
    })),
  );
  await seedIssue({
    number: 1,
    createdAt: '2026-03-10T00:00:00Z',
    mergedAt: '2026-03-14T00:00:00Z',
  });
  await seedIssue({
    number: 2,
    createdAt: '2026-03-13T03:00:00Z',
    mergedAt: '2026-03-15T03:00:00Z',
  });
  await seedIssue({
    number: 3,
    createdAt: '2026-02-20T00:00:00Z',
    closed: true,
  });
  await seedIssue({
    number: 4,
    createdAt: '2026-03-16T00:00:00Z',
    mergedAt: '2026-03-15T00:00:00Z',
  });
  await seedIssue({
    number: 6,
    createdAt: '2026-03-01T00:00:00Z',
    mergedAt: '2026-03-07T00:00:00Z',
  });
  await seedIssue({
    number: 7,
    createdAt: '2026-02-20T00:00:00Z',
    mergedAt: '2026-03-01T10:00:00Z',
  });
  await seedIssue({
    project: API,
    number: 1,
    createdAt: '2026-03-14T00:00:00Z',
    mergedAt: '2026-03-16T00:00:00Z',
  });
  await seedIssue({
    project: OTHER,
    number: 1,
    createdAt: '2026-03-14T00:00:00Z',
    mergedAt: '2026-03-16T00:00:00Z',
  });
  await db.insert(session).values([
    { id: 's1', project: APP, title: 'Build queue' },
    { id: 's2', project: APP, title: 'Export' },
    { id: 's3', project: APP, title: 'Earlier queue' },
    { id: 's4', project: APP, title: 'Chat' },
  ]);
  await db
    .insert(subAgent)
    .values([
      agent('s1', 'a1', 'builder', 'Build #1'),
      agent('s1', 'a2', 'reviewer', 'Review #2'),
      agent('s2', 'b1', 'builder', 'Build #3'),
      agent('s3', 'c1', 'builder', 'Build #6'),
    ]);
  await db.insert(apiCall).values([
    call('s1', '2026-03-08T00:00:00Z', { input: 1_000_000 }, 'a1'),
    call('s1', '2026-03-13T00:00:00Z', { input: 2_000_000 }, 'a1'),
    call('s1', '2026-03-13T00:00:00Z', { input: 1_000_000 }, 'a2'),
    call('s1', '2026-03-13T01:00:00Z', { input: 600_000 }),
    call('s2', '2026-03-01T00:00:00Z', { input: 200_000 }, 'b1'),
    call('s2', '2026-03-14T00:00:00Z', { input: 500_000 }, 'b1'),
    call('s3', '2026-03-06T00:00:00Z', { input: 400_000 }, 'c1'),
    call('s4', '2026-03-16T00:00:00Z', {
      input: 100_000,
      cacheWrite: 50_000,
      cacheRead: 900_000,
      output: 10_000,
    }),
  ]);
});

afterAll(async () => {
  await close();
});

const factory = (project: string): Promise<boolean> =>
  Promise.resolve(project !== OTHER);

function stats(period: Period, project?: string) {
  return flowStats(
    db,
    { period, timeZone: 'UTC', project, now: NOW },
    DEFAULT_CONFIG,
    factory,
  );
}

describe('flow stats', () => {
  it('times and costs each issue merged in the period, over its whole life', async () => {
    const { current } = await stats('7d', APP);
    expect(current.issues).toEqual([
      {
        project: APP,
        number: 1,
        title: 'Issue 1',
        leadMs: 4 * DAY,
        cycleMs: 6 * DAY,
        tokens: 3_450_000,
      },
      {
        project: APP,
        number: 4,
        title: 'Issue 4',
        leadMs: 0,
        cycleMs: null,
        tokens: null,
      },
      {
        project: APP,
        number: 2,
        title: 'Issue 2',
        leadMs: 2 * DAY,
        cycleMs: 2 * DAY + 3 * HOUR,
        tokens: 1_150_000,
      },
    ]);
  });

  it('splits the tokens of the period by where they went', async () => {
    const { current } = await stats('7d', APP);
    expect(current.tokens).toEqual({
      total: 5_160_000,
      droppedWork: 500_000,
      noWorkItem: 1_060_000,
      rework: 0,
      apiCalls: 5,
    });
  });

  it('gives the period the totals of the overview', async () => {
    for (const period of ['today', '7d', '30d', 'all'] as const) {
      const [{ current }, overview] = await Promise.all([
        stats(period),
        usageOverview(db, { period, timeZone: 'UTC', now: NOW }),
      ]);
      const counts = overview.totals.tokens;
      expect(current.tokens.total).toBe(
        counts.input + counts.cacheWrite + counts.cacheRead + counts.output,
      );
      expect(current.tokens.apiCalls).toBe(overview.totals.apiCalls);
    }
  });

  it('compares with the previous period', async () => {
    const { previous } = await stats('7d', APP);
    expect(previous).toEqual({
      issues: [{ leadMs: 6 * DAY, cycleMs: DAY, tokens: 400_000 }],
      tokens: {
        total: 1_400_000,
        droppedWork: 0,
        noWorkItem: 0,
        rework: 0,
        apiCalls: 2,
      },
    });
  });

  it('takes every merge for all time, with no previous period', async () => {
    const flow = await stats('all');
    expect(flow.current.issues.map((issue) => issue.number)).toEqual([
      7, 6, 1, 4, 2, 1,
    ]);
    expect(flow.current.tokens.droppedWork).toBe(700_000);
    expect(flow).not.toHaveProperty('previous');
  });

  it('counts every factory project together, and leaves the others out', async () => {
    const { current } = await stats('7d');
    expect(
      current.issues.map((issue) => `${issue.project}#${String(issue.number)}`),
    ).toEqual([`${APP}#1`, `${APP}#4`, `${APP}#2`, `${API}#1`]);
  });

  it('counts merges by day for 30 days, a merge at midnight in the day it opens', async () => {
    const { unit, buckets } = await stats('30d', APP);
    expect([unit, buckets.length, buckets[0]?.start]).toEqual([
      'day',
      30,
      '2026-02-17',
    ]);
    expect(
      buckets.flatMap(({ start, merged }) =>
        merged > 0 ? [`${start} ${String(merged)}`] : [],
      ),
    ).toEqual(['2026-03-01 1', '2026-03-07 1', '2026-03-14 1', '2026-03-15 2']);
  });
});

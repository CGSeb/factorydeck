import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import {
  apiCall,
  gitHostIssue,
  gitHostProject,
  gitHostRequest,
  session,
  subAgent,
} from '../db/schema.ts';
import type { FeatureQuery } from '../features/types.ts';
import type { SerenityReport, StateEvent } from '../git-host/types.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { featureDetail } from '../features/query.ts';
import { bugCounts, listBugs } from './query.ts';
import type { BugList, BugRow } from './types.ts';

const APP = '/work/app';
const NOW = new Date('2026-03-12T15:30:00Z');
const CREATED = '2026-03-01T10:00:00.000Z';
const allTime: FeatureQuery = { period: 'all', timeZone: 'UTC', now: NOW };

let db: Database;
let close: () => Promise<void>;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
});

afterEach(async () => {
  await close();
});

function day(date: number, hour = 10): string {
  return new Date(Date.UTC(2026, 2, date, hour)).toISOString();
}

function closedOn(at: string): StateEvent {
  return { state: 'closed', at };
}

function reopenedOn(at: string): StateEvent {
  return { state: 'reopened', at };
}

function report(score: number, rootCause: string, at: string): SerenityReport {
  return {
    score,
    threshold: 80,
    rounds: 1,
    gatesPassed: true,
    at,
    rootCause,
    reproduced: 'failed-on-main',
  };
}

function bug(
  number: number,
  stateEvents: StateEvent[],
  { state = 'open', labels = [] }: { state?: string; labels?: string[] } = {},
) {
  const closedAt = state === 'closed' ? stateEvents.at(-1)?.at : undefined;
  return {
    project: APP,
    number,
    title: `Issue ${String(number)}`,
    state,
    labels: ['bug', ...labels].map((name) => ({ name, color: null })),
    url: `https://git.example/app/issues/${String(number)}`,
    createdAt: new Date(CREATED),
    closedAt: closedAt === undefined ? null : new Date(closedAt),
    updatedAt: new Date(day(12)),
    reopened: stateEvents.some((event) => event.state === 'reopened'),
    stateEvents,
  };
}

function request(
  number: number,
  closes: number,
  {
    createdAt,
    mergedAt = null,
    score = 85,
    rootCause = `cause ${String(number)}`,
  }: {
    createdAt: string;
    mergedAt?: string | null;
    score?: number;
    rootCause?: string;
  },
) {
  const at = mergedAt ?? createdAt;
  const found = report(score, rootCause, at);
  return {
    project: APP,
    number,
    title: `Request ${String(number)}`,
    state: mergedAt === null ? 'open' : 'merged',
    draft: false,
    headBranch: `fix/${String(closes)}`,
    url: `https://git.example/app/pull/${String(number)}`,
    createdAt: new Date(createdAt),
    mergedAt: mergedAt === null ? null : new Date(mergedAt),
    updatedAt: new Date(at),
    closes: [closes],
    checks: 'passing',
    report: found,
    reports: [found],
  };
}

async function seed(): Promise<void> {
  await db.insert(gitHostProject).values({
    project: APP,
    gitHost: 'github',
    repository: 'example-org/example-app',
    syncedFrom: NOW,
    autoMerge: true,
    bugLabel: 'bug',
    stageLabels: {
      ready: 'agent:ready',
      working: 'agent:working',
      needs_spec: 'agent:needs-spec',
      review: 'agent:review',
      blocked: 'agent:blocked',
    },
  });
  await db.insert(gitHostIssue).values([
    bug(10, [closedOn(day(3)), reopenedOn(day(5)), closedOn(day(7))], {
      state: 'closed',
    }),
    bug(
      11,
      [
        closedOn(day(2)),
        reopenedOn(day(3)),
        closedOn(day(4)),
        reopenedOn(day(5)),
      ],
      { labels: ['agent:working'] },
    ),
    bug(12, [closedOn(day(2)), reopenedOn(day(3)), closedOn(day(4))], {
      state: 'closed',
    }),
    bug(13, [closedOn(day(3)), reopenedOn(day(4))]),
    bug(14, [closedOn(day(11)), reopenedOn(day(12, 8))]),
    bug(15, [], { labels: ['agent:ready'] }),
  ]);
  await db.insert(gitHostRequest).values([
    request(20, 10, {
      createdAt: day(2),
      mergedAt: day(3),
      score: 90,
      rootCause: 'the first guess',
    }),
    request(21, 10, {
      createdAt: day(6),
      mergedAt: day(7),
      score: 82,
      rootCause: 'the real cause',
    }),
    request(22, 11, { createdAt: day(4, 12), score: 70 }),
    request(23, 11, { createdAt: day(6), score: 88, rootCause: 'third try' }),
    request(24, 12, {
      createdAt: day(1, 12),
      mergedAt: day(4),
      rootCause: 'merged late',
    }),
    request(25, 13, { createdAt: day(2), mergedAt: day(3, 11) }),
    request(26, 14, { createdAt: day(10), mergedAt: day(11) }),
  ]);
}

let requestKey = 0;

function call(
  sessionId: string,
  input: number,
  at: string,
  subAgentId: string | null = null,
) {
  requestKey += 1;
  return {
    sourcePath: `/logs/${sessionId}.jsonl`,
    requestKey: `req_${String(requestKey)}`,
    sessionId,
    subAgentId,
    at: new Date(at),
    model: 'claude-sonnet-4-5',
    inputTokens: input,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    outputTokens: 0,
  };
}

async function seedCalls(): Promise<void> {
  await db
    .insert(session)
    .values([{ id: 's1', project: APP, title: 'Fix the queue', lastAt: NOW }]);
  await db.insert(subAgent).values([
    {
      sessionId: 's1',
      id: 'a1',
      agentType: 'debugger',
      description: 'Fix #10',
      firstAt: new Date(day(2)),
    },
  ]);
  await db
    .insert(apiCall)
    .values([
      call('s1', 1_000, day(2, 12), 'a1'),
      call('s1', 300, day(2, 12)),
      call('s1', 500, day(6), 'a1'),
      call('s1', 200, day(6)),
      call('s1', 50, day(8), 'a1'),
    ]);
}

function rowsOf(list: BugList): BugRow[] {
  return [...list.groups.open, ...list.groups.fixing, ...list.groups.fixed];
}

function rowOf(list: BugList, number: number): BugRow | undefined {
  return rowsOf(list).find((row) => row.number === number);
}

describe('listBugs with versions', () => {
  it('shows a bug reopened after a merge and fixed again by its second request', async () => {
    await seed();
    const list = await listBugs(db, allTime, DEFAULT_CONFIG);
    expect(list.groups.fixed.map((row) => row.number)).toContain(10);
    expect(rowOf(list, 10)).toMatchObject({
      stage: 'merged',
      createdAt: CREATED,
      version: { number: 2, count: 2, startedAt: day(5) },
      mergedAt: day(7),
      fix: { rootCause: 'the real cause', reproduced: 'failed-on-main' },
      score: 82,
      threshold: 80,
    });
  });

  it('puts a bug in its third version in Fixing with the fix of that version only', async () => {
    await seed();
    const list = await listBugs(db, allTime, DEFAULT_CONFIG);
    expect(list.groups.fixing.map((row) => row.number)).toEqual([11]);
    expect(rowOf(list, 11)).toMatchObject({
      stage: 'working',
      version: { number: 3, count: 3, startedAt: day(5) },
      fix: { rootCause: 'third try' },
      score: 88,
    });
  });

  it('gives a request created in one version and merged in the next to the next one', async () => {
    await seed();
    const list = await listBugs(db, allTime, DEFAULT_CONFIG);
    expect(rowOf(list, 12)).toMatchObject({
      stage: 'merged',
      version: { number: 2, count: 2, startedAt: day(3) },
      mergedAt: day(4),
      fix: { rootCause: 'merged late' },
    });
  });

  it('keeps a request merged between a close and the next reopen with the version that close ended', async () => {
    await seed();
    const list = await listBugs(db, allTime, DEFAULT_CONFIG);
    expect(list.groups.open.map((row) => row.number)).toContain(13);
    expect(rowOf(list, 13)).toMatchObject({
      stage: 'open',
      version: { number: 2, count: 2, startedAt: day(4) },
      mergedAt: null,
      fix: null,
      score: null,
      threshold: null,
    });
  });

  it('sorts Open by the start of the current version, longest open first', async () => {
    await seed();
    await db
      .insert(gitHostIssue)
      .values({ ...bug(16, []), createdAt: new Date(day(3, 12)) });
    const list = await listBugs(db, allTime, DEFAULT_CONFIG);
    expect(list.groups.open.map((row) => row.number)).toEqual([15, 16, 13, 14]);
  });

  it('shows a bug fixed in the period and reopened since only by its current version', async () => {
    await seed();
    const week = await listBugs(
      db,
      { ...allTime, period: '7d' },
      DEFAULT_CONFIG,
    );
    expect(rowsOf(week).filter((row) => row.number === 14)).toHaveLength(1);
    expect(week.groups.open.map((row) => row.number)).toContain(14);
    expect(week.groups.fixed.map((row) => row.number)).not.toContain(14);
  });

  it('counts each bug once, by its current version, on /bugs and the overview alike', async () => {
    await seed();
    const list = await listBugs(db, allTime, DEFAULT_CONFIG);
    expect(list.counts).toEqual({ open: 4, fixed: 2, closed: 0 });
    expect((await bugCounts(db, undefined)).counts).toEqual(list.counts);
    expect(rowOf(list, 15)).toMatchObject({
      version: { number: 1, count: 1, startedAt: CREATED },
    });
  });

  it('counts the tokens of the calls inside the current version only, orchestration share included', async () => {
    await seed();
    await seedCalls();
    const list = await listBugs(db, allTime, DEFAULT_CONFIG);
    expect(rowOf(list, 10)).toMatchObject({ tokens: 700, lastAt: day(6) });
    expect(rowOf(list, 13)).toMatchObject({ tokens: 0, costUsd: 0 });
  });
});

describe('the fix of a bug page with versions', () => {
  it('is the fix of the current version, as on the bugs list', async () => {
    await seed();
    const list = await listBugs(db, allTime, DEFAULT_CONFIG);
    for (const number of [10, 11, 12, 13]) {
      const detail = await featureDetail(
        db,
        { project: APP, number },
        allTime,
        {
          config: DEFAULT_CONFIG,
          state: { inactiveAfterMinutes: 30, now: NOW },
        },
      );
      expect(detail?.fix).toEqual(rowOf(list, number)?.fix);
    }
    expect(rowOf(list, 13)?.fix).toBeNull();
    expect(rowOf(list, 11)?.fix).toMatchObject({ rootCause: 'third try' });
  });
});

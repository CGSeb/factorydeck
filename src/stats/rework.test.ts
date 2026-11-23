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
import type { Period } from '../overview/types.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { flowStats } from './flow.ts';

const APP = '/work/app';
const API = '/work/api';
const NOW = new Date('2026-03-18T12:00:00Z');
const CREATED = new Date('2026-03-01T00:00:00Z');

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
    model: 'claude-sonnet-4-5',
    inputTokens: tokens.input ?? 0,
    cacheWriteTokens: tokens.cacheWrite ?? 0,
    cacheReadTokens: tokens.cacheRead ?? 0,
    outputTokens: tokens.output ?? 0,
  };
}

function builder(sessionId: string, issue: number) {
  return {
    sessionId,
    id: `b${String(issue)}`,
    agentType: 'builder',
    description: `Build #${String(issue)}`,
    firstAt: new Date('2026-01-01T00:00:00Z'),
  };
}

function report(at: string, score: number, gatesPassed = true) {
  return { score, threshold: 80, rounds: 1, gatesPassed, at };
}

function issue(number: number, closed = false, project = APP) {
  return {
    project,
    number,
    title: `Issue ${String(number)}`,
    state: closed ? ('closed' as const) : ('open' as const),
    labels: [],
    url: `https://git.example/issues/${String(number)}`,
    createdAt: CREATED,
    updatedAt: CREATED,
  };
}

function pull(
  number: number,
  closes: number,
  state: 'open' | 'closed',
  reports: ReturnType<typeof report>[],
) {
  return {
    project: APP,
    number,
    title: `Request ${String(number)}`,
    state,
    draft: false,
    headBranch: `feat/${String(number)}`,
    url: `https://git.example/pull/${String(number)}`,
    createdAt: CREATED,
    updatedAt: CREATED,
    closes: [closes],
    checks: 'passing' as const,
    reports,
  };
}

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await db.insert(gitHostProject).values(
    [APP, API].map((project) => ({
      project,
      gitHost: 'github',
      syncedFrom: NOW,
      autoMerge: true,
    })),
  );
  await db
    .insert(gitHostIssue)
    .values([
      issue(10),
      issue(11),
      issue(12),
      issue(13, true),
      issue(14),
      issue(1, false, API),
    ]);
  await db
    .insert(gitHostRequest)
    .values([
      pull(110, 10, 'open', [
        report('2026-03-16T00:00:00Z', 50),
        report('2026-03-14T00:00:00Z', 60),
      ]),
      pull(111, 11, 'open', [
        report('2026-03-12T00:00:00Z', 90),
        report('2026-03-14T12:00:00Z', 90, false),
      ]),
      pull(112, 12, 'closed', [report('2026-03-12T00:00:00Z', 70)]),
      pull(122, 12, 'open', [report('2026-03-14T00:00:00Z', 95)]),
      pull(113, 13, 'closed', [report('2026-03-13T00:00:00Z', 40)]),
      pull(114, 14, 'open', [report('2026-03-06T00:00:00Z', 40)]),
    ]);
  await db.insert(session).values([
    { id: 'r1', project: APP, title: 'Queue' },
    { id: 'r2', project: APP, title: 'Other queue' },
    { id: 'r3', project: API, title: 'Api queue' },
  ]);
  await db
    .insert(subAgent)
    .values([
      builder('r1', 10),
      builder('r2', 11),
      builder('r2', 12),
      builder('r2', 13),
      builder('r2', 14),
      builder('r3', 1),
    ]);
  await db
    .insert(apiCall)
    .values([
      call('r1', '2026-03-13T00:00:00Z', { input: 100 }, 'b10'),
      call('r1', '2026-03-14T00:00:00Z', { input: 200 }, 'b10'),
      call('r1', '2026-03-15T00:00:00Z', { output: 400 }, 'b10'),
      call('r1', '2026-03-16T00:00:00Z', { input: 10_000 }),
      call('r2', '2026-03-13T00:00:00Z', { input: 1_000 }, 'b11'),
      call('r2', '2026-03-15T00:00:00Z', { cacheRead: 2_000 }, 'b11'),
      call('r2', '2026-03-13T00:00:00Z', { cacheWrite: 3_000 }, 'b12'),
      call('r2', '2026-03-15T00:00:00Z', { input: 5_000 }, 'b13'),
      call('r2', '2026-03-05T00:00:00Z', { input: 600 }, 'b14'),
      call('r2', '2026-03-07T00:00:00Z', { input: 7_000 }, 'b14'),
      call('r3', '2026-03-15T00:00:00Z', { input: 900 }, 'b1'),
    ]);
});

afterAll(async () => {
  await close();
});

function stats(period: Period, project?: string) {
  return flowStats(
    db,
    { period, timeZone: 'UTC', project, now: NOW },
    DEFAULT_CONFIG,
    () => Promise.resolve(true),
  );
}

describe('tokens on rework', () => {
  it('counts the calls at and after the first refused report, of every request, across dropped work, without orchestration shares', async () => {
    const { current } = await stats('7d', APP);
    expect(current.tokens).toEqual({
      total: 21_700,
      droppedWork: 5_000,
      noWorkItem: 0,
      rework: 200 + 400 + 2_000 + 3_000 + 5_000,
      apiCalls: 8,
    });
  });

  it('counts the rework of the previous period by the calls of that period', async () => {
    const { previous } = await stats('7d', APP);
    expect(previous?.tokens).toEqual({
      total: 7_600,
      droppedWork: 0,
      noWorkItem: 0,
      rework: 7_000,
      apiCalls: 2,
    });
  });

  it('has no rework when the period has no call', async () => {
    const { current } = await stats('today', APP);
    expect(current.tokens).toEqual({
      total: 0,
      droppedWork: 0,
      noWorkItem: 0,
      rework: 0,
      apiCalls: 0,
    });
  });

  it('adds every factory project together, an issue without a refusal adding none', async () => {
    const { current } = await stats('7d');
    expect([current.tokens.total, current.tokens.rework]).toEqual([
      22_600, 10_600,
    ]);
  });
});

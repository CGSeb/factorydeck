import type { Database } from '../db/client.ts';
import {
  apiCall,
  closingLine,
  friction,
  gitHostIssue,
  gitHostProject,
  session,
  subAgent,
} from '../db/schema.ts';

export const APP = '/work/app';
export const API = '/work/api';
export const NOW = new Date('2026-03-18T12:00:00Z');
const OLD = new Date('2026-01-05T09:00:00Z');

let sequence = 0;

interface Tokens {
  input?: number;
  write?: number;
  read?: number;
  output?: number;
}

function threadOf(thread: string): [string, string | null] {
  const [sessionId = '', sub] = thread.split('/');
  return [sessionId, sub ?? null];
}

function call(
  thread: string,
  at: string,
  { input = 0, write = 0, read = 0, output = 0 }: Tokens,
) {
  const [sessionId, sub] = threadOf(thread);
  sequence += 1;
  return {
    sourcePath: `/logs/${sessionId}.jsonl`,
    requestKey: `call-${String(sequence)}`,
    sessionId,
    subAgentId: sub,
    at: new Date(at),
    model: 'claude-sonnet-4-5',
    inputTokens: input,
    cacheWriteTokens: write,
    cacheReadTokens: read,
    outputTokens: output,
  };
}

function rub(thread: string, at: string, kind: string, hash?: string) {
  const [sessionId, sub] = threadOf(thread);
  sequence += 1;
  return {
    sourcePath: `/logs/${sessionId}.jsonl`,
    recordUuid: `f-${String(sequence)}`,
    position: 0,
    sessionId,
    subAgentId: sub,
    at: new Date(at),
    agent: 'claude-code',
    kind,
    tool: kind === 'tool-error' ? 'Bash' : null,
    category:
      kind === 'tool-error'
        ? hash === undefined
          ? 'other'
          : 'command-failed'
        : null,
    program: hash === undefined ? null : 'pnpm',
    exitCode: hash === undefined ? null : 1,
    commandHash: hash ?? null,
    hookCommand: kind === 'stop-blocked' ? 'make check' : null,
    trigger: kind === 'compaction' ? 'auto' : null,
    preTokens: null,
  };
}

function agent(
  sessionId: string,
  id: string,
  description: string,
  agentType = 'general-purpose',
) {
  return {
    sessionId,
    id,
    agentType,
    description,
    firstAt: new Date('2026-03-16T08:00:00Z'),
  };
}

async function seedThreads(db: Database): Promise<void> {
  await db.insert(session).values([
    {
      id: 's-main',
      project: APP,
      title: 'Fix login #7',
      gitBranch: 'main',
    },
    { id: 's-mark', project: APP, title: '', gitBranch: 'main' },
    { id: 's-api', project: API, title: 'API #3', gitBranch: 'main' },
  ]);
  await db
    .insert(subAgent)
    .values([
      agent('s-main', 'b1', 'Build #9'),
      agent('s-main', 'r1', 'Review #7'),
      agent('s-main', 'u1', 'Look around', ''),
      agent('s-api', 'p1', 'Ship #3'),
    ]);
}

async function seedCalls(db: Database): Promise<void> {
  await db.insert(apiCall).values([
    call('s-main', '2026-03-16T09:00:00Z', {
      input: 1_000,
      read: 9_000,
      output: 50_000,
    }),
    call('s-main', '2026-03-16T09:30:00Z', {
      input: 100,
      write: 100,
      read: 100,
    }),
    call('s-main', '2026-03-08T09:00:00Z', { input: 900_000 }),
    call('s-main/b1', '2026-03-16T10:00:00Z', { input: 50_000 }),
    call('s-main/r1', '2026-03-16T10:00:00Z', { read: 20_000 }),
    call('s-main/u1', '2026-03-16T10:00:00Z', { write: 30_000 }),
    call('s-mark', '2026-03-16T09:00:00Z', { input: 40_000 }),
    call('s-mark', '2026-03-16T12:00:00Z', { input: 70_000 }),
    call('s-api', '2026-03-17T09:00:00Z', { input: 5_000 }),
    call('s-api/p1', '2026-03-17T09:30:00Z', { input: 8_000 }),
  ]);
}

async function seedMarkers(db: Database): Promise<void> {
  await db.insert(closingLine).values(
    [
      ['2026-03-16T10:00:00Z', 'Work item: #21 (builder)'],
      ['2026-03-16T14:00:00Z', 'Work item: #22 (reviewer)'],
    ].map(([at, line], index) => ({
      sourcePath: '/logs/s-mark.jsonl',
      recordUuid: `m-${String(index)}`,
      sessionId: 's-mark',
      at: new Date(at ?? ''),
      position: index,
      line: line ?? '',
    })),
  );
}

async function seedRubs(db: Database): Promise<void> {
  await db
    .insert(friction)
    .values([
      rub('s-main', '2026-03-16T09:05:00Z', 'tool-error'),
      rub('s-main', '2026-03-16T09:10:00Z', 'tool-error'),
      rub('s-main', '2026-03-16T09:20:00Z', 'compaction'),
      rub('s-main', '2026-03-08T09:05:00Z', 'tool-error'),
      ...['10:01', '10:02', '10:03'].map((time) =>
        rub('s-main/b1', `2026-03-16T${time}:00Z`, 'tool-error', 'test'),
      ),
      rub('s-main/b1', '2026-03-16T10:05:00Z', 'stop-blocked'),
      rub('s-main/u1', '2026-03-16T10:05:00Z', 'tool-error'),
      rub('s-mark', '2026-03-16T09:30:00Z', 'tool-error'),
      rub('s-mark', '2026-03-16T13:00:00Z', 'compaction'),
      rub('s-api', '2026-03-17T09:05:00Z', 'stop-blocked'),
    ]);
}

async function seedGitHost(db: Database): Promise<void> {
  await db.insert(gitHostProject).values({
    project: APP,
    gitHost: 'github',
    repository: 'example-org/example-app',
    syncedFrom: OLD,
    autoMerge: true,
  });
  await db.insert(gitHostIssue).values({
    project: APP,
    number: 7,
    title: 'Fix the login',
    state: 'open',
    labels: [],
    url: 'https://git.example/app/issues/7',
    createdAt: OLD,
    updatedAt: OLD,
  });
}

export async function seedBreakdown(db: Database): Promise<void> {
  await seedThreads(db);
  await seedCalls(db);
  await seedMarkers(db);
  await seedRubs(db);
  await seedGitHost(db);
}

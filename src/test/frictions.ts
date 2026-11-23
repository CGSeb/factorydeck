import type { Database } from '../db/client.ts';
import {
  apiCall,
  closingLine,
  friction,
  session,
  subAgent,
} from '../db/schema.ts';

export const APP = '/work/app';
export const API = '/work/api';
export const NOW = new Date('2026-03-18T12:00:00Z');
export const LONG_HOOK = `node ~/.agents/hooks/${'check-everything-before-stopping-'.repeat(4)}stop.ts --strict`;

let sequence = 0;

interface Seed {
  at: string;
  session?: string;
  sub?: string;
  kind?: string;
  tool?: string;
  category?: string;
  program?: string | null;
  exitCode?: number;
  hash?: string;
  hook?: string;
  trigger?: string | null;
  pre?: number;
}

const EMPTY = {
  sub: null,
  tool: null,
  category: null,
  program: null,
  exitCode: null,
  hash: null,
  hook: null,
  trigger: null,
  pre: null,
};

function seedFriction(seed: Seed) {
  sequence += 1;
  const kind = seed.kind ?? 'tool-error';
  const sessionId = seed.session ?? 'app-1';
  const fields = {
    ...EMPTY,
    ...(kind === 'tool-error' ? { tool: 'Bash' } : {}),
    ...seed,
  };
  return {
    sourcePath: `/logs/${sessionId}.jsonl`,
    recordUuid: `r-${String(sequence)}`,
    position: 0,
    sessionId,
    subAgentId: fields.sub,
    at: new Date(seed.at),
    agent: 'claude-code',
    kind,
    tool: fields.tool,
    category: fields.category,
    program: fields.program,
    exitCode: fields.exitCode,
    commandHash: fields.hash,
    hookCommand: fields.hook,
    trigger: fields.trigger,
    preTokens: fields.pre,
  };
}

function failed(seed: Omit<Seed, 'category'>): Seed {
  return { tool: 'Bash', category: 'command-failed', ...seed };
}

function calls(sessionId: string, at: string, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    sourcePath: `/logs/${sessionId}.jsonl`,
    requestKey: `${sessionId}-${at}-${String(index)}`,
    sessionId,
    at: new Date(at),
    model: 'claude-sonnet-4-5',
    inputTokens: 1,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    outputTokens: 1,
  }));
}

const FRICTIONS: Seed[] = [
  { at: '2026-03-01T09:00:00Z', category: 'other' },
  { at: '2026-03-16T09:00:00Z', category: 'permission-denied' },
  { at: '2026-03-16T09:05:00Z', category: 'permission-denied' },
  { at: '2026-03-16T09:10:00Z', tool: 'Write', category: 'other' },
  { at: '2026-03-16T09:15:00Z', tool: 'Write', category: 'other' },
  { at: '2026-03-16T09:20:00Z', tool: 'Edit', category: 'tool-misuse' },
  { at: '2026-03-16T09:25:00Z', tool: 'Edit', category: 'hook-blocked' },
  ...[1, 2, 3].map((minute) =>
    failed({
      at: `2026-03-17T08:0${String(minute)}:00Z`,
      sub: 'agent-a',
      program: 'pnpm',
      exitCode: 1,
      hash: 'test',
    }),
  ),
  ...[2, 127].map((exitCode, index) =>
    failed({
      at: `2026-03-17T08:1${String(index)}:00Z`,
      program: 'pnpm',
      exitCode,
      hash: 'lint',
    }),
  ),
  ...[5, 7, 9, 4].map((exitCode, index) =>
    failed({
      at: `2026-03-15T07:0${String(index)}:00Z`,
      session: 'app-2',
      program: 'pnpm',
      exitCode,
      hash: `build-${String(index)}`,
    }),
  ),
  ...['09:00', '11:00', '15:00'].map((time) =>
    failed({
      at: `2026-03-17T${time}:00Z`,
      session: 'app-2',
      program: 'git',
      exitCode: 1,
      hash: 'push',
    }),
  ),
  ...['09:00', '09:30', '09:45'].map((time) =>
    failed({
      at: `2026-03-17T${time}:00Z`,
      session: 'app-2',
      program: 'curl',
      exitCode: 6,
      hash: 'fetch',
    }),
  ),
  failed({ at: '2026-03-17T16:00:00Z', session: 'app-2', program: null }),
  { at: '2026-03-17T10:00:00Z', kind: 'stop-blocked', hook: LONG_HOOK },
  {
    at: '2026-03-17T11:00:00Z',
    session: 'app-2',
    kind: 'stop-blocked',
    hook: LONG_HOOK,
  },
  { at: '2026-03-16T11:00:00Z', kind: 'stop-blocked', hook: 'make check' },
  { at: '2026-03-16T12:00:00Z', kind: 'stop-blocked', hook: 'make check' },
  {
    at: '2026-03-16T10:00:00Z',
    kind: 'compaction',
    trigger: 'auto',
    pre: 100_000,
  },
  {
    at: '2026-03-16T10:01:00Z',
    kind: 'compaction',
    trigger: 'auto',
    pre: 306_000,
  },
  {
    at: '2026-03-16T10:02:00Z',
    kind: 'compaction',
    trigger: 'auto',
    pre: 312_000,
  },
  { at: '2026-03-16T10:03:00Z', kind: 'compaction', trigger: 'auto' },
  {
    at: '2026-03-16T10:04:00Z',
    session: 'app-2',
    kind: 'compaction',
    trigger: 'manual',
  },
  {
    at: '2026-03-16T10:05:00Z',
    session: 'app-2',
    kind: 'compaction',
    trigger: null,
  },
  { at: '2026-03-17T09:00:00Z', session: 'api-1', category: 'other' },
];

export async function seedFrictions(db: Database): Promise<void> {
  await db.insert(session).values([
    {
      id: 'app-1',
      project: APP,
      title: 'Fix login',
      gitBranch: 'feat/7-login',
    },
    { id: 'app-2', project: APP, title: '', gitBranch: 'main' },
    { id: 'api-1', project: API, title: 'API', gitBranch: 'main' },
  ]);
  await db.insert(subAgent).values({
    sessionId: 'app-1',
    id: 'agent-a',
    agentType: 'general-purpose',
    description: 'Build #9',
  });
  await db
    .insert(apiCall)
    .values([
      ...calls('app-1', '2026-03-01T09:00:00Z', 30),
      ...calls('app-1', '2026-03-16T09:00:00Z', 60),
      ...calls('app-2', '2026-03-17T09:00:00Z', 40),
      ...calls('api-1', '2026-03-17T09:00:00Z', 10),
    ]);
  await db.insert(closingLine).values(
    [
      ['2026-03-17T10:00:00Z', 'Work item: #21 (builder)'],
      ['2026-03-17T14:00:00Z', 'Work item: #22 (reviewer)'],
    ].map(([at, line], index) => ({
      sourcePath: '/logs/app-2.jsonl',
      recordUuid: `m-${String(index)}`,
      sessionId: 'app-2',
      at: new Date(at ?? ''),
      position: index,
      line: line ?? '',
    })),
  );
  await db.insert(friction).values(FRICTIONS.map(seedFriction));
}

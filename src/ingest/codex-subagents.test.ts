import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { asc, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { apiCall, friction, session, subAgent } from '../db/schema.ts';
import {
  keyKind,
  compacted,
  execEnd,
  rolloutPath,
  sessionMeta,
  shellCall,
  taskComplete,
  taskStarted,
  turnContext,
  usageRecord,
  userMessage,
} from '../test/codex-logs.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  EVERY_PROJECT_HAS_FACTORY,
  type Line,
  minute,
  sessionsFolder,
  writeLog,
} from '../test/session-logs.ts';
import { ingest, summaryLine } from './ingest.ts';

let db: Database;
let close: () => Promise<void>;
let claude: string;
let codex: string;
let work: string;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
  claude = await sessionsFolder();
  codex = join(await sessionsFolder(), 'sessions');
  work = await sessionsFolder();
});

afterEach(async () => {
  await close();
});

async function run(
  options: { wsl?: boolean; hasFactory?: () => Promise<boolean> } = {},
): Promise<string> {
  return summaryLine(
    await ingest(db, claude, {
      ...EVERY_PROJECT_HAS_FACTORY,
      codexFolder: codex,
      wsl: false,
      ...options,
    }),
  );
}

function rootLines(id: string): Line[] {
  return [
    sessionMeta({ id, cwd: work, branch: 'feat/7-export', at: 0 }),
    turnContext(1, 'gpt-test-1'),
    taskStarted(1),
    userMessage(1),
    usageRecord(2, 'resp_1', { input: 50, cached: 20, output: 5 }),
    shellCall(2, 'call_1', ['pnpm', 'test']),
    execEnd(3, 'call_1', ['pnpm', 'test'], 1),
    usageRecord(3, 'resp_2', { input: 10, output: 2 }),
    taskComplete(4, 'Tests fixed.\nWork item: #7 (worker)'),
  ];
}

async function calls(): Promise<
  { key: string; sub: string | null; input: number }[]
> {
  const rows = await db
    .select()
    .from(apiCall)
    .orderBy(asc(apiCall.at), asc(apiCall.requestKey));
  return rows.map((row) => ({
    key: keyKind(row.requestKey),
    sub: row.subAgentId,
    input: row.inputTokens,
  }));
}

describe('Codex sub-agents', () => {
  function worker(historyStart?: number): Line[] {
    return [
      sessionMeta({
        id: 'sub-1',
        sessionId: 'root-1',
        parent: 'root-1',
        role: 'worker',
        agentPath: '/root/review_worker',
        cwd: work,
        at: 5,
        ...(historyStart === undefined ? {} : { historyStart }),
      }),
      usageRecord(2, 'resp_1', { input: 50, cached: 20, output: 5 }),
      compacted(2),
      turnContext(6, 'gpt-test-mini'),
      usageRecord(7, 'resp_s1', { input: 4, output: 1 }),
    ];
  }

  function nested(): Line[] {
    return [
      sessionMeta({ id: 'sub-2', parent: 'sub-1', role: 'explorer', at: 8 }),
      turnContext(8, 'gpt-test-mini'),
      usageRecord(9, 'resp_s2', { input: 3, output: 1 }),
    ];
  }

  it('stores direct and nested sub-agents under the root, counting a parent response once', async () => {
    await writeLog(rolloutPath(codex, 'root-1'), rootLines('root-1'));
    await writeLog(rolloutPath(codex, 'sub-1'), worker(3));
    await writeLog(rolloutPath(codex, 'sub-2', '06'), nested());
    expect(await run()).toMatch(
      /^Ingested 3 files: 1 sessions, 2 sub-agents, 4 API calls/,
    );
    const agents = await db.select().from(subAgent).orderBy(asc(subAgent.id));
    expect(agents).toEqual([
      expect.objectContaining({
        sessionId: 'root-1',
        id: 'sub-1',
        agentType: 'worker',
        description: '/root/review_worker',
        model: 'gpt-test-mini',
        firstAt: new Date(minute(5)),
        lastAt: new Date(minute(7)),
      }),
      expect.objectContaining({
        sessionId: 'root-1',
        id: 'sub-2',
        agentType: 'explorer',
        description: '',
        model: 'gpt-test-mini',
      }),
    ]);
    expect(await calls()).toEqual([
      { key: 'resp_1', sub: null, input: 30 },
      { key: 'resp_2', sub: null, input: 10 },
      { key: 'resp_s1', sub: 'sub-1', input: 4 },
      { key: 'resp_s2', sub: 'sub-2', input: 3 },
    ]);
    expect(
      await db.select().from(friction).where(eq(friction.kind, 'compaction')),
    ).toEqual([]);
  });

  it('creates the session from a sub-agent read before its root, then completes it', async () => {
    await writeLog(rolloutPath(codex, 'sub-1'), worker());
    await run();
    const [early] = await db.select().from(session);
    expect(early).toMatchObject({
      id: 'root-1',
      agent: 'codex',
      cwd: work,
      cwdFromMain: false,
      project: work,
    });
    await writeLog(rolloutPath(codex, 'root-1'), rootLines('root-1'));
    await run();
    const [late] = await db.select().from(session);
    expect(late).toMatchObject({
      cwdFromMain: true,
      gitBranch: 'feat/7-export',
    });
    expect((await calls()).map((call) => call.key)).toEqual([
      'resp_1',
      'resp_2',
      'resp_s1',
    ]);
  });
});

describe('Codex folder', () => {
  it('reads only rollout files, and skips one without a complete first line', async () => {
    await mkdir(join(codex, '2026'), { recursive: true });
    await writeFile(join(codex, '2026', 'notes.jsonl'), '{}\n');
    await writeFile(join(codex, '2026', 'rollout-empty.jsonl'), '');
    await writeLog(rolloutPath(codex, 'codex-g'), [
      sessionMeta({ id: 'codex-g', cwd: work }),
    ]);
    expect(await run()).toMatch(/^Ingested 1 files: 1 sessions/);
  });
});

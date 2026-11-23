import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { asc } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import {
  apiCall,
  closingLine,
  friction,
  session,
  userPrompt,
} from '../db/schema.ts';
import {
  keyKind,
  execEnd,
  rolloutPath,
  sessionMeta,
  shellCall,
  taskComplete,
  taskStarted,
  tokenCount,
  turnContext,
  usageRecord,
  userItem,
  userMessage,
} from '../test/codex-logs.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  EVERY_PROJECT_HAS_FACTORY,
  type Line,
  appendLog,
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

describe('Codex ingestion', () => {
  it('stores a root rollout found at any depth as a codex session', async () => {
    await writeLog(rolloutPath(codex, 'codex-a'), rootLines('codex-a'));
    expect(await run()).toBe(
      'Ingested 1 files: 1 sessions, 0 sub-agents, 2 API calls, 0 skill launches, 1 frictions, 0 lines skipped, 0 sessions skipped (no factory).',
    );
    const [row] = await db.select().from(session);
    expect(row).toMatchObject({
      id: 'codex-a',
      agent: 'codex',
      project: work,
      cwd: work,
      gitBranch: 'feat/7-export',
      gitBranches: ['feat/7-export'],
      title: '',
      firstAt: new Date(minute(0)),
      lastAt: new Date(minute(4)),
      turnEnded: true,
    });
    expect(await calls()).toEqual([
      { key: 'resp_1', sub: null, input: 30 },
      { key: 'resp_2', sub: null, input: 10 },
    ]);
    expect(await db.select().from(userPrompt)).toHaveLength(1);
    expect((await db.select().from(closingLine)).map((l) => l.line)).toEqual([
      'Work item: #7 (worker)',
    ]);
    expect(await db.select().from(friction)).toEqual([
      expect.objectContaining({
        agent: 'codex',
        kind: 'tool-error',
        category: 'command-failed',
        program: 'pnpm',
        exitCode: 1,
      }),
    ]);
  });

  it('stores an empty branch when the meta has no git, and a turn still open', async () => {
    await writeLog(rolloutPath(codex, 'codex-b'), [
      sessionMeta({ id: 'codex-b', cwd: work }),
      taskStarted(1),
      userItem(1, 'm1'),
      userItem(1, 'm1'),
    ]);
    await run();
    const [row] = await db.select().from(session);
    expect(row).toMatchObject({
      gitBranch: '',
      gitBranches: [],
      turnEnded: false,
    });
    expect(await db.select().from(userPrompt)).toHaveLength(1);
  });

  it('skips a missing Codex folder without error', async () => {
    expect(await run()).toBe('Nothing new.');
  });

  it('skips a session outside any factory project', async () => {
    await writeLog(rolloutPath(codex, 'codex-c'), rootLines('codex-c'));
    expect(await run({ hasFactory: () => Promise.resolve(false) })).toBe(
      'Ingested 0 files: 0 sessions, 0 sub-agents, 0 API calls, 0 skill launches, 0 frictions, 0 lines skipped, 1 sessions skipped (no factory).',
    );
    expect(await db.select().from(session)).toEqual([]);
  });

  it('reads a grown rollout from its offset, leaving an unfinished last line', async () => {
    const path = rolloutPath(codex, 'codex-d');
    await writeLog(
      path,
      [
        sessionMeta({ id: 'codex-d', cwd: work }),
        turnContext(1, 'gpt-test-1'),
        tokenCount(2, { input: 10, output: 1 }, { input: 10, output: 1 }),
        '{"timestamp":"2026-01-05T09:03:00.000Z","type":"event_msg"',
      ],
      { trailingNewline: false },
    );
    await run();
    expect(await calls()).toEqual([
      { key: 'token_count:', sub: null, input: 10 },
    ]);
    await appendFile(
      path,
      `,"payload":{"type":"user_message","message":"x"}}\n`,
    );
    await appendLog(path, [
      tokenCount(4, { input: 10, output: 1 }, { input: 10, output: 1 }),
      tokenCount(5, { input: 30, output: 3 }, { input: 20, output: 2 }),
    ]);
    expect(await run()).toBe(
      'Ingested 1 files: 1 sessions, 0 sub-agents, 1 API calls, 0 skill launches, 0 frictions, 0 lines skipped, 0 sessions skipped (no factory).',
    );
    expect(await db.select().from(userPrompt)).toHaveLength(1);
    await appendLog(path, [
      usageRecord(6, 'resp_6', { input: 7, output: 1 }),
      tokenCount(6, { input: 37, output: 4 }, { input: 7, output: 1 }),
    ]);
    await run();
    expect(await calls()).toEqual([{ key: 'resp_6', sub: null, input: 7 }]);
  });

  it('replaces the rows of a rollout that got shorter', async () => {
    const path = rolloutPath(codex, 'codex-e');
    await writeLog(path, rootLines('codex-e'));
    await run();
    await writeLog(path, [
      sessionMeta({ id: 'codex-e', cwd: work }),
      usageRecord(9, 'resp_9', { input: 1, output: 1 }),
    ]);
    await run();
    expect(await calls()).toEqual([{ key: 'resp_9', sub: null, input: 1 }]);
    expect(await db.select().from(friction)).toEqual([]);
    expect(await db.select().from(closingLine)).toEqual([]);
  });

  it('reads a Windows working directory as its WSL path, joining the Claude Code project', async () => {
    await writeLog(rolloutPath(codex, 'codex-f'), [
      sessionMeta({ id: 'codex-f', cwd: 'Q:\\Dev\\demo-app' }),
    ]);
    await writeLog(join(claude, 'p', 'claude-f.jsonl'), [
      {
        type: 'user',
        uuid: 'u1',
        timestamp: minute(0),
        cwd: '/mnt/q/Dev/demo-app',
        message: { role: 'user', content: 'Hello' },
      },
    ]);
    await run({ wsl: true });
    const rows = await db
      .select({
        id: session.id,
        project: session.project,
        agent: session.agent,
      })
      .from(session)
      .orderBy(asc(session.id));
    expect(rows).toEqual([
      { id: 'claude-f', project: '/mnt/q/Dev/demo-app', agent: 'claude-code' },
      { id: 'codex-f', project: '/mnt/q/Dev/demo-app', agent: 'codex' },
    ]);
  });
});

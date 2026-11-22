import { join } from 'node:path';
import { asc, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import {
  apiCall,
  friction,
  ingestState,
  session,
  skillLaunch,
  sourceFile,
  subAgent,
  userPrompt,
} from '../db/schema.ts';
import { deleteProject } from '../projects/remove.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  type Line,
  EVERY_PROJECT_HAS_FACTORY,
  appendLog,
  assistant,
  minute,
  sessionsFolder,
  userText,
  writeLog,
} from '../test/session-logs.ts';
import { commandHash } from './frictions.ts';
import { ingest, summaryLine } from './ingest.ts';

const HOME = '/home/dev';
const CWD = '/gone/project';

let db: Database;
let close: () => Promise<void>;
let folder: string;
let log: string;
let agentLog: string;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
  folder = await sessionsFolder();
  log = join(folder, 'project', 'session-f.jsonl');
  agentLog = join(folder, 'project', 'session-f', 'subagents', 'agent-w.jsonl');
});

afterEach(async () => {
  await close();
});

async function run(): Promise<string> {
  return summaryLine(
    await ingest(db, folder, { ...EVERY_PROJECT_HAS_FACTORY, home: HOME }),
  );
}

function bashCall(n: number, command: string): Line {
  return assistant(
    { uuid: `a${n}`, at: n, cwd: CWD },
    {
      requestId: `req_${n}`,
      stopReason: 'tool_use',
      content: [
        { type: 'tool_use', id: `t${n}`, name: 'Bash', input: { command } },
      ],
    },
  );
}

function failed(n: number, text: string, sidechain = false): Line {
  return {
    ...userText({ uuid: `r${n}`, at: n, cwd: CWD, sidechain }, ''),
    message: {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: `t${n}`,
          is_error: true,
          content: text,
        },
      ],
    },
  };
}

function compaction(n: number): Line {
  return {
    type: 'system',
    subtype: 'compact_boundary',
    uuid: `c${n}`,
    timestamp: minute(n),
    compactMetadata: { trigger: 'auto', preTokens: 150000, postTokens: 9000 },
  };
}

function stopBlocked(n: number): Line {
  return {
    type: 'system',
    subtype: 'stop_hook_summary',
    uuid: `s${n}`,
    timestamp: minute(n),
    hookErrors: [`[${HOME}/hooks/check.sh]: checks fail`, 'checks fail'],
  };
}

const FIRST: Line[] = [
  userText({ uuid: 'u0', at: 0, cwd: CWD }, 'Build it'),
  bashCall(1, 'cd app && pnpm test'),
  failed(1, 'Exit code 1\nFAIL'),
  compaction(2),
];

async function frictions(): Promise<(typeof friction.$inferSelect)[]> {
  return db
    .select()
    .from(friction)
    .orderBy(
      asc(friction.at),
      asc(friction.recordUuid),
      asc(friction.position),
    );
}

function summarize(
  rows: readonly (typeof friction.$inferSelect)[],
): [string, string | null, string | null][] {
  return rows.map((row) => [row.recordUuid, row.kind, row.subAgentId]);
}

describe('friction ingestion', () => {
  it('stores each friction with its session, sub-agent, time and agent', async () => {
    await writeLog(log, [...FIRST, stopBlocked(3)]);
    await writeLog(agentLog, [
      bashCall(4, 'pnpm lint'),
      failed(4, 'Exit code 2', true),
    ]);
    expect(await run()).toBe(
      'Ingested 2 files: 1 sessions, 1 sub-agents, 2 API calls, 0 skill launches, 5 frictions, 0 lines skipped, 0 sessions skipped (no factory).',
    );
    const rows = await frictions();
    expect(rows).toEqual([
      expect.objectContaining({
        sessionId: 'session-f',
        subAgentId: null,
        recordUuid: 'r1',
        at: new Date(minute(1)),
        agent: 'claude-code',
        kind: 'tool-error',
        tool: 'Bash',
        category: 'command-failed',
        program: 'pnpm',
        exitCode: 1,
        commandHash: commandHash('cd app && pnpm test'),
      }),
      expect.objectContaining({
        recordUuid: 'c2',
        kind: 'compaction',
        trigger: 'auto',
        preTokens: 150000,
        postTokens: 9000,
      }),
      expect.objectContaining({
        recordUuid: 's3',
        position: 0,
        kind: 'stop-blocked',
        hookCommand: '~/hooks/check.sh',
      }),
      expect.objectContaining({
        recordUuid: 's3',
        position: 1,
        kind: 'stop-blocked',
        hookCommand: '',
      }),
      expect.objectContaining({
        sessionId: 'session-f',
        subAgentId: 'w',
        kind: 'tool-error',
        program: 'pnpm',
        exitCode: 2,
      }),
    ]);
  });

  it('adds only the new frictions of a grown file, naming calls read before', async () => {
    await writeLog(log, [...FIRST, bashCall(3, 'pnpm build')]);
    await run();
    await appendLog(log, [failed(3, 'Exit code 4'), stopBlocked(4)]);
    expect(await run()).toBe(
      'Ingested 1 files: 1 sessions, 0 sub-agents, 0 API calls, 0 skill launches, 3 frictions, 0 lines skipped, 0 sessions skipped (no factory).',
    );
    const rows = await frictions();
    expect(summarize(rows)).toEqual([
      ['r1', 'tool-error', null],
      ['c2', 'compaction', null],
      ['r3', 'tool-error', null],
      ['s4', 'stop-blocked', null],
      ['s4', 'stop-blocked', null],
    ]);
    expect(rows[2]).toMatchObject({ tool: 'Bash', program: 'pnpm' });
  });

  it('replaces the frictions of a replaced, shorter file', async () => {
    await writeLog(log, [...FIRST, stopBlocked(3)]);
    await run();
    await writeLog(log, [compaction(9)]);
    await run();
    expect(summarize(await frictions())).toEqual([['c9', 'compaction', null]]);
  });

  it('reads the files already ingested once more for frictions only', async () => {
    await writeLog(log, FIRST);
    await writeLog(agentLog, [
      bashCall(4, 'pnpm lint'),
      failed(4, 'Exit code 2', true),
    ]);
    await run();
    await db.delete(friction);
    await db
      .update(ingestState)
      .set({ frictionsReadDone: false })
      .where(eq(ingestState.id, 'ingestion'));
    const before = await otherRows();
    expect(await run()).toBe(
      'Ingested 0 files: 0 sessions, 0 sub-agents, 0 API calls, 0 skill launches, 3 frictions, 0 lines skipped, 0 sessions skipped (no factory).',
    );
    expect(summarize(await frictions())).toEqual([
      ['r1', 'tool-error', null],
      ['c2', 'compaction', null],
      ['r4', 'tool-error', 'w'],
    ]);
    expect(await otherRows()).toEqual(before);
    expect(await run()).toBe('Nothing new.');
    expect(await frictions()).toHaveLength(3);
  });

  it('stores nothing twice when a file grew before its one-time read', async () => {
    await writeLog(log, FIRST);
    await run();
    await db
      .update(ingestState)
      .set({ frictionsReadDone: false })
      .where(eq(ingestState.id, 'ingestion'));
    await appendLog(log, [stopBlocked(3)]);
    expect(await run()).toContain('2 frictions');
    expect(summarize(await frictions())).toEqual([
      ['r1', 'tool-error', null],
      ['c2', 'compaction', null],
      ['s3', 'stop-blocked', null],
      ['s3', 'stop-blocked', null],
    ]);
  });

  it('deletes frictions with their session', async () => {
    await writeLog(log, FIRST);
    await writeLog(agentLog, [bashCall(4, 'x'), failed(4, 'Exit code 2')]);
    await run();
    expect(await frictions()).toHaveLength(3);
    await db.delete(session).where(eq(session.id, 'session-f'));
    expect(await frictions()).toEqual([]);
  });

  it('deletes frictions with their project', async () => {
    await writeLog(log, FIRST);
    await writeLog(agentLog, [bashCall(4, 'x'), failed(4, 'Exit code 2')]);
    await run();
    const [row] = await db.select({ project: session.project }).from(session);
    expect(
      await deleteProject(db, row?.project ?? '', () => Promise.resolve(false)),
    ).toBe('deleted');
    expect(await frictions()).toEqual([]);
  });
});

async function otherRows(): Promise<unknown[]> {
  return Promise.all([
    db.select().from(session),
    db.select().from(subAgent),
    db.select().from(apiCall).orderBy(asc(apiCall.id)),
    db.select().from(skillLaunch),
    db.select().from(userPrompt),
    db
      .select({
        path: sourceFile.path,
        size: sourceFile.sizeBytes,
        offset: sourceFile.readOffset,
        at: sourceFile.ingestedAt,
      })
      .from(sourceFile)
      .orderBy(asc(sourceFile.path)),
  ]);
}

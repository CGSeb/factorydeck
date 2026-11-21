import { chmod, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { asc } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import {
  apiCall,
  session,
  sourceFile,
  subAgent,
  userPrompt,
} from '../db/schema.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  type Line,
  appendLog,
  assistant,
  sessionsFolder,
  userText,
  writeLog,
} from '../test/session-logs.ts';
import { ingest, summaryLine } from './ingest.ts';

let db: Database;
let close: () => Promise<void>;
let log: string;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
  log = join(await sessionsFolder(), 'project', 'session-b.jsonl');
});

afterEach(async () => {
  await close();
});

function turn(n: number): Line[] {
  const ctx = { uuid: `u${n}`, at: n, cwd: '/gone/project' };
  return [
    userText(ctx, `Prompt ${n}`),
    assistant({ ...ctx, uuid: `a${n}` }, { requestId: `req_${n}` }),
  ];
}

async function run(): Promise<string> {
  return summaryLine(await ingest(db, join(log, '..', '..')));
}

async function requestKeys(): Promise<string[]> {
  const rows = await db.select().from(apiCall).orderBy(asc(apiCall.requestKey));
  return rows.map((row) => row.requestKey);
}

describe('incremental ingestion', () => {
  it('reads nothing on a second run with no file changed', async () => {
    await writeLog(log, turn(1));
    expect(await run()).toBe(
      'Ingested 1 files: 1 sessions, 0 sub-agents, 1 API calls, 0 skill launches, 0 lines skipped.',
    );
    await chmod(log, 0o000);
    try {
      expect(await run()).toBe('Nothing new.');
    } finally {
      await chmod(log, 0o600);
    }
  });

  it('reads a grown file from its stored offset only', async () => {
    await writeLog(log, turn(1));
    await run();
    const [first] = await db.select().from(sourceFile);
    expect(first?.readOffset).toBe((await stat(log)).size);
    await appendLog(log, turn(2));
    expect(await run()).toBe(
      'Ingested 1 files: 1 sessions, 0 sub-agents, 1 API calls, 0 skill launches, 0 lines skipped.',
    );
    expect(await requestKeys()).toEqual(['req_1', 'req_2']);
    expect(await db.select().from(userPrompt)).toHaveLength(2);
  });

  it('reads a replaced shorter file again, replacing its rows', async () => {
    await writeLog(log, [...turn(1), ...turn(2), ...turn(3)]);
    await run();
    await writeLog(log, turn(7));
    await run();
    expect(await requestKeys()).toEqual(['req_7']);
    const [row] = await db.select().from(session);
    expect(row?.firstAt).toEqual(row?.lastAt);
    expect(await db.select().from(userPrompt)).toHaveLength(1);
  });

  it('leaves an unfinished last line for the next run', async () => {
    const [prompt, call] = turn(1);
    const callLine = JSON.stringify(call);
    await writeLog(log, [prompt ?? '', callLine.slice(0, 20)], {
      trailingNewline: false,
    });
    await run();
    expect(await requestKeys()).toEqual([]);
    const [stored] = await db.select().from(sourceFile);
    expect(stored?.readOffset).toBe(
      Buffer.byteLength(`${JSON.stringify(prompt)}\n`),
    );

    await writeLog(log, [prompt ?? '', callLine]);
    expect(await run()).toBe(
      'Ingested 1 files: 1 sessions, 0 sub-agents, 1 API calls, 0 skill launches, 0 lines skipped.',
    );
    expect(await requestKeys()).toEqual(['req_1']);
    expect(await db.select().from(userPrompt)).toHaveLength(1);
  });

  it('skips and counts malformed lines and unknown record types', async () => {
    await writeLog(log, [
      ...turn(1),
      '{oops',
      { type: 'from-the-future' },
      ...turn(2),
    ]);
    expect(await run()).toMatch(
      /2 API calls, 0 skill launches, 2 lines skipped\.$/,
    );
  });

  it('stores a request repeated in the same file once, across runs too', async () => {
    const [, call] = turn(1);
    await writeLog(log, turn(1));
    await run();
    await appendLog(log, [call ?? '']);
    expect(await run()).toMatch(/ 0 API calls/);
    expect(await requestKeys()).toEqual(['req_1']);
  });

  it('carries the turn state and slash skills across runs', async () => {
    const ctx = (n: number) => ({
      uuid: `s${n}`,
      at: n,
      cwd: '/gone',
      promptId: 'p9',
    });
    await writeLog(log, [
      userText(ctx(0), '<command-name>/ship</command-name>'),
      assistant(ctx(1), { requestId: 'r1', stopReason: 'tool_use' }),
    ]);
    await run();
    expect((await db.select().from(session))[0]?.turnEnded).toBe(false);
    await appendLog(log, [
      userText(ctx(2), '', {
        isMeta: true,
        message: {
          role: 'user',
          content: [
            { type: 'text', text: 'Base directory for this skill: /x' },
          ],
        },
      }),
      assistant(ctx(3), { requestId: 'r2', stopReason: 'end_turn' }),
    ]);
    expect(await run()).toMatch(/ 1 skill launches/);
    expect((await db.select().from(session))[0]?.turnEnded).toBe(true);
  });

  it('skips files and folders it cannot read, and reads them once it can', async () => {
    const root = join(log, '..', '..');
    const blocked = join(root, 'other', 'session-d.jsonl');
    const agents = join(root, 'project', 'session-b', 'subagents');
    const lockedFolder = join(root, 'locked');
    await writeLog(log, turn(1));
    await writeLog(blocked, turn(2));
    await writeLog(join(agents, 'agent-x.jsonl'), turn(3));
    await writeLog(join(agents, 'agent-x.meta.json'), [
      { agentType: 'helper' },
    ]);
    await writeLog(join(lockedFolder, 'session-e.jsonl'), turn(4));
    const unreadable = [blocked, join(agents, 'agent-x.meta.json')];
    await Promise.all(unreadable.map((path) => chmod(path, 0o000)));
    await chmod(lockedFolder, 0o000);
    try {
      expect(await run()).toBe(
        'Ingested 2 files: 1 sessions, 1 sub-agents, 2 API calls, 0 skill launches, 0 lines skipped.',
      );
    } finally {
      await Promise.all(unreadable.map((path) => chmod(path, 0o600)));
      await chmod(lockedFolder, 0o700);
    }
    expect(await run()).toBe(
      'Ingested 3 files: 3 sessions, 1 sub-agents, 2 API calls, 0 skill launches, 0 lines skipped.',
    );
    expect(await requestKeys()).toEqual(['req_1', 'req_2', 'req_3', 'req_4']);
    expect((await db.select().from(subAgent))[0]?.agentType).toBe('helper');
  });
});

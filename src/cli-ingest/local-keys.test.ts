import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { asc, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import {
  account,
  apiCall,
  closingLine,
  ingestState,
  session,
  skillLaunch,
  subAgent,
  userPrompt,
} from '../db/schema.ts';
import { ingest } from '../ingest/ingest.ts';
import { apiCall as call, mainThread, minutes } from '../test/cli-batch.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  EVERY_PROJECT_HAS_FACTORY,
  assistant,
  minute,
  sessionsFolder,
  userText,
  writeLog,
} from '../test/session-logs.ts';
import { checkBatch } from './batch-schema.ts';
import { type Sender, storeBatch } from './store-batch.ts';

let db: Database;
let close: () => Promise<void>;
let folder: string;
const SENDER: Sender = { accountId: 0, machine: 'laptop' };

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
  folder = await sessionsFolder();
});

afterEach(async () => {
  await close();
});

async function writeSession(): Promise<void> {
  const ctx = { uuid: 'u1', at: 1, cwd: '/gone/shop' };
  await writeLog(join(folder, 'shop', 'session-b.jsonl'), [
    userText(ctx, 'Build the cart'),
    assistant({ ...ctx, uuid: 'a1' }, { requestId: 'req_1' }),
  ]);
  await writeLog(
    join(folder, 'shop', 'session-b', 'subagents', 'agent-x1.jsonl'),
    [
      assistant(
        { uuid: 'a2', at: 2, cwd: '/gone/shop', sidechain: true },
        { requestId: 'req_2' },
      ),
    ],
  );
}

async function readLocally() {
  return ingest(db, folder, EVERY_PROJECT_HAS_FACTORY);
}

async function send(threads: unknown[]) {
  const checked = checkBatch({ parserVersion: 1, threads });
  if (checked.status !== 'ok') throw new Error(JSON.stringify(checked));
  const [row] = await db
    .insert(account)
    .values({
      email: 'ada@example.test',
      name: 'Ada',
      passwordHash: 'x',
      role: 'dev',
      createdAt: new Date(minutes(0)),
    })
    .onConflictDoUpdate({ target: account.email, set: { name: 'Ada' } })
    .returning({ id: account.id });
  return storeBatch(db, checked.batch, {
    ...SENDER,
    accountId: row?.id ?? 0,
  });
}

function sentSession() {
  return mainThread('session-b', {
    calls: [call('req_1', minute(1))],
    firstAt: minute(1),
  });
}

describe('file keys', () => {
  it('stores the records of the local ingestion under their file keys', async () => {
    await writeSession();
    await readLocally();
    const calls = await db
      .select()
      .from(apiCall)
      .orderBy(asc(apiCall.requestKey));
    expect(calls.map((row) => row.sourcePath)).toEqual([
      'claude-code/session-b/main',
      'claude-code/session-b/x1',
    ]);
    const prompts = await db.select().from(userPrompt);
    expect(prompts.map((row) => row.sourcePath)).toEqual([
      'claude-code/session-b/main',
    ]);
  });

  it('counts once a session read locally and sent by a CLI', async () => {
    await writeSession();
    await readLocally();
    expect(await send([sentSession()])).toMatchObject({ apiCalls: 0 });
    expect(await db.select().from(apiCall)).toHaveLength(2);
    expect(await db.select().from(session)).toHaveLength(1);
  });

  it('counts once a session sent by a CLI, then read locally', async () => {
    expect(await send([sentSession()])).toMatchObject({ apiCalls: 1 });
    await writeSession();
    await readLocally();
    const calls = await db.select().from(apiCall);
    expect(calls.filter((row) => row.requestKey === 'req_1')).toHaveLength(1);
    const [row] = await db.select().from(session);
    expect(row?.sentByMachine).toBe('laptop');
  });

  it('keeps the sessions sent by a CLI through the first local cleanup', async () => {
    await db.delete(ingestState);
    await send([mainThread('s-cli', { calls: [call('k1', minutes(1))] })]);
    await readLocally();
    expect((await db.select().from(session)).map((row) => row.id)).toEqual([
      's-cli',
    ]);
  });
});

describe('the source path migration', () => {
  it('rewrites the stored source paths to file keys, keeping one record per key', async () => {
    await db.insert(session).values([
      { id: 's1', agent: 'claude-code' },
      { id: 'c1', agent: 'codex' },
    ]);
    await db.insert(subAgent).values([
      { sessionId: 's1', id: 'x1' },
      { sessionId: 'c1', id: 'sub' },
    ]);
    const at = new Date(minutes(0));
    const tokens = {
      model: 'm',
      inputTokens: 1,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
      outputTokens: 1,
    };
    await db.insert(apiCall).values([
      {
        ...tokens,
        sourcePath: '/logs/p/s1.jsonl',
        requestKey: 'r1',
        sessionId: 's1',
        subAgentId: null,
        at,
      },
      {
        ...tokens,
        sourcePath: '/old/p/s1.jsonl',
        requestKey: 'r1',
        sessionId: 's1',
        subAgentId: null,
        at,
      },
      {
        ...tokens,
        sourcePath: '/logs/p/s1/subagents/agent-x1.jsonl',
        requestKey: 'r1',
        sessionId: 's1',
        subAgentId: 'x1',
        at,
      },
      {
        ...tokens,
        sourcePath: '/codex/rollout-a.jsonl',
        requestKey: 'resp',
        sessionId: 'c1',
        subAgentId: null,
        at,
      },
      {
        ...tokens,
        sourcePath: '/codex/rollout-b.jsonl',
        requestKey: 'resp2',
        sessionId: 'c1',
        subAgentId: 'sub',
        at,
      },
    ]);
    await db.insert(skillLaunch).values({
      sourcePath: '/logs/p/s1/subagents/agent-x1.jsonl',
      recordUuid: 'u',
      sessionId: 's1',
      subAgentId: 'x1',
      at,
      skill: 'write-spec',
    });
    await db.insert(userPrompt).values({
      sourcePath: '/codex/rollout-a.jsonl',
      recordUuid: 'u',
      sessionId: 'c1',
      at,
    });
    await db.insert(closingLine).values({
      sourcePath: '/logs/p/s1.jsonl',
      recordUuid: 'u',
      sessionId: 's1',
      at,
      position: 0,
      line: 'Done.',
    });
    const migration = await readFile(
      join(
        import.meta.dirname,
        '..',
        '..',
        'drizzle',
        '20261128110647_records_by_file_key',
        'migration.sql',
      ),
      'utf8',
    );
    for (const statement of migration.split('--> statement-breakpoint')) {
      await db.execute(sql.raw(statement));
    }
    const calls = await db
      .select({ path: apiCall.sourcePath, key: apiCall.requestKey })
      .from(apiCall)
      .orderBy(apiCall.sourcePath, apiCall.requestKey);
    expect(calls).toEqual([
      { path: 'claude-code/s1/main', key: 'r1' },
      { path: 'claude-code/s1/x1', key: 'r1' },
      { path: 'codex/c1/main', key: 'resp' },
      { path: 'codex/c1/sub', key: 'resp2' },
    ]);
    expect(
      (await db.select().from(skillLaunch)).map((row) => row.sourcePath),
    ).toEqual(['claude-code/s1/x1']);
    expect(
      (await db.select().from(userPrompt)).map((row) => row.sourcePath),
    ).toEqual(['codex/c1/main']);
    expect(
      (await db.select().from(closingLine)).map((row) => row.sourcePath),
    ).toEqual(['claude-code/s1/main']);
  });
});

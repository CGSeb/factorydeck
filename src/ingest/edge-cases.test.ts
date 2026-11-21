import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { apiCall, session, userPrompt } from '../db/schema.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  assistant,
  sessionsFolder,
  userText,
  writeLog,
} from '../test/session-logs.ts';
import { ingest, summaryLine } from './ingest.ts';

let db: Database;
let close: () => Promise<void>;
let folder: string;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
  folder = await sessionsFolder();
});

afterEach(async () => {
  await close();
});

describe('ingest edge cases', () => {
  it('counts user and assistant records without a valid timestamp as skipped', async () => {
    const timeless = {
      ...assistant({ uuid: 'a1', at: 0 }, { requestId: 'r1' }),
      timestamp: 'not a date',
    };
    const untimed = { ...userText({ uuid: 'u1', at: 0 }, 'Hi') };
    delete untimed['timestamp'];
    await writeLog(join(folder, 'p', 'session-f.jsonl'), [
      timeless,
      untimed,
      assistant({ uuid: 'a2', at: 1 }, { requestId: 'r2' }),
    ]);
    expect(summaryLine(await ingest(db, folder))).toBe(
      'Ingested 1 files: 1 sessions, 0 sub-agents, 1 API calls, 0 skill launches, 2 lines skipped.',
    );
    expect(
      (await db.select().from(apiCall)).map((call) => call.requestKey),
    ).toEqual(['r2']);
  });

  it('takes the working directory from sub-agent logs when the main log has none', async () => {
    const agents = join(folder, 'p', 'session-g', 'subagents');
    await writeLog(join(agents, 'agent-z.jsonl'), [
      assistant(
        { uuid: 'z1', at: 0, cwd: '/gone/tool', sidechain: true },
        { requestId: 'rz' },
      ),
    ]);
    await ingest(db, folder);
    const [row] = await db.select().from(session);
    expect(row).toMatchObject({
      id: 'session-g',
      cwd: '/gone/tool',
      project: '/gone/tool',
    });
  });

  it('stores a prompt of images alone as a prompt marker', async () => {
    const image = { type: 'image', source: { type: 'base64', data: 'AA==' } };
    await writeLog(join(folder, 'p', 'session-h.jsonl'), [
      userText({ uuid: 'u1', at: 0, cwd: '/gone/app' }, '', {
        message: { role: 'user', content: [image] },
      }),
    ]);
    await ingest(db, folder);
    const prompts = await db.select().from(userPrompt);
    expect(prompts.map((prompt) => prompt.recordUuid)).toEqual(['u1']);
  });
});

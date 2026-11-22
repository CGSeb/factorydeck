import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { apiCall, session, userPrompt } from '../db/schema.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  appendLog,
  assistant,
  sessionsFolder,
  userText,
  writeLog,
  EVERY_PROJECT_HAS_FACTORY,
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
      assistant({ uuid: 'a2', at: 1, cwd: '/gone/p' }, { requestId: 'r2' }),
    ]);
    expect(
      summaryLine(await ingest(db, folder, EVERY_PROJECT_HAS_FACTORY)),
    ).toBe(
      'Ingested 1 files: 1 sessions, 0 sub-agents, 1 API calls, 0 skill launches, 0 frictions, 2 lines skipped, 0 sessions skipped (no factory).',
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
    await ingest(db, folder, EVERY_PROJECT_HAS_FACTORY);
    const [row] = await db.select().from(session);
    expect(row).toMatchObject({
      id: 'session-g',
      cwd: '/gone/tool',
      project: '/gone/tool',
    });
  });

  it('takes the working directory and branch of the sub-agent that started first', async () => {
    const main = join(folder, 'p', 'session-k.jsonl');
    const agents = join(folder, 'p', 'session-k', 'subagents');
    await writeLog(main, [userText({ uuid: 'u1', at: 0 }, 'Hi')]);
    await writeLog(join(agents, 'agent-a.jsonl'), [
      assistant(
        {
          uuid: 'a1',
          at: 5,
          cwd: '/gone/later',
          gitBranch: 'feat/later',
          sidechain: true,
        },
        { requestId: 'ra' },
      ),
    ]);
    await writeLog(join(agents, 'agent-b.jsonl'), [
      assistant(
        {
          uuid: 'b1',
          at: 2,
          cwd: '/gone/first',
          gitBranch: 'feat/one',
          sidechain: true,
        },
        { requestId: 'rb1' },
      ),
      assistant(
        {
          uuid: 'b2',
          at: 3,
          cwd: '/gone/first',
          gitBranch: 'feat/two',
          sidechain: true,
        },
        { requestId: 'rb2' },
      ),
      assistant({ uuid: 'b3', at: 4, sidechain: true }, { requestId: 'rb3' }),
    ]);
    await ingest(db, folder, EVERY_PROJECT_HAS_FACTORY);
    expect((await db.select().from(session))[0]).toMatchObject({
      cwd: '/gone/first',
      cwdFromMain: false,
      gitBranch: 'feat/two',
      gitBranches: ['feat/two'],
      project: '/gone/first',
    });
    await appendLog(join(agents, 'agent-b.jsonl'), [
      assistant(
        {
          uuid: 'b4',
          at: 6,
          cwd: '/gone/first',
          gitBranch: 'feat/three',
          sidechain: true,
        },
        { requestId: 'rb4' },
      ),
    ]);
    await ingest(db, folder, EVERY_PROJECT_HAS_FACTORY);
    expect((await db.select().from(session))[0]).toMatchObject({
      cwd: '/gone/first',
      gitBranch: 'feat/three',
      gitBranches: ['feat/three'],
    });
  });

  it('stores a prompt of images alone as a prompt marker', async () => {
    const image = { type: 'image', source: { type: 'base64', data: 'AA==' } };
    await writeLog(join(folder, 'p', 'session-h.jsonl'), [
      userText({ uuid: 'u1', at: 0, cwd: '/gone/app' }, '', {
        message: { role: 'user', content: [image] },
      }),
    ]);
    await ingest(db, folder, EVERY_PROJECT_HAS_FACTORY);
    const prompts = await db.select().from(userPrompt);
    expect(prompts.map((prompt) => prompt.recordUuid)).toEqual(['u1']);
  });

  it('lets a working directory found later in the main log win over a sub-agent one', async () => {
    const main = join(folder, 'p', 'session-i.jsonl');
    const agent = join(folder, 'p', 'session-i', 'subagents', 'agent-y.jsonl');
    await writeLog(main, [userText({ uuid: 'u1', at: 0 }, 'Hi')]);
    await writeLog(agent, [
      assistant(
        { uuid: 'y1', at: 1, cwd: '/gone/agent', sidechain: true },
        { requestId: 'ry' },
      ),
    ]);
    await ingest(db, folder, EVERY_PROJECT_HAS_FACTORY);
    expect((await db.select().from(session))[0]).toMatchObject({
      cwd: '/gone/agent',
      project: '/gone/agent',
    });
    await appendLog(main, [
      assistant({ uuid: 'a2', at: 2, cwd: '/gone/main' }, { requestId: 'r2' }),
    ]);
    await ingest(db, folder, EVERY_PROJECT_HAS_FACTORY);
    expect((await db.select().from(session))[0]).toMatchObject({
      cwd: '/gone/main',
      cwdFromMain: true,
      project: '/gone/main',
    });
  });

  it('keeps the sub-agent working directory when a main log without one is read again', async () => {
    const main = join(folder, 'p', 'session-j.jsonl');
    const agent = join(folder, 'p', 'session-j', 'subagents', 'agent-w.jsonl');
    await writeLog(main, [
      userText({ uuid: 'u1', at: 0 }, 'First'),
      userText({ uuid: 'u2', at: 1 }, 'Second'),
    ]);
    await writeLog(agent, [
      assistant(
        { uuid: 'w1', at: 1, cwd: '/gone/helper', sidechain: true },
        { requestId: 'rw' },
      ),
    ]);
    await ingest(db, folder, EVERY_PROJECT_HAS_FACTORY);
    await writeLog(main, [userText({ uuid: 'u3', at: 2 }, 'Hi')]);
    expect(
      summaryLine(await ingest(db, folder, EVERY_PROJECT_HAS_FACTORY)),
    ).toMatch(/^Ingested 1 files/);
    expect((await db.select().from(session))[0]).toMatchObject({
      cwd: '/gone/helper',
      project: '/gone/helper',
    });
  });
});

import { join } from 'node:path';
import { asc } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { apiCall, ingestState, session } from '../db/schema.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  EVERY_PROJECT_HAS_FACTORY,
  appendLog,
  assistant,
  sessionsFolder,
  userText,
  writeLog,
} from '../test/session-logs.ts';
import { ingest } from './ingest.ts';

let db: Database;
let close: () => Promise<void>;
let folder: string;
let log: string;
const cwd = '/gone/app';

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
  folder = await sessionsFolder();
  log = join(folder, 'p', 'session-b.jsonl');
});

afterEach(async () => {
  await close();
});

function on(n: number, gitBranch: string) {
  return { uuid: `b${String(n)}`, at: n, cwd, gitBranch };
}

describe('session branches', () => {
  it('keeps each branch of the main thread once, in the order it first appeared', async () => {
    await writeLog(log, [
      userText(on(0, 'main'), 'Start'),
      userText(on(1, 'docs/a'), 'Spec a'),
      userText(on(2, 'main'), 'Back'),
    ]);
    await ingest(db, folder, EVERY_PROJECT_HAS_FACTORY);
    await appendLog(log, [
      userText(on(3, 'docs/a'), 'Again'),
      userText(on(4, 'docs/b'), 'Spec b'),
      userText(on(5, ''), 'Detached'),
      userText(on(6, 'main'), 'Done'),
    ]);
    await ingest(db, folder, EVERY_PROJECT_HAS_FACTORY);
    expect((await db.select().from(session))[0]).toMatchObject({
      gitBranch: 'main',
      gitBranches: ['main', 'docs/a', 'docs/b'],
    });
  });

  it('reads the main logs again once to fill the branches of sessions stored before them', async () => {
    await writeLog(log, [
      userText(on(0, 'main'), 'Start'),
      assistant(on(1, 'feat/x'), {
        requestId: 'req_1',
        stopReason: 'end_turn',
      }),
    ]);
    await ingest(db, folder, EVERY_PROJECT_HAS_FACTORY);
    const calls = await db.select().from(apiCall).orderBy(asc(apiCall.at));
    await db.update(session).set({ gitBranches: [] });
    await db.update(ingestState).set({ branchesReadDone: false });
    await ingest(db, folder, EVERY_PROJECT_HAS_FACTORY);
    expect((await db.select().from(session))[0]).toMatchObject({
      gitBranch: 'feat/x',
      gitBranches: ['main', 'feat/x'],
      turnEnded: true,
    });
    expect(await db.select().from(apiCall).orderBy(asc(apiCall.at))).toEqual(
      calls,
    );
    await db.update(session).set({ gitBranches: [] });
    await appendLog(log, [userText(on(2, 'feat/y'), 'More')]);
    await ingest(db, folder, EVERY_PROJECT_HAS_FACTORY);
    expect((await db.select().from(session))[0]?.gitBranches).toEqual([
      'main',
      'feat/x',
      'feat/y',
    ]);
  });
});

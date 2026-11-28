import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { apiCall, sourceFile } from '../db/schema.ts';
import {
  rolloutPath,
  sessionMeta,
  tokenCount,
  usageRecord,
} from '../test/codex-logs.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  EVERY_PROJECT_HAS_FACTORY,
  appendLog,
  sessionsFolder,
  writeLog,
} from '../test/session-logs.ts';
import { ingest } from './ingest.ts';

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
});

afterAll(async () => {
  await close();
});

describe('a log stored by the previous reader', () => {
  it('replaces the token-count calls of a rollout that switched to usage records', async () => {
    const claude = await sessionsFolder();
    const codex = await sessionsFolder();
    const work = await sessionsFolder();
    const path = rolloutPath(codex, 'codex-1');
    const run = () =>
      ingest(db, claude, {
        ...EVERY_PROJECT_HAS_FACTORY,
        codexFolder: codex,
        wsl: false,
      });
    await writeLog(path, [
      sessionMeta({ id: 'codex-1', cwd: work }),
      tokenCount(1, { input: 10, output: 1 }, { input: 10, output: 1 }),
    ]);
    await run();
    await db.update(sourceFile).set({
      readerState: {
        lines: 2,
        model: '',
        usageRecords: false,
        lastTotal: null,
        sessionId: 'codex-1',
      },
    });
    await appendLog(path, [usageRecord(2, 'resp_1', { input: 4, output: 1 })]);
    await run();
    const calls = await db.select().from(apiCall);
    expect(calls.map((call) => call.requestKey)).toEqual(['resp_1']);
  });
});

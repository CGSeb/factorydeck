import { join } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../db/client.ts';
import { apiCall } from '../db/schema.ts';
import { createScratchDatabase } from '../test/postgres.ts';
import { assistant, sessionsFolder, writeLog } from '../test/session-logs.ts';
import { LOCK_KEY, ingest, summaryLine } from './ingest.ts';

describe('concurrent ingestions', () => {
  let scratch: Awaited<ReturnType<typeof createScratchDatabase>>;
  let folder: string;

  beforeAll(async () => {
    scratch = await createScratchDatabase();
    folder = await sessionsFolder();
    const calls = Array.from({ length: 200 }, (_, n) =>
      assistant(
        { uuid: `a${n}`, at: n, cwd: '/gone/app' },
        { requestId: `req_${n}` },
      ),
    );
    await writeLog(join(folder, 'p', 'session-c.jsonl'), calls);
  });

  afterAll(async () => {
    await scratch.drop();
  });

  it('reports a running ingestion instead of waiting for it', async () => {
    const holder = new pg.Client({ connectionString: scratch.url });
    await holder.connect();
    const { db, close } = createDatabase(scratch.url);
    try {
      await holder.query('select pg_advisory_lock($1)', [LOCK_KEY]);
      const result = await ingest(db, folder);
      expect(summaryLine(result)).toBe('Ingestion already running.');
      expect(await db.select().from(apiCall)).toHaveLength(0);
    } finally {
      await holder.end();
      await close();
    }
  });

  it('stores each row once when two ingestions start together', async () => {
    const first = createDatabase(scratch.url);
    const second = createDatabase(scratch.url);
    try {
      const results = await Promise.all([
        ingest(first.db, folder),
        ingest(second.db, folder),
      ]);
      expect(results.some((result) => result.status === 'done')).toBe(true);
      expect(await first.db.select().from(apiCall)).toHaveLength(200);
    } finally {
      await first.close();
      await second.close();
    }
  });
});

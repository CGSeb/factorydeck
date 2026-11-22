import { asc } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { friction } from '../db/schema.ts';
import { TOOL_ERROR_CATEGORIES } from '../ingest/frictions.ts';
import { ingest } from '../ingest/ingest.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { sessionsFolder } from '../test/session-logs.ts';
import { writeDemoSessions } from './sessions.ts';

let db: Database;
let close: () => Promise<void>;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
  const folder = await sessionsFolder();
  await writeDemoSessions(
    folder,
    new Date('2026-03-12T15:30:00Z'),
    await sessionsFolder(),
  );
  await ingest(db, folder);
});

afterEach(async () => {
  await close();
});

describe('demo frictions', () => {
  it('cover every friction kind and category, in main threads and sub-agents', async () => {
    const rows = await db.select().from(friction).orderBy(asc(friction.at));
    const kinds = (main: boolean): string[] =>
      [
        ...new Set(
          rows
            .filter((row) => (row.subAgentId === null) === main)
            .map((row) => `${row.kind}/${row.category ?? ''}`),
        ),
      ].sort();
    const every = [
      'compaction/',
      'stop-blocked/',
      ...TOOL_ERROR_CATEGORIES.map((category) => `tool-error/${category}`),
    ].sort();
    expect(kinds(true)).toEqual(every);
    expect(kinds(false)).toEqual(every);
    expect(rows.every((row) => row.agent === 'claude-code')).toBe(true);
    expect(rows.some((row) => row.tool === 'unknown')).toBe(true);
    expect(
      rows.some((row) => row.kind === 'compaction' && row.preTokens === null),
    ).toBe(true);
    expect(
      rows.some((row) => row.hookCommand?.startsWith('node ~/') === true),
    ).toBe(true);
    const repeated = rows.filter(
      (row) => row.sessionId === 'demo-app-1' && row.subAgentId === null,
    );
    expect(repeated.slice(0, 3).map((row) => row.commandHash)).toEqual(
      Array(3).fill(repeated[0]?.commandHash),
    );
    expect(repeated[0]?.commandHash).not.toBeNull();
  });
});

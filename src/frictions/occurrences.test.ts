import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { ingest } from '../ingest/ingest.ts';
import { select } from '../overview/query.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
import { APP, NOW, seedFrictions } from '../test/frictions.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  EVERY_PROJECT_HAS_FACTORY,
  assistant,
  minute,
  sessionsFolder,
  userText,
  writeLog,
} from '../test/session-logs.ts';
import type { OccurrenceRow } from './occurrence-types.ts';
import { type OccurrenceQuery, frictionOccurrences } from './occurrences.ts';

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await seedFrictions(db);
});

afterAll(async () => {
  await close();
});

async function latest(
  row: OccurrenceRow,
  query: Partial<OccurrenceQuery> = {},
): Promise<string[]> {
  const occurrences = await frictionOccurrences(
    db,
    {
      period: '7d',
      timeZone: 'UTC',
      project: APP,
      now: NOW,
      row,
      ...query,
    },
    DEFAULT_CONFIG,
  );
  return occurrences.map(
    (item) =>
      `${item.at} ${item.sessionId} ${item.role} ${String(item.workItem)}`,
  );
}

describe('frictionOccurrences', () => {
  it('answers the 5 latest failures of a program, latest first', async () => {
    expect(await latest({ table: 'command', program: 'pnpm' })).toEqual([
      '2026-03-17T08:11:00.000Z app-1 main null',
      '2026-03-17T08:10:00.000Z app-1 main null',
      '2026-03-17T08:03:00.000Z app-1 builder 9',
      '2026-03-17T08:02:00.000Z app-1 builder 9',
      '2026-03-17T08:01:00.000Z app-1 builder 9',
    ]);
  });

  it('answers a command with no program', async () => {
    expect(await latest({ table: 'command', program: null })).toEqual([
      '2026-03-17T16:00:00.000Z app-2 reviewer 22',
    ]);
  });

  it('keeps to the period', async () => {
    const row: OccurrenceRow = { table: 'category', category: 'other' };
    expect(await latest(row)).toHaveLength(2);
    expect(await latest(row, { period: 'all' })).toEqual([
      '2026-03-16T09:15:00.000Z app-1 main null',
      '2026-03-16T09:10:00.000Z app-1 main null',
      '2026-03-01T09:00:00.000Z app-1 main null',
    ]);
  });

  it('keeps to the project, or every project with All projects', async () => {
    const row: OccurrenceRow = { table: 'category', category: 'other' };
    const inApp = await latest(row);
    expect(inApp.some((line) => line.includes('api-1'))).toBe(false);
    expect(await latest(row, { project: undefined })).toEqual([
      '2026-03-17T09:00:00.000Z api-1 main null',
      ...inApp,
    ]);
  });

  it('keeps to the kind', async () => {
    const row: OccurrenceRow = { table: 'command', program: 'pnpm' };
    expect(await latest(row, { kind: 'stop-blocked' })).toEqual([]);
    expect(await latest(row, { kind: 'tool-error' })).toHaveLength(5);
    expect(
      await latest(
        { table: 'hook', command: 'make check' },
        { kind: 'tool-error' },
      ),
    ).toEqual([]);
  });

  it('keeps to the role', async () => {
    expect(
      await latest({ table: 'command', program: 'pnpm' }, { role: 'builder' }),
    ).toEqual([
      '2026-03-17T08:03:00.000Z app-1 builder 9',
      '2026-03-17T08:02:00.000Z app-1 builder 9',
      '2026-03-17T08:01:00.000Z app-1 builder 9',
      '2026-03-15T07:03:00.000Z app-2 builder 21',
      '2026-03-15T07:02:00.000Z app-2 builder 21',
    ]);
  });

  it('keeps to the session or the issue', async () => {
    const row: OccurrenceRow = {
      table: 'category',
      category: 'command-failed',
    };
    const inSession = await latest(row, { filter: { session: 'app-2' } });
    expect(inSession).toHaveLength(5);
    expect(inSession.every((line) => line.includes(' app-2 '))).toBe(true);
    const onIssue = await latest(row, { filter: { issue: 21 } });
    expect(onIssue).toHaveLength(5);
    expect(onIssue.every((line) => line.endsWith(' builder 21'))).toBe(true);
    expect(onIssue[0]).toBe('2026-03-17T09:45:00.000Z app-2 builder 21');
  });

  it('answers a repeated failure as its thread and command', async () => {
    expect(
      await latest({
        table: 'repeated',
        sessionId: 'app-1',
        subAgentId: 'agent-a',
        commandHash: 'test',
      }),
    ).toEqual([
      '2026-03-17T08:03:00.000Z app-1 builder 9',
      '2026-03-17T08:02:00.000Z app-1 builder 9',
      '2026-03-17T08:01:00.000Z app-1 builder 9',
    ]);
    expect(
      await latest({
        table: 'repeated',
        sessionId: 'app-1',
        subAgentId: '',
        commandHash: 'lint',
      }),
    ).toEqual([]);
  });

  it('answers the blocks of a hook', async () => {
    expect(await latest({ table: 'hook', command: 'make check' })).toEqual([
      '2026-03-16T12:00:00.000Z app-1 main null',
      '2026-03-16T11:00:00.000Z app-1 main null',
    ]);
  });

  it('answers no texts when the session log is gone', async () => {
    const [occurrence] = await frictionOccurrences(
      db,
      {
        period: '7d',
        timeZone: 'UTC',
        project: APP,
        now: NOW,
        row: { table: 'hook', command: 'make check' },
      },
      DEFAULT_CONFIG,
    );
    expect(occurrence?.texts).toBeNull();
    expect(occurrence?.sessionTitle).toBe('Fix login');
  });
});

describe('frictionOccurrences over an ingested log', () => {
  const HOME = '/home/dev';
  const SECRET = 'token-4f9a-never-stored';

  it('reads the texts from the log and stores none of them', async () => {
    const scratch = await createTestDatabase();
    try {
      const folder = await sessionsFolder();
      const cwd = `${HOME}/work/demo`;
      await writeLog(join(folder, 'project', 'session-x.jsonl'), [
        userText({ uuid: 'u0', at: 0, cwd }, 'Build it'),
        assistant(
          { uuid: 'a1', at: 1, cwd },
          {
            requestId: 'req_1',
            stopReason: 'tool_use',
            content: [
              {
                type: 'tool_use',
                id: 't1',
                name: 'Bash',
                input: { command: `curl -H ${SECRET} ${cwd}` },
              },
            ],
          },
        ),
        {
          ...userText({ uuid: 'r1', at: 2, cwd }, ''),
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 't1',
                is_error: true,
                content: `Exit code 7\ncurl: failed with ${SECRET}`,
              },
            ],
          },
        },
        {
          type: 'system',
          subtype: 'stop_hook_summary',
          uuid: 's1',
          timestamp: minute(3),
          hookErrors: [`[make check]: ${SECRET} is missing`],
        },
      ]);
      await ingest(scratch.db, folder, {
        ...EVERY_PROJECT_HAS_FACTORY,
        home: HOME,
      });
      const query = { period: 'all', timeZone: 'UTC' } as const;
      const [failure] = await frictionOccurrences(
        scratch.db,
        { ...query, row: { table: 'command', program: 'curl' } },
        DEFAULT_CONFIG,
        HOME,
      );
      const [block] = await frictionOccurrences(
        scratch.db,
        { ...query, row: { table: 'hook', command: 'make check' } },
        DEFAULT_CONFIG,
        HOME,
      );
      expect(failure?.texts).toEqual({
        kind: 'tool-error',
        input: `curl -H ${SECRET} ~/work/demo`,
        error: `curl: failed with ${SECRET}`,
      });
      expect(block?.texts).toEqual({
        kind: 'stop-blocked',
        message: `${SECRET} is missing`,
      });
      const tables = await select(
        scratch.db,
        sql`select table_name from information_schema.tables
          where table_schema = 'public' and table_type = 'BASE TABLE'`,
      );
      expect(tables.length).toBeGreaterThan(5);
      for (const { table_name: table } of tables) {
        const rows = await select(
          scratch.db,
          sql`select row_to_json(t)::text as row from ${sql.identifier(String(table))} t`,
        );
        for (const { row } of rows) {
          expect(String(row)).not.toContain(SECRET);
        }
      }
    } finally {
      await scratch.close();
    }
  });
});

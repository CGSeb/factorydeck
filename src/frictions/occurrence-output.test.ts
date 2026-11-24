import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { ingest } from '../ingest/ingest.ts';
import { select } from '../overview/query.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
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
import { frictionOccurrences, frictionOutput } from './occurrences.ts';

const HOME = '/home/dev';
const CWD = `${HOME}/work/demo`;
const SECRET = 'token-7c1e-never-stored';

const CHAINED_OUTPUT = [
  'Exit code 1',
  'lint: 0 problems',
  'build: step 1',
  'build: step 2',
  '',
  'build: done',
  `test: ${SECRET} in ${CWD}/a.test.ts`,
  'Error: expected 1 to be 2',
  '',
  `Shell cwd was reset to ${CWD}`,
].join('\n');

let db: Database;
let close: () => Promise<void>;
let log: string;

function call(
  uuid: string,
  at: number,
  { id, name, input }: { id: string; name: string; input: unknown },
) {
  return assistant(
    { uuid, at, cwd: CWD },
    {
      requestId: `req_${uuid}`,
      stopReason: 'tool_use',
      content: [{ type: 'tool_use', id, name, input }],
    },
  );
}

function failure(uuid: string, at: number, id: string, content: string) {
  return {
    ...userText({ uuid, at, cwd: CWD }, ''),
    message: {
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: id, is_error: true, content },
      ],
    },
  };
}

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  const folder = await sessionsFolder();
  log = join(folder, 'project', 'session-y.jsonl');
  await writeLog(log, [
    userText({ uuid: 'u0', at: 0, cwd: CWD }, 'Build it'),
    call('a1', 1, {
      id: 't1',
      name: 'Bash',
      input: { command: 'pnpm lint; pnpm build && pnpm test' },
    }),
    failure('r1', 2, 't1', CHAINED_OUTPUT),
    call('a2', 3, { id: 't2', name: 'Bash', input: { command: 'false' } }),
    failure('r2', 4, 't2', 'Exit code 1\n\n'),
    call('a3', 5, { id: 't3', name: 'Read', input: { file_path: 'a.ts' } }),
    failure(
      'r3',
      6,
      't3',
      '<tool_use_error>File does not exist.\nline 2\nline 3\nline 4</tool_use_error>',
    ),
    {
      type: 'system',
      subtype: 'stop_hook_summary',
      uuid: 's1',
      timestamp: minute(7),
      hookErrors: ['[make check]: checks fail'],
    },
    {
      type: 'system',
      subtype: 'compact_boundary',
      uuid: 'c1',
      timestamp: minute(8),
      compactMetadata: { trigger: 'auto', preTokens: 1000 },
    },
  ]);
  await ingest(db, folder, { ...EVERY_PROJECT_HAS_FACTORY, home: HOME });
});

afterAll(async () => {
  await close();
});

async function occurrences(row: OccurrenceRow) {
  return frictionOccurrences(
    db,
    { period: 'all', timeZone: 'UTC', row },
    DEFAULT_CONFIG,
    HOME,
  );
}

async function frictionId(kind: string, uuid: string): Promise<number> {
  const [row] = await select(
    db,
    sql`select id from friction where kind = ${kind} and record_uuid = ${uuid}`,
  );
  return Number(row?.['id']);
}

describe('occurrence error excerpts', () => {
  it('shows the exit code and the tail of a shell output', async () => {
    const [empty, chained] = await occurrences({ table: 'tool', tool: 'Bash' });
    expect(chained).toMatchObject({
      id: await frictionId('tool-error', 'r1'),
      exitCode: 1,
      hasMore: true,
      texts: {
        kind: 'tool-error',
        input: 'pnpm lint; pnpm build && pnpm test',
        error: `build: step 1\nbuild: step 2\nbuild: done\ntest: ${SECRET} in ~/work/demo/a.test.ts\nError: expected 1 to be 2`,
        shell: true,
      },
    });
    expect(empty).toMatchObject({
      exitCode: 1,
      hasMore: false,
      texts: { kind: 'tool-error', input: 'false', error: '', shell: true },
    });
  });

  it('keeps the head of any other tool error', async () => {
    const [read] = await occurrences({ table: 'tool', tool: 'Read' });
    expect(read).toMatchObject({
      exitCode: null,
      hasMore: true,
      texts: {
        kind: 'tool-error',
        error: 'File does not exist.\nline 2\nline 3',
        shell: false,
      },
    });
  });

  it('keeps a stop hook message unchanged', async () => {
    const [block] = await occurrences({ table: 'hook', command: 'make check' });
    expect(block).toMatchObject({
      exitCode: null,
      hasMore: false,
      texts: { kind: 'stop-blocked', message: 'checks fail' },
    });
  });
});

describe('frictionOutput', () => {
  it('answers the whole cleaned output, blank lines kept', async () => {
    expect(
      await frictionOutput(db, await frictionId('tool-error', 'r1'), HOME),
    ).toEqual({
      gone: false,
      text: `lint: 0 problems\nbuild: step 1\nbuild: step 2\n\nbuild: done\ntest: ${SECRET} in ~/work/demo/a.test.ts\nError: expected 1 to be 2`,
    });
    expect(
      await frictionOutput(db, await frictionId('stop-blocked', 's1'), HOME),
    ).toEqual({ gone: false, text: 'checks fail' });
  });

  it('answers nothing for an unknown friction or a compaction', async () => {
    expect(await frictionOutput(db, 999_999, HOME)).toBeUndefined();
    expect(
      await frictionOutput(db, await frictionId('compaction', 'c1'), HOME),
    ).toBeUndefined();
  });

  it('stores none of the texts it reads', async () => {
    const tables = await select(
      db,
      sql`select table_name from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'`,
    );
    for (const { table_name: table } of tables) {
      const rows = await select(
        db,
        sql`select row_to_json(t)::text as row from ${sql.identifier(String(table))} t`,
      );
      for (const { row } of rows) expect(String(row)).not.toContain(SECRET);
    }
  });

  it('marks the log gone once the file is removed', async () => {
    const id = await frictionId('tool-error', 'r1');
    await rm(log);
    expect(await frictionOutput(db, id, HOME)).toEqual({ gone: true });
  });
});

import { join } from 'node:path';
import { asc } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { closingLine } from '../db/schema.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  EVERY_PROJECT_HAS_FACTORY,
  type Line,
  appendLog,
  assistant,
  minute,
  sessionsFolder,
  userText,
  writeLog,
} from '../test/session-logs.ts';
import { ingest } from './ingest.ts';
import { closingLineOf } from './records.ts';

const SESSION = 'session-m';

let db: Database;
let close: () => Promise<void>;
let folder: string;
let log: string;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
  folder = await sessionsFolder();
  log = join(folder, 'project', `${SESSION}.jsonl`);
});

afterEach(async () => {
  await close();
});

function reply(n: number, text: string): Line {
  return assistant(
    { uuid: `a${String(n)}`, at: n, cwd: '/work/app' },
    { requestId: `req_${String(n)}`, content: [{ type: 'text', text }] },
  );
}

async function run(): Promise<void> {
  await ingest(db, folder, EVERY_PROJECT_HAS_FACTORY);
}

async function lines(): Promise<{ line: string; at: string }[]> {
  const rows = await db
    .select()
    .from(closingLine)
    .orderBy(asc(closingLine.position));
  return rows.map((row) => ({ line: row.line, at: row.at.toISOString() }));
}

describe('closingLineOf', () => {
  it('takes the last non-empty line of the text, trimmed', () => {
    const record = assistant(
      { uuid: 'a1', at: 1 },
      {
        requestId: 'r',
        content: [
          { type: 'text', text: 'Spec written.' },
          { type: 'tool_use', name: 'Bash', input: { command: 'echo #9' } },
          { type: 'text', text: '  Work item: #88 (spec-writer)  \n\n  ' },
        ],
      },
    );
    expect(closingLineOf({ ...record, type: 'assistant' })).toBe(
      'Work item: #88 (spec-writer)',
    );
  });

  it('skips a line over 200 characters, records without text and other types', () => {
    const long = assistant(
      { uuid: 'a1', at: 1 },
      {
        requestId: 'r',
        content: [{ type: 'text', text: `#1 ${'x'.repeat(198)}` }],
      },
    );
    const exact = assistant(
      { uuid: 'a2', at: 1 },
      { requestId: 'r', content: [{ type: 'text', text: 'y'.repeat(200) }] },
    );
    const tool = assistant(
      { uuid: 'a3', at: 1 },
      {
        requestId: 'r',
        content: [{ type: 'tool_use', name: 'Bash', input: { a: '#1' } }],
      },
    );
    const blank = assistant(
      { uuid: 'a4', at: 1 },
      { requestId: 'r', content: [{ type: 'text', text: ' \n ' }] },
    );
    expect(closingLineOf({ ...long, type: 'assistant' })).toBeUndefined();
    expect(closingLineOf({ ...exact, type: 'assistant' })).toBe(
      'y'.repeat(200),
    );
    expect(closingLineOf({ ...tool, type: 'assistant' })).toBeUndefined();
    expect(closingLineOf({ ...blank, type: 'assistant' })).toBeUndefined();
    expect(
      closingLineOf({
        ...userText({ uuid: 'u', at: 1 }, 'Work item: #3'),
        type: 'user',
      }),
    ).toBeUndefined();
  });
});

describe('closing lines on ingestion', () => {
  it('stores each main-thread reply line once, across runs', async () => {
    await writeLog(log, [
      userText({ uuid: 'u1', at: 0, cwd: '/work/app' }, 'Write the spec'),
      reply(1, 'Drafting.\nWork item: #88 (spec-writer)'),
      reply(2, `Too long: ${'z'.repeat(200)}`),
    ]);
    await run();
    await run();
    expect(await lines()).toEqual([
      { line: 'Work item: #88 (spec-writer)', at: minute(1) },
    ]);
    await appendLog(log, [reply(3, 'Work item: #89')]);
    await run();
    expect(await lines()).toEqual([
      { line: 'Work item: #88 (spec-writer)', at: minute(1) },
      { line: 'Work item: #89', at: minute(3) },
    ]);
  });

  it('drops the lines a file lost when it is replaced by a shorter one', async () => {
    await writeLog(log, [
      reply(1, 'Work item: #1'),
      reply(2, `Work item: #2 ${'.'.repeat(150)}`),
    ]);
    await run();
    await writeLog(log, [reply(5, 'Work item: #5')]);
    await run();
    expect(await lines()).toEqual([{ line: 'Work item: #5', at: minute(5) }]);
  });

  it('reads neither sub-agent logs nor sidechain records', async () => {
    await writeLog(log, [
      reply(1, 'Main reply'),
      assistant(
        { uuid: 'side', at: 2, sidechain: true },
        {
          requestId: 'req_side',
          content: [{ type: 'text', text: 'Work item: #7' }],
        },
      ),
    ]);
    await writeLog(
      join(folder, 'project', SESSION, 'subagents', 'agent-x.jsonl'),
      [
        assistant(
          { uuid: 'sub', at: 3, sidechain: true, cwd: '/work/app' },
          {
            requestId: 'req_sub',
            content: [{ type: 'text', text: 'Work item: #8' }],
          },
        ),
      ],
    );
    await run();
    expect(await lines()).toEqual([{ line: 'Main reply', at: minute(1) }]);
  });
});

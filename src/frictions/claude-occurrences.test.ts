import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { HOME, at, read } from '../test/occurrence-logs.ts';
import {
  type Line,
  minute,
  sessionsFolder,
  writeLog,
} from '../test/session-logs.ts';

let folder: string;

beforeEach(async () => {
  folder = await sessionsFolder();
});

function toolUse(uuid: string, id: string, name: string, input: unknown): Line {
  return {
    type: 'assistant',
    uuid,
    timestamp: minute(1),
    message: {
      role: 'assistant',
      content: [{ type: 'tool_use', id, name, input }],
    },
  };
}

function toolError(
  uuid: string | undefined,
  results: { id: string; content: unknown }[],
): Line {
  return {
    type: 'user',
    ...(uuid === undefined ? {} : { uuid }),
    timestamp: minute(2),
    message: {
      role: 'user',
      content: [
        { type: 'text', text: 'ignored' },
        ...results.map(({ id, content }) => ({
          type: 'tool_result',
          tool_use_id: id,
          is_error: true,
          content,
        })),
      ],
    },
  };
}

function stopSummary(uuid: string, errors: string[]): Line {
  return {
    type: 'system',
    subtype: 'stop_hook_summary',
    uuid,
    timestamp: minute(3),
    hookErrors: errors,
  };
}

describe('Claude Code occurrences', () => {
  it('reads a shell command and its error excerpt', async () => {
    const log = join(folder, 'claude.jsonl');
    await writeLog(log, [
      toolUse('a1', 't1', 'Bash', {
        command: `cd ${HOME}/app && pnpm test`,
        description: 'Run tests',
      }),
      toolError('r1', [
        {
          id: 't1',
          content:
            'Exit code 1\n\u001b[31m FAIL \u001b[39m a.test.ts\n\nexpected 1\nreceived 2\nmore',
        },
      ]),
    ]);
    expect(await read([at(log, 'r1', { position: 1 })])).toEqual({
      'r1#1': {
        kind: 'tool-error',
        input: 'cd ~/app && pnpm test',
        error: ' FAIL  a.test.ts\nexpected 1\nreceived 2',
      },
    });
  });

  it('reads an MCP tool input as compact JSON and joins text blocks', async () => {
    const log = join(folder, 'claude.jsonl');
    await writeLog(log, [
      toolUse('a1', 't1', 'mcp__docs__search', {
        query: 'friction',
        limit: 5,
      }),
      toolError('r1', [
        {
          id: 't1',
          content: [
            { type: 'text', text: 'Search failed' },
            { type: 'image', source: {} },
            { type: 'text', text: `see ${HOME}/logs` },
          ],
        },
      ]),
    ]);
    expect(await read([at(log, 'r1', { position: 1 })])).toEqual({
      'r1#1': {
        kind: 'tool-error',
        input: '{"query":"friction","limit":5}',
        error: 'Search failed\nsee ~/logs',
      },
    });
  });

  it('finds a record without uuid by its offset, and each result by its position', async () => {
    const log = join(folder, 'claude.jsonl');
    const first = toolUse('a1', 't1', 'Read', { file_path: 'a.ts' });
    const second = toolUse('a2', 't2', 'Edit', { file_path: 'b.ts' });
    await writeLog(log, [
      first,
      second,
      toolError(undefined, [
        { id: 't1', content: 'File does not exist.' },
        {
          id: 't2',
          content: '<tool_use_error>String not found</tool_use_error>',
        },
      ]),
    ]);
    const offset =
      Buffer.byteLength(JSON.stringify(first)) +
      Buffer.byteLength(JSON.stringify(second)) +
      2;
    const uuid = `offset:${String(offset)}`;
    expect(
      await read([
        at(log, uuid, { position: 1 }),
        at(log, uuid, { position: 2 }),
      ]),
    ).toEqual({
      [`${uuid}#1`]: {
        kind: 'tool-error',
        input: '{"file_path":"a.ts"}',
        error: 'File does not exist.',
      },
      [`${uuid}#2`]: {
        kind: 'tool-error',
        input: '{"file_path":"b.ts"}',
        error: '<tool_use_error>String not found</tool_use_error>',
      },
    });
  });

  it('cuts a long command at 300 characters', async () => {
    const log = join(folder, 'claude.jsonl');
    await writeLog(log, [
      toolUse('a1', 't1', 'Bash', { command: `echo ${'y'.repeat(400)}` }),
      toolError('r1', [{ id: 't1', content: 'Exit code 2' }]),
    ]);
    const found = await read([at(log, 'r1', { position: 1 })]);
    expect(found['r1#1']).toEqual({
      kind: 'tool-error',
      input: `echo ${'y'.repeat(295)}…`,
      error: '',
    });
  });

  it('reads the message of each refusing stop hook', async () => {
    const log = join(folder, 'claude.jsonl');
    await writeLog(log, [
      stopSummary('s1', [
        `[${HOME}/hooks/check.sh]: Checks fail in ${HOME}/app\nline 2\n\nline 3\nline 4`,
        'checks fail',
        '[make check] no colon',
      ]),
    ]);
    const kind = 'stop-blocked';
    expect(
      await read([
        at(log, 's1', { position: 0, kind }),
        at(log, 's1', { position: 1, kind }),
        at(log, 's1', { position: 2, kind }),
      ]),
    ).toEqual({
      's1#0': {
        kind,
        message: 'Checks fail in ~/app\nline 2\nline 3',
      },
      's1#1': { kind, message: 'checks fail' },
      's1#2': { kind, message: 'no colon' },
    });
  });

  it('answers no texts when the file, the record or the call is gone', async () => {
    const log = join(folder, 'claude.jsonl');
    await writeLog(log, [
      toolError('r1', [{ id: 't-gone', content: 'Exit code 1' }]),
      stopSummary('s1', ['[hook]: no']),
    ]);
    expect(
      await read([
        at(join(folder, 'missing.jsonl'), 'r1', { position: 1 }),
        at(log, 'r1', { position: 1 }),
        at(log, 'r-missing', { position: 1 }),
        at(log, 's1', { position: 4, kind: 'stop-blocked' }),
      ]),
    ).toEqual({
      'r1#1': null,
      'r-missing#1': null,
      's1#4': null,
    });
  });
});

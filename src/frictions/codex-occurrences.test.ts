import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { CODEX } from '../ingest/codex-files.ts';
import { event, item } from '../test/codex-logs.ts';
import { HOME, at, read } from '../test/occurrence-logs.ts';
import { sessionsFolder, writeLog } from '../test/session-logs.ts';

let folder: string;

beforeEach(async () => {
  folder = await sessionsFolder();
});

describe('Codex occurrences', () => {
  it('reads a failed shell command from its call and its end event', async () => {
    const log = join(folder, 'rollout.jsonl');
    await writeLog(log, [
      item(1, {
        type: 'function_call',
        name: 'shell',
        call_id: 'c1',
        arguments: JSON.stringify({ command: ['pnpm', 'test'] }),
      }),
      event(2, {
        type: 'exec_command_end',
        call_id: 'c1',
        command: ['pnpm', 'test'],
        exit_code: 1,
        aggregated_output: `\u001b[31mFAIL\u001b[0m ${HOME}/app/a.test.ts\nExit code: 1\n`,
      }),
    ]);
    expect(await read([at(log, 'call:c1', { agent: CODEX })])).toEqual({
      'call:c1#0': {
        kind: 'tool-error',
        input: 'pnpm test',
        error: 'FAIL ~/app/a.test.ts',
      },
    });
  });

  it('reads a failed command item, an MCP call and a function output', async () => {
    const log = join(folder, 'rollout.jsonl');
    await writeLog(log, [
      event(1, {
        type: 'item_completed',
        item: {
          type: 'CommandExecution',
          id: 'i1',
          command: ['git', 'push'],
          exit_code: 128,
          aggregated_output: 'fatal: rejected',
        },
      }),
      event(2, {
        type: 'item_completed',
        item: {
          type: 'McpToolCall',
          id: 'i2',
          server: 'docs',
          tool: 'search',
          arguments: { query: 'x' },
          status: 'completed',
          result: {
            content: [{ type: 'text', text: 'Not found' }],
            isError: true,
          },
        },
      }),
      item(3, {
        type: 'function_call',
        name: 'view_image',
        call_id: 'c3',
        arguments: '{"path": "a.png"}',
      }),
      item(4, {
        type: 'function_call_output',
        call_id: 'c3',
        output: JSON.stringify({ output: 'No such file', success: false }),
      }),
    ]);
    expect(
      await read([
        at(log, 'call:i1', { agent: CODEX }),
        at(log, 'call:i2', { agent: CODEX }),
        at(log, 'call:c3', { agent: CODEX }),
      ]),
    ).toEqual({
      'call:i1#0': {
        kind: 'tool-error',
        input: 'git push',
        error: 'fatal: rejected',
      },
      'call:i2#0': {
        kind: 'tool-error',
        input: '{"query":"x"}',
        error: 'Not found',
      },
      'call:c3#0': {
        kind: 'tool-error',
        input: '{"path":"a.png"}',
        error: 'No such file',
      },
    });
  });

  it('answers no texts when the record is gone', async () => {
    const log = join(folder, 'rollout.jsonl');
    await writeLog(log, [
      event(1, { type: 'exec_command_end', call_id: 'c1', exit_code: 0 }),
    ]);
    expect(
      await read([
        at(log, 'call:c1', { agent: CODEX }),
        at(log, 'offset:999', { agent: CODEX }),
      ]),
    ).toEqual({ 'call:c1#0': null, 'offset:999#0': null });
  });

  it('finds a record without call id by its offset, and a patch by its call', async () => {
    const log = join(folder, 'rollout.jsonl');
    const first = event(1, {
      type: 'exec_command_end',
      command: 'make build',
      exit_code: 2,
      stderr: 'make: *** [build] Error 2',
    });
    await writeLog(log, [
      first,
      item(2, {
        type: 'custom_tool_call',
        name: 'apply_patch',
        call_id: 'p1',
        input: '*** Begin Patch',
      }),
      event(3, {
        type: 'patch_apply_end',
        call_id: 'p1',
        success: false,
        stderr: 'patch does not apply',
      }),
    ]);
    const offset = `offset:${String(Buffer.byteLength(JSON.stringify(first)) + 1)}`;
    expect(
      await read([
        at(log, 'offset:0', { agent: CODEX }),
        at(log, 'call:p1', { agent: CODEX }),
        at(log, offset, { agent: CODEX }),
      ]),
    ).toEqual({
      'offset:0#0': {
        kind: 'tool-error',
        input: 'make build',
        error: 'make: *** [build] Error 2',
      },
      'call:p1#0': {
        kind: 'tool-error',
        input: '*** Begin Patch',
        error: 'patch does not apply',
      },
      [`${offset}#0`]: null,
    });
  });

  it('leaves out the header Codex writes before a command output', async () => {
    const log = join(folder, 'rollout.jsonl');
    await writeLog(log, [
      item(1, {
        type: 'function_call',
        name: 'exec_command',
        call_id: 'c1',
        arguments: JSON.stringify({ cmd: 'pnpm lint' }),
      }),
      item(2, {
        type: 'function_call_output',
        call_id: 'c1',
        output:
          'Chunk ID: 4f2a\nWall time: 1.2 seconds\nProcess exited with code 1\nOriginal token count: 40\nOutput:\nsrc/a.ts: 2 problems\nWall time: kept in the body',
      }),
    ]);
    expect(await read([at(log, 'call:c1', { agent: CODEX })])).toEqual({
      'call:c1#0': {
        kind: 'tool-error',
        input: 'pnpm lint',
        error: 'src/a.ts: 2 problems\nWall time: kept in the body',
      },
    });
  });
});

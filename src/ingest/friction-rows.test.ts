import { describe, expect, it } from 'vitest';
import {
  frictionCollector,
  collectFrictions,
  frictionRows,
  readFrictions,
} from './friction-rows.ts';
import { compactionOf, stopBlockedOf, withHomeAsTilde } from './frictions.ts';
import type { LogRecord } from './records.ts';

const AT = '2026-01-05T09:00:00.000Z';
const HOME = '/home/dev';
const SOURCE = {
  sourcePath: '/logs/p/s.jsonl',
  sessionId: 's',
  subAgentId: null,
  home: HOME,
};

function toolUse(id: string, name: string, input: unknown): LogRecord {
  return {
    type: 'assistant',
    uuid: `use-${id}`,
    timestamp: AT,
    message: { content: [{ type: 'tool_use', id, name, input }] },
  };
}

function toolError(id: string, content: unknown): LogRecord {
  return {
    type: 'user',
    uuid: `result-${id}`,
    timestamp: AT,
    message: {
      content: [
        { type: 'tool_result', tool_use_id: id, is_error: true, content },
      ],
    },
  };
}

function rowsOf(records: LogRecord[]): ReturnType<typeof frictionRows> {
  return frictionRows(
    readFrictions(
      records.map((record, offset) => ({ record, offset })),
      SOURCE,
      0,
    ),
  );
}

describe('Claude Code reader', () => {
  it('names a tool error after its call in the file, or `unknown`', () => {
    const rows = rowsOf([
      toolUse('t1', 'Bash', { command: 'pnpm test' }),
      toolError('t1', 'Exit code 1\nFAIL'),
      toolError('lost', [{ type: 'text', text: '<tool_use_error>No.' }]),
    ]);
    expect(rows).toEqual([
      expect.objectContaining({
        recordUuid: 'result-t1',
        position: 0,
        agent: 'claude-code',
        kind: 'tool-error',
        tool: 'Bash',
        category: 'command-failed',
        program: 'pnpm',
        exitCode: 1,
      }),
      expect.objectContaining({
        recordUuid: 'result-lost',
        tool: 'unknown',
        category: 'tool-misuse',
        program: null,
        commandHash: null,
      }),
    ]);
  });

  it('joins the text blocks of a result', () => {
    const rows = rowsOf([
      toolUse('t1', 'Edit', {}),
      toolError('t1', [
        { type: 'image', source: {} },
        { type: 'text', text: 'PreToolUse:Edit hook error' },
        { type: 'text', text: 'more' },
      ]),
    ]);
    expect(rows[0]).toMatchObject({ category: 'hook-blocked' });
  });

  it('ignores results that are not errors', () => {
    const ok = toolError('t1', 'Exit code 1');
    const block = (ok['message'] as { content: Record<string, unknown>[] })
      .content[0];
    if (block !== undefined) block['is_error'] = false;
    expect(rowsOf([ok])).toEqual([]);
  });

  it('reads one stop blocked per refusing hook, with the home folder as ~', () => {
    const record: LogRecord = {
      type: 'system',
      subtype: 'stop_hook_summary',
      uuid: 'stop-1',
      timestamp: AT,
      hookErrors: [
        `[node ${HOME}/.claude/hooks/check.ts]: pnpm check fails: secret`,
        'Checks fail on this branch: secret',
      ],
    };
    expect(rowsOf([record])).toEqual([
      expect.objectContaining({
        kind: 'stop-blocked',
        position: 0,
        hookCommand: 'node ~/.claude/hooks/check.ts',
        tool: null,
      }),
      expect.objectContaining({
        kind: 'stop-blocked',
        position: 1,
        hookCommand: '',
      }),
    ]);
    expect(stopBlockedOf({ ...record, hookErrors: [] }, HOME)).toEqual([]);
  });

  it('writes the home folder as ~ only where it is a whole path', () => {
    expect(
      withHomeAsTilde(`${HOME}/a ${HOME} ${HOME}2/b "${HOME}"`, HOME),
    ).toBe(`~/a ~ ${HOME}2/b "~"`);
    expect(withHomeAsTilde('/x', '')).toBe('/x');
  });

  it('reads a compaction with and without its metadata', () => {
    expect(
      compactionOf({
        type: 'system',
        subtype: 'compact_boundary',
        compactMetadata: {
          trigger: 'auto',
          preTokens: 160000,
          postTokens: 12000,
        },
      }),
    ).toEqual({
      kind: 'compaction',
      trigger: 'auto',
      preTokens: 160000,
      postTokens: 12000,
    });
    expect(
      compactionOf({
        type: 'system',
        subtype: 'compact_boundary',
        compactMetadata: { trigger: 'manual', preTokens: 90000 },
      }),
    ).toEqual({
      kind: 'compaction',
      trigger: 'manual',
      preTokens: 90000,
      postTokens: null,
    });
    expect(
      compactionOf({ type: 'system', subtype: 'compact_boundary' }),
    ).toEqual({
      kind: 'compaction',
      trigger: null,
      preTokens: null,
      postTokens: null,
    });
    expect(compactionOf({ type: 'system', subtype: 'other' })).toBeUndefined();
  });

  it('counts a friction record without time instead of storing it', () => {
    const collector = frictionCollector();
    collectFrictions(collector, SOURCE, {
      record: { type: 'system', subtype: 'compact_boundary' },
      recordUuid: 'c',
      at: undefined,
    });
    expect(collector.untimed).toBe(1);
    expect(frictionRows(collector)).toEqual([]);
  });

  it('keeps no text of the records', () => {
    const secret = 'TOP-SECRET-TEXT';
    const rows = rowsOf([
      toolUse('t1', 'Bash', { command: `echo ${secret}` }),
      toolError('t1', `Exit code 3\n${secret}`),
      toolUse('t2', 'Edit', { file_path: secret, old_string: secret }),
      toolError('t2', `<tool_use_error>${secret}`),
      {
        type: 'system',
        subtype: 'stop_hook_summary',
        uuid: 'stop',
        timestamp: AT,
        hookErrors: [`[check]: ${secret}`],
      },
      {
        type: 'system',
        subtype: 'compact_boundary',
        uuid: 'compact',
        timestamp: AT,
        content: secret,
        compactMetadata: { trigger: 'auto', summary: secret },
      },
    ]);
    expect(rows).toHaveLength(4);
    expect(JSON.stringify(rows)).not.toContain(secret);
  });
});

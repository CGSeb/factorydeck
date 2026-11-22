import { describe, expect, it } from 'vitest';
import {
  event,
  keyKind,
  readLines,
  sessionMeta,
  taskComplete,
  taskStarted,
  tokenCount,
  turnContext,
  usageRecord,
  userItem,
  userMessage,
} from '../test/codex-logs.ts';
import { minute } from '../test/session-logs.ts';
import { codexMetaOf, parseCodexRecord } from './codex-files.ts';
import type { CodexRows } from './codex-records.ts';
import { turnEnded } from './records.ts';

function tokens(rows: CodexRows): unknown[] {
  return rows.calls.map((call) => ({
    key: keyKind(call.requestKey),
    model: call.model,
    input: call.inputTokens,
    cacheWrite: call.cacheWriteTokens,
    cacheRead: call.cacheReadTokens,
    output: call.outputTokens,
  }));
}

describe('codexMetaOf', () => {
  it('reads the id, working directory and git branch, when there is one', () => {
    const withGit = parseCodexRecord(
      JSON.stringify(sessionMeta({ id: 's1', cwd: '/w/a', branch: 'feat/x' })),
    );
    const withoutGit = parseCodexRecord(
      JSON.stringify(sessionMeta({ id: 's2' })),
    );
    expect(withGit && codexMetaOf(withGit)).toMatchObject({
      id: 's1',
      cwd: '/w/a',
      gitBranch: 'feat/x',
      parentThreadId: null,
    });
    expect(withoutGit && codexMetaOf(withoutGit)).toMatchObject({
      id: 's2',
      gitBranch: '',
    });
  });

  it('reads a sub-agent spawn, its role, path and history start', () => {
    const record = parseCodexRecord(
      JSON.stringify(
        sessionMeta({
          id: 'sub',
          sessionId: 'root',
          parent: 'root',
          role: 'worker',
          agentPath: '/root/review_worker',
          historyStart: 3,
        }),
      ),
    );
    expect(record && codexMetaOf(record)).toMatchObject({
      id: 'sub',
      sessionId: 'root',
      parentThreadId: 'root',
      agentRole: 'worker',
      agentPath: '/root/review_worker',
      historyStart: 3,
    });
  });
});

describe('readCodexChunk calls', () => {
  it('reads each response once, subtracting cached and cache-write tokens from input', () => {
    const { rows } = readLines([
      sessionMeta({ id: 'root' }),
      turnContext(1, 'gpt-test-1'),
      usageRecord(2, 'resp_1', {
        input: 100,
        cached: 60,
        cacheWrite: 10,
        output: 7,
      }),
      usageRecord(2, 'resp_1', { input: 100, cached: 60, output: 7 }),
      turnContext(3, 'gpt-test-2'),
      usageRecord(4, 'resp_2', { input: 5, cached: 9, output: 3 }),
    ]);
    expect(tokens(rows)).toEqual([
      {
        key: 'resp_1',
        model: 'gpt-test-1',
        input: 30,
        cacheWrite: 10,
        cacheRead: 60,
        output: 7,
      },
      {
        key: 'resp_2',
        model: 'gpt-test-2',
        input: 0,
        cacheWrite: 0,
        cacheRead: 9,
        output: 3,
      },
    ]);
  });

  it('takes the model from thread settings, and none before any', () => {
    const { rows } = readLines([
      usageRecord(1, 'resp_0', { input: 1, output: 1 }),
      event(2, {
        type: 'thread_settings_applied',
        thread_settings: { model: 'gpt-test-3' },
      }),
      usageRecord(3, 'resp_1', { input: 1, output: 1 }),
    ]);
    expect(rows.calls.map((call) => call.model)).toEqual(['', 'gpt-test-3']);
  });

  it('reads token_count events in a file without usage records, skipping an unchanged total', () => {
    const { rows, state } = readLines([
      turnContext(0, 'gpt-test-1'),
      event(1, { type: 'token_count', info: null }),
      tokenCount(
        2,
        { input: 10, output: 2 },
        { input: 10, cached: 4, output: 2 },
      ),
      tokenCount(
        3,
        { input: 10, output: 2 },
        { input: 10, cached: 4, output: 2 },
      ),
      tokenCount(4, { input: 30, output: 5 }, { input: 20, output: 3 }),
    ]);
    expect(tokens(rows)).toEqual([
      {
        key: 'token_count:',
        model: 'gpt-test-1',
        input: 6,
        cacheWrite: 0,
        cacheRead: 4,
        output: 2,
      },
      {
        key: 'token_count:',
        model: 'gpt-test-1',
        input: 20,
        cacheWrite: 0,
        cacheRead: 0,
        output: 3,
      },
    ]);
    const next = readLines(
      [tokenCount(5, { input: 30, output: 5 }, { input: 20, output: 3 })],
      { state },
    );
    expect(next.rows.calls).toEqual([]);
  });

  it('ignores token_count events once the file holds usage records', () => {
    const { rows } = readLines([
      tokenCount(1, { input: 10, output: 2 }, { input: 10, output: 2 }),
      usageRecord(1, 'resp_1', { input: 10, output: 2 }),
      tokenCount(2, { input: 20, output: 4 }, { input: 10, output: 2 }),
    ]);
    expect(rows.calls.map((call) => call.requestKey)).toEqual(['resp_1']);
    expect(rows.dropTokenCountCalls).toBe(true);
  });
});

describe('readCodexChunk main thread', () => {
  it('stores user prompts in both forms, closing lines and the turn state', () => {
    const { rows, main, span } = readLines([
      sessionMeta({ id: 'root', at: 0 }),
      taskStarted(1),
      userMessage(1),
      taskComplete(2, 'Done.\n\nWork item: #42 (worker)\n'),
      taskStarted(3),
      userItem(3, 'msg-1'),
    ]);
    expect(
      rows.prompts.map(({ recordUuid }) =>
        recordUuid.startsWith('offset:') ? 'offset' : recordUuid,
      ),
    ).toEqual(['offset', 'item:msg-1']);
    expect(rows.closingLines.map((line) => line.line)).toEqual([
      'Work item: #42 (worker)',
    ]);
    expect(turnEnded(main)).toBe(false);
    expect(span).toEqual({
      firstAt: new Date(minute(0)),
      lastAt: new Date(minute(3)),
    });
  });

  it('ends the turn on a task_complete after the last task_started', () => {
    const { main } = readLines([taskStarted(1), taskComplete(2, 'Done.')]);
    expect(turnEnded(main)).toBe(true);
  });

  it('reads no prompt or closing line in a sub-agent', () => {
    const { rows } = readLines(
      [userMessage(1), taskComplete(2, 'Work item: #4')],
      {
        subAgentId: 'sub',
      },
    );
    expect(rows.prompts).toEqual([]);
    expect(rows.closingLines).toEqual([]);
  });
});

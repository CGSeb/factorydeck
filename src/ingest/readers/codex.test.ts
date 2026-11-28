import { describe, expect, it } from 'vitest';
import { checkBatch } from '../../cli-ingest/batch-schema.ts';
import { PARSER_VERSION } from '../../cli-ingest/batch.ts';
import {
  chunkOf,
  compacted,
  execEnd,
  failedMcpCall,
  item,
  sessionMeta,
  shellCall,
  shellOutput,
  taskComplete,
  taskStarted,
  tokenCount,
  turnContext,
  usageRecord,
  userMessage,
} from '../../test/codex-logs.ts';
import {
  type PartReader,
  cutPairs,
  readInParts,
  readOrThrow,
} from '../../test/reader-parts.ts';
import { minute } from '../../test/session-logs.ts';
import { commandHash } from '../frictions.ts';
import { type CodexLog, readCodexLog } from './codex.ts';
import { MAX_READER_STATE_BYTES, stateSize } from './reader.ts';

const ROOT: CodexLog = {
  sessionId: 'root',
  subAgentId: null,
  cwd: '/work/app',
};
const SUB: CodexLog = {
  sessionId: 'root',
  subAgentId: 'sub',
  cwd: '/work/app',
};

function reader(log: CodexLog): PartReader {
  return (bytes, from, readerState) =>
    readCodexLog({ bytes, from, readerState, home: '/home/dev', log });
}

const tokens = (input: number) => ({ input, output: 2 });

function rootLog(): Buffer {
  return chunkOf([
    sessionMeta({ id: 'root', branch: 'feat/12-cart' }),
    turnContext(1, 'gpt-test-1'),
    taskStarted(2),
    userMessage(3),
    shellCall(4, 'c1', ['pnpm', 'test']),
    execEnd(5, 'c1', ['pnpm', 'test'], 2),
    shellOutput(5, 'c1', 2),
    shellCall(6, 'c2', ['ls']),
    shellOutput(7, 'c2', 0),
    tokenCount(8, tokens(10), tokens(10)),
    failedMcpCall(9, 'm1'),
    compacted(10),
    shellCall(11, 'c3', ['pnpm', 'lint']),
    shellOutput(12, 'c3', 1),
    tokenCount(13, tokens(30), tokens(20)),
    taskComplete(14, 'Done.\nWork item: #12 (builder)'),
    'not json',
    { type: 'event_msg', payload: { type: 'task_started' } },
  ]);
}

function subLog(): Buffer {
  return chunkOf([
    sessionMeta({
      id: 'sub',
      sessionId: 'root',
      parent: 'root',
      role: 'worker',
      agentPath: '/root/worker',
      historyStart: 3,
    }),
    turnContext(1, 'gpt-inherited'),
    tokenCount(2, tokens(5), tokens(5)),
    turnContext(20, 'gpt-sub'),
    usageRecord(21, 'resp_1', tokens(7)),
    shellCall(22, 's1', ['git', 'diff']),
    shellOutput(23, 's1', 128),
    usageRecord(24, 'resp_2', tokens(9)),
  ]);
}

describe('readCodexLog', () => {
  it('reads a root rollout into a thread of the batch, with its frictions', () => {
    const bytes = rootLog();
    const read = readOrThrow(reader(ROOT)(bytes, 0, null));
    expect(read.thread).toMatchObject({
      fileKey: 'codex/root/main',
      agent: 'codex',
      from: 0,
      readTo: bytes.length,
      session: {
        cwd: '/work/app',
        gitBranch: 'feat/12-cart',
        gitBranches: ['feat/12-cart'],
        title: '',
        firstAt: minute(0),
        lastAt: minute(14),
        turnEnded: true,
      },
      skillLaunches: [],
    });
    expect(read.thread.apiCalls).toEqual([
      expect.objectContaining({ model: 'gpt-test-1', inputTokens: 10 }),
      expect.objectContaining({ model: 'gpt-test-1', inputTokens: 20 }),
    ]);
    expect(read.thread.prompts).toHaveLength(1);
    expect(read.thread.closingLines).toEqual([
      expect.objectContaining({ line: 'Work item: #12 (builder)' }),
    ]);
    expect(read.frictions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recordId: 'call:c1',
          tool: 'shell',
          program: 'pnpm',
          exitCode: 2,
          commandHash: commandHash('pnpm test'),
        }),
        expect.objectContaining({ recordId: 'call:c3', exitCode: 1 }),
        expect.objectContaining({ recordId: 'call:m1', category: 'other' }),
        expect.objectContaining({ kind: 'compaction', trigger: 'auto' }),
      ]),
    );
    expect(read.frictions).toHaveLength(4);
    expect([read.skipped, read.untimed]).toEqual([1, 1]);
    expect(
      checkBatch({
        parserVersion: PARSER_VERSION,
        threads: [{ ...read.thread, remote: null }],
      }).status,
    ).toBe('ok');
  });

  it('reads a sub-agent rollout, leaving out the history it inherited', () => {
    const read = readOrThrow(reader(SUB)(subLog(), 0, null));
    expect(read.thread).toMatchObject({
      fileKey: 'codex/root/sub',
      subAgent: {
        toolUseId: '',
        agentType: 'worker',
        description: '/root/worker',
        model: 'gpt-sub',
        cwd: '/work/app',
        gitBranch: '',
        firstAt: minute(0),
        lastAt: minute(24),
      },
      prompts: [],
    });
    expect(read.thread.apiCalls.map((call) => call.requestKey)).toEqual([
      'resp_1',
      'resp_2',
    ]);
    expect(read.frictions).toEqual([
      expect.objectContaining({ recordId: 'call:s1', program: 'git' }),
    ]);
  });

  it('gives the same records read in one pass and in three parts', () => {
    for (const [log, bytes] of [
      [ROOT, rootLog()],
      [SUB, subLog()],
    ] as const) {
      const whole = readInParts(reader(log), bytes, []);
      for (const ends of cutPairs(bytes)) {
        const parts = readInParts(reader(log), bytes, ends);
        expect({ ...parts, states: [] }).toEqual({ ...whole, states: [] });
      }
    }
  });

  it('restarts when the rollout switches to usage records after the offset it starts at', () => {
    const start = chunkOf([
      sessionMeta({ id: 'root' }),
      tokenCount(1, tokens(10), tokens(10)),
    ]);
    const first = readOrThrow(reader(ROOT)(start, 0, null));
    const next = chunkOf([usageRecord(2, 'resp_1', tokens(4))]);
    expect(reader(ROOT)(next, first.readTo, first.readerState)).toEqual({
      status: 'restart',
    });
    const whole = readOrThrow(
      reader(ROOT)(Buffer.concat([start, next]), 0, null),
    );
    expect(whole.thread.apiCalls.map((call) => call.requestKey)).toEqual([
      'resp_1',
    ]);
  });

  it('restarts in the middle of a rollout without a state of its version', () => {
    for (const state of [null, {}, { v: 2 }, { v: 1, meta: {} }]) {
      expect(reader(ROOT)(rootLog(), 10, state)).toEqual({ status: 'restart' });
    }
  });

  it('keeps its reader state under 16 KB on a long rollout', () => {
    const lines = [sessionMeta({ id: 'root', branch: 'feat/x' })];
    for (let index = 0; index < 2000; index += 1) {
      lines.push(
        turnContext(index, `gpt-${String(index)}`),
        shellCall(index, `c${String(index)}`, ['pnpm', 'x'.repeat(500)]),
        item(index, {
          type: 'function_call',
          name: `mcp__${'server'.repeat(10)}__${'tool'.repeat(10)}`,
          call_id: `m${String(index)}`,
          arguments: '{}',
        }),
        tokenCount(index, tokens(index + 1), tokens(1)),
      );
    }
    const bytes = chunkOf(lines);
    const parts = readInParts(reader(ROOT), bytes, [
      Math.floor(bytes.length / 3),
      Math.floor((bytes.length * 2) / 3),
    ]);
    for (const state of parts.states) {
      expect(stateSize(state)).toBeLessThanOrEqual(MAX_READER_STATE_BYTES);
    }
    const state = parts.readerState as { toolCalls: { id: string }[] };
    expect(state.toolCalls).toHaveLength(50);
    expect(state.toolCalls.at(-1)?.id).toBe('m1999');
  });
});

import { describe, expect, it } from 'vitest';
import { checkBatch } from '../../cli-ingest/batch-schema.ts';
import { PARSER_VERSION } from '../../cli-ingest/batch.ts';
import { chunkOf } from '../../test/codex-logs.ts';
import {
  type PartReader,
  cutPairs,
  readInParts,
  readOrThrow,
} from '../../test/reader-parts.ts';
import {
  assistant,
  minute,
  skillCall,
  skillInstructions,
  title,
  userText,
} from '../../test/session-logs.ts';
import { commandHash } from '../frictions.ts';
import { type SubAgentMeta, readClaudeCodeLog } from './claude-code.ts';

const HOME = '/home/dev';
const MAIN = { sessionId: 's-1', subAgentId: null };
const META: SubAgentMeta = {
  toolUseId: 'toolu_task',
  agentType: 'reviewer',
  description: 'Review the branch',
  model: 'claude-test-2',
};

function bash(id: string, command: string): Record<string, unknown> {
  return { type: 'tool_use', id, name: 'Bash', input: { command } };
}

function toolError(uuid: string, at: number, id: string, text: string) {
  return {
    type: 'user',
    uuid,
    timestamp: minute(at),
    isSidechain: false,
    message: {
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: id, is_error: true, content: text },
      ],
    },
  };
}

function system(uuid: string, at: number, fields: Record<string, unknown>) {
  return { type: 'system', uuid, timestamp: minute(at), ...fields };
}

const ctx = (uuid: string, at: number, gitBranch = 'main') => ({
  uuid,
  at,
  cwd: '/work/app',
  gitBranch,
});

function mainLog(): Buffer {
  return chunkOf([
    title('Build the cart'),
    userText({ ...ctx('u1', 0), promptId: 'p1' }, 'Build the cart'),
    assistant(ctx('a1', 1, 'feat/12-cart'), {
      requestId: 'req_1',
      stopReason: 'tool_use',
      content: [bash('toolu_b1', 'cd app && pnpm test --run')],
    }),
    toolError('u2', 2, 'toolu_b1', 'Exit code 1\nfailed'),
    assistant(ctx('a2', 3, 'feat/12-cart'), {
      requestId: 'req_2',
      stopReason: 'tool_use',
      content: [skillCall('check-spec')],
    }),
    userText(
      { ...ctx('u3', 4, 'feat/12-cart'), promptId: 'p2' },
      '<command-name>/build-feature</command-name>',
    ),
    skillInstructions({ ...ctx('u4', 5, 'feat/12-cart'), promptId: 'p2' }),
    assistant(ctx('a3', 6, 'feat/12-cart'), {
      requestId: 'req_3',
      content: [{ type: 'text', text: 'Done.\nWork item: #12 (builder)' }],
    }),
    system('y1', 7, {
      subtype: 'compact_boundary',
      compactMetadata: { trigger: 'auto', preTokens: 900, postTokens: 90 },
    }),
    system('y2', 8, {
      subtype: 'stop_hook_summary',
      hookErrors: [`[${HOME}/hooks/stop.sh]: blocked`],
    }),
    '{"type": "user", broken',
    { type: 'user', uuid: 'u5', message: { role: 'user', content: 'x' } },
    assistant(ctx('a4', 9, 'feat/12-cart'), {
      requestId: 'req_4',
      stopReason: 'tool_use',
      content: [bash('toolu_b2', 'pnpm lint')],
    }),
    toolError('u6', 10, 'toolu_b2', 'Exit code 2\nlint'),
    assistant(ctx('a5', 11, 'feat/12-cart'), { requestId: 'req_5' }),
  ]);
}

function subAgentLog(): Buffer {
  const side = (uuid: string, at: number) => ({
    ...ctx(uuid, at, 'feat/12-cart'),
    sidechain: true,
  });
  return chunkOf([
    userText(side('s1', 20), 'Review'),
    assistant(side('s2', 21), {
      requestId: 'req_s1',
      stopReason: 'tool_use',
      content: [bash('toolu_s1', 'git diff')],
    }),
    toolError('s3', 22, 'toolu_s1', 'Exit code 128'),
    assistant(side('s4', 23), { requestId: 'req_s2' }),
  ]);
}

const mainReader: PartReader = (bytes, from, readerState) =>
  readClaudeCodeLog({ bytes, from, readerState, home: HOME, log: MAIN });

const subReader: PartReader = (bytes, from, readerState) =>
  readClaudeCodeLog({
    bytes,
    from,
    readerState,
    home: HOME,
    log: { sessionId: 's-1', subAgentId: 'ag-1' },
    meta: META,
  });

describe('readClaudeCodeLog', () => {
  it('reads a session log into a thread of the batch, with its frictions', () => {
    const bytes = mainLog();
    const read = readOrThrow(mainReader(bytes, 0, null));
    expect(read.readTo).toBe(bytes.length);
    expect(read.thread).toMatchObject({
      fileKey: 'claude-code/s-1/main',
      agent: 'claude-code',
      from: 0,
      readTo: bytes.length,
      session: {
        cwd: '/work/app',
        gitBranch: 'feat/12-cart',
        gitBranches: ['main', 'feat/12-cart'],
        title: 'Build the cart',
        firstAt: minute(0),
        lastAt: minute(11),
        turnEnded: true,
      },
    });
    expect(read.thread.apiCalls.map((call) => call.requestKey)).toEqual([
      'req_1',
      'req_2',
      'req_3',
      'req_4',
      'req_5',
    ]);
    expect(read.thread.skillLaunches).toEqual([
      { recordId: 'a2', at: minute(3), skill: 'check-spec' },
      { recordId: 'u3', at: minute(4), skill: 'build-feature' },
    ]);
    expect(read.thread.prompts).toEqual([
      { recordId: 'u1', at: minute(0), promptId: 'p1', command: null },
      {
        recordId: 'u3',
        at: minute(4),
        promptId: 'p2',
        command: 'build-feature',
      },
    ]);
    expect(read.thread.closingLines).toEqual([
      expect.objectContaining({
        recordId: 'a3',
        line: 'Work item: #12 (builder)',
      }),
      expect.objectContaining({ recordId: 'a5', line: 'Done.' }),
    ]);
    expect(read.frictions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recordId: 'u2',
          kind: 'tool-error',
          tool: 'Bash',
          category: 'command-failed',
          program: 'pnpm',
          exitCode: 1,
          commandHash: commandHash('cd app && pnpm test --run'),
        }),
        expect.objectContaining({ recordId: 'y1', kind: 'compaction' }),
        expect.objectContaining({
          recordId: 'y2',
          kind: 'stop-blocked',
          hookCommand: '~/hooks/stop.sh',
        }),
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

  it('gives the same records read in one pass and in three parts', () => {
    for (const [reader, bytes] of [
      [mainReader, mainLog()],
      [subReader, subAgentLog()],
    ] as const) {
      const whole = readInParts(reader, bytes, []);
      for (const ends of cutPairs(bytes)) {
        const parts = readInParts(reader, bytes, ends);
        expect({ ...parts, states: [] }).toEqual({ ...whole, states: [] });
      }
    }
  });

  it('reads a sub-agent log with its meta, working directory and branch', () => {
    const read = readOrThrow(subReader(subAgentLog(), 0, null));
    expect(read.thread).toMatchObject({
      fileKey: 'claude-code/s-1/ag-1',
      subAgentId: 'ag-1',
      subAgent: {
        ...META,
        cwd: '/work/app',
        gitBranch: 'feat/12-cart',
        firstAt: minute(20),
        lastAt: minute(23),
      },
      prompts: [],
      closingLines: [],
    });
    expect(read.thread.session).toBeUndefined();
    expect(read.frictions).toEqual([
      expect.objectContaining({
        recordId: 's3',
        program: 'git',
        exitCode: 128,
      }),
    ]);
  });

  it('sends a changed meta as a thread that reads no byte', () => {
    const bytes = subAgentLog();
    const first = readOrThrow(subReader(bytes, 0, null));
    const again = readOrThrow(
      readClaudeCodeLog({
        bytes: Buffer.alloc(0),
        from: first.readTo,
        readerState: first.readerState,
        home: HOME,
        log: { sessionId: 's-1', subAgentId: 'ag-1' },
        meta: { ...META, description: 'Review again' },
      }),
    );
    expect(again.thread).toMatchObject({
      from: bytes.length,
      readTo: bytes.length,
      apiCalls: [],
      subAgent: { description: 'Review again', cwd: '/work/app' },
    });
  });
});

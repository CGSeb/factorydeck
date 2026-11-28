import { describe, expect, it } from 'vitest';
import { chunkOf } from '../../test/codex-logs.ts';
import {
  type PartReader,
  readInParts,
  readOrThrow,
} from '../../test/reader-parts.ts';
import {
  assistant,
  minute,
  skillInstructions,
  title,
  userText,
} from '../../test/session-logs.ts';
import { commandHash } from '../frictions.ts';
import { readClaudeCodeLog } from './claude-code.ts';
import { MAX_READER_STATE_BYTES, stateSize } from './reader.ts';

const mainReader: PartReader = (bytes, from, readerState) =>
  readClaudeCodeLog({
    bytes,
    from,
    readerState,
    home: '/home/dev',
    log: { sessionId: 's-1', subAgentId: null },
  });

const ctx = (uuid: string, at: number, gitBranch = 'main') => ({
  uuid,
  at,
  cwd: '/work/app',
  gitBranch,
});

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

function shortLog(): Buffer {
  return chunkOf([
    userText(ctx('u1', 0), 'Start'),
    assistant(ctx('a1', 1), { requestId: 'req_1' }),
  ]);
}

describe('the Claude Code reader state', () => {
  it('restarts in the middle of a log without a state of its version, and reads from 0 whatever the state', () => {
    for (const state of [null, {}, { v: 2 }, 'x', { v: 1, turn: null }]) {
      expect(mainReader(shortLog(), 10, state)).toEqual({ status: 'restart' });
      expect(mainReader(shortLog(), 0, state).status).toBe('read');
    }
  });

  it('keeps a slash command and an unanswered tool call for the next part', () => {
    const lines = [
      userText(
        { ...ctx('u1', 0), promptId: 'p1' },
        '<command-name>/build-feature</command-name>',
      ),
      assistant(ctx('a1', 1), {
        requestId: 'req_1',
        stopReason: 'tool_use',
        content: [bash('toolu_1', 'pnpm build')],
      }),
    ];
    const first = readOrThrow(mainReader(chunkOf(lines), 0, null));
    expect(first.readerState).toMatchObject({
      slash: { promptId: 'p1', recordId: 'u1', command: 'build-feature' },
      toolCalls: [
        {
          id: 'toolu_1',
          name: 'Bash',
          program: 'pnpm',
          commandHash: commandHash('pnpm build'),
        },
      ],
    });
    expect(JSON.stringify(first.readerState)).not.toContain('pnpm build');
    const next = readOrThrow(
      mainReader(
        chunkOf([
          skillInstructions({ ...ctx('u2', 2), promptId: 'p1' }),
          toolError('u3', 3, 'toolu_1', 'Exit code 1'),
        ]),
        first.readTo,
        first.readerState,
      ),
    );
    expect(next.thread.skillLaunches).toEqual([
      { recordId: 'u1', at: minute(0), skill: 'build-feature' },
    ]);
    expect(next.frictions).toEqual([
      expect.objectContaining({ tool: 'Bash', program: 'pnpm', exitCode: 1 }),
    ]);
    expect(next.readerState).toMatchObject({ slash: null, toolCalls: [] });
  });
  function longLog(titleText: string, branchLength: number): Buffer {
    const lines: Record<string, unknown>[] = [title(titleText)];
    for (let index = 0; index < 400; index += 1) {
      const branch = `feat/${String(index)}-${'b'.repeat(branchLength)}`;
      lines.push(
        userText(
          {
            ...ctx(`u${String(index)}`, index, branch),
            promptId: `p${String(index)}`,
          },
          `<command-name>/skill-${String(index)}</command-name>`,
        ),
        assistant(ctx(`a${String(index)}`, index, branch), {
          requestId: `req_${String(index)}`,
          stopReason: 'tool_use',
          content: [
            bash(`toolu_${String(index)}`, `pnpm ${'x'.repeat(2000)}`),
            {
              type: 'tool_use',
              id: `toolu_m${String(index)}`,
              name: `mcp__${'server'.repeat(8)}__${'tool'.repeat(8)}`,
              input: {},
            },
          ],
        }),
      );
    }
    return chunkOf(lines);
  }

  function statesOf(bytes: Buffer) {
    const parts = readInParts(mainReader, bytes, [
      Math.floor(bytes.length / 3),
      Math.floor((bytes.length * 2) / 3),
    ]);
    for (const state of parts.states) {
      expect(stateSize(state)).toBeLessThanOrEqual(MAX_READER_STATE_BYTES);
    }
    return parts.readerState as {
      title: string;
      gitBranches: string[];
      toolCalls: { id: string }[];
    };
  }

  it('keeps its reader state under 16 KB on a long log, with 100 branches and 50 pending tool calls at most', () => {
    const state = statesOf(longLog('Build the cart', 20));
    expect(state.gitBranches).toHaveLength(100);
    expect(state.toolCalls).toHaveLength(50);
    expect(state.toolCalls.at(-1)?.id).toBe('toolu_m399');
  });

  it('drops the oldest pending tool calls, then branches, then the end of the title, past 16 KB', () => {
    const state = statesOf(longLog('T'.repeat(30_000), 200));
    expect(state.toolCalls).toEqual([]);
    expect(state.gitBranches).toEqual([]);
    expect(state.title.length).toBeLessThan(16_384);
    const roomy = statesOf(longLog('Build the cart', 120));
    expect(roomy.gitBranches).toHaveLength(100);
    expect(roomy.toolCalls.length).toBeLessThan(50);
    expect(roomy.toolCalls.at(-1)?.id).toBe('toolu_m399');
  });
});

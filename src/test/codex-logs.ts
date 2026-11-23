import { join } from 'node:path';
import { parseCodexRecord } from '../ingest/codex-files.ts';
import {
  type CodexRows,
  type CodexState,
  TOKEN_COUNT_KEY,
  codexState,
  readCodexChunk,
} from '../ingest/codex-records.ts';
import { type TurnState, parseLines } from '../ingest/records.ts';
import type { Span } from '../ingest/thread.ts';
import { minute } from './session-logs.ts';

type Line = Record<string, unknown>;

export function rolloutPath(folder: string, id: string, day = '05'): string {
  return join(
    folder,
    '2026',
    '01',
    day,
    `rollout-2026-01-${day}T09-00-00-${id}.jsonl`,
  );
}

export interface MetaOptions {
  id: string;
  at?: number;
  cwd?: string;
  branch?: string;
  sessionId?: string;
  parent?: string;
  role?: string;
  agentPath?: string;
  historyStart?: number;
}

export function sessionMeta(options: MetaOptions): Line {
  const spawn =
    options.parent === undefined
      ? undefined
      : {
          parent_thread_id: options.parent,
          ...(options.role === undefined ? {} : { agent_role: options.role }),
          ...(options.agentPath === undefined
            ? {}
            : { agent_path: options.agentPath }),
        };
  return {
    timestamp: minute(options.at ?? 0),
    type: 'session_meta',
    payload: {
      id: options.id,
      ...(options.sessionId === undefined
        ? {}
        : { session_id: options.sessionId }),
      cwd: options.cwd ?? '/work/app',
      originator: 'codex_cli',
      source:
        spawn === undefined ? 'cli' : { subagent: { thread_spawn: spawn } },
      ...(options.branch === undefined
        ? {}
        : { git: { commit_hash: 'abc', branch: options.branch } }),
      ...(options.historyStart === undefined
        ? {}
        : { subagent_history_start_ordinal: options.historyStart }),
    },
  };
}

export function turnContext(at: number, model: string): Line {
  return {
    timestamp: minute(at),
    type: 'turn_context',
    payload: { cwd: '/work/app', model },
  };
}

export function event(at: number, payload: Record<string, unknown>): Line {
  return { timestamp: minute(at), type: 'event_msg', payload };
}

export function item(at: number, payload: Record<string, unknown>): Line {
  return { timestamp: minute(at), type: 'response_item', payload };
}

export interface Tokens {
  input: number;
  cached?: number;
  cacheWrite?: number;
  output: number;
}

function usage(tokens: Tokens): Record<string, unknown> {
  return {
    input_tokens: tokens.input,
    cached_input_tokens: tokens.cached ?? 0,
    ...(tokens.cacheWrite === undefined
      ? {}
      : { cache_write_input_tokens: tokens.cacheWrite }),
    output_tokens: tokens.output,
    reasoning_output_tokens: 1,
    total_tokens: tokens.input + tokens.output,
  };
}

export function usageRecord(
  at: number,
  responseId: string,
  tokens: Tokens,
): Line {
  return {
    timestamp: minute(at),
    type: 'token_usage_record',
    payload: { response_id: responseId, usage: usage(tokens) },
  };
}

export function tokenCount(at: number, total: Tokens, last: Tokens): Line {
  return event(at, {
    type: 'token_count',
    info: { total_token_usage: usage(total), last_token_usage: usage(last) },
  });
}

export function taskStarted(at: number): Line {
  return event(at, { type: 'task_started', turn_id: `turn-${String(at)}` });
}

export function taskComplete(at: number, message: string): Line {
  return event(at, { type: 'task_complete', last_agent_message: message });
}

export function userMessage(at: number): Line {
  return event(at, { type: 'user_message', message: 'Synthetic prompt' });
}

export function userItem(at: number, id: string): Line {
  return event(at, {
    type: 'item_completed',
    item: { type: 'UserMessage', id, content: [] },
  });
}

export function shellCall(at: number, callId: string, command: string[]): Line {
  return item(at, {
    type: 'function_call',
    name: 'shell',
    call_id: callId,
    arguments: JSON.stringify({ command }),
  });
}

export function shellOutput(
  at: number,
  callId: string,
  exitCode: number,
): Line {
  return item(at, {
    type: 'function_call_output',
    call_id: callId,
    output: JSON.stringify({ output: '', metadata: { exit_code: exitCode } }),
  });
}

export function execEnd(
  at: number,
  callId: string,
  command: string[],
  exitCode: number,
): Line {
  return event(at, {
    type: 'exec_command_end',
    call_id: callId,
    command,
    exit_code: exitCode,
  });
}

export function commandItem(
  at: number,
  id: string,
  command: string[],
  exitCode: number,
): Line {
  return event(at, {
    type: 'item_completed',
    item: {
      type: 'CommandExecution',
      id,
      command,
      status: exitCode === 0 ? 'completed' : 'failed',
      exit_code: exitCode,
    },
  });
}

export function failedMcpCall(at: number, id: string): Line {
  return event(at, {
    type: 'item_completed',
    item: {
      type: 'McpToolCall',
      id,
      server: 'docs',
      tool: 'search',
      status: 'completed',
      result: { content: [], isError: true },
    },
  });
}

export function compacted(at: number): Line {
  return { timestamp: minute(at), type: 'compacted', payload: { message: '' } };
}

export function chunkOf(
  lines: readonly (Record<string, unknown> | string)[],
): Buffer {
  return Buffer.from(
    `${lines
      .map((line) => (typeof line === 'string' ? line : JSON.stringify(line)))
      .join('\n')}\n`,
  );
}

export interface ReadChunk {
  rows: CodexRows;
  span: Span;
  main: TurnState;
  state: CodexState;
  skipped: number;
}

export function readLines(
  lines: readonly (Record<string, unknown> | string)[],
  options: {
    historyStart?: number;
    subAgentId?: string;
    state?: CodexState;
  } = {},
): ReadChunk {
  const { records, skipped } = parseLines(chunkOf(lines), parseCodexRecord);
  const span: Span = { firstAt: null, lastAt: null };
  const main: TurnState = {
    lastStopReason: null,
    userAfterLastAssistant: false,
    lastUserInterrupted: false,
  };
  const state = options.state ?? codexState(undefined);
  const rows = readCodexChunk(records, {
    source: {
      sourcePath: '/logs/rollout-a.jsonl',
      sessionId: 'root',
      subAgentId: options.subAgentId ?? null,
      startOffset: 0,
      historyStart: options.historyStart ?? null,
    },
    state,
    span,
    main: options.subAgentId === undefined ? main : undefined,
  });
  return { rows, span, main, state, skipped };
}

export function keyKind(key: string): string {
  return key.startsWith(TOKEN_COUNT_KEY) ? TOKEN_COUNT_KEY : key;
}

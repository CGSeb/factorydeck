import { appendFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/** Synthetic Claude Code session logs, written under a temporary sessions folder. */

const START = Date.UTC(2026, 0, 5, 9, 0, 0);

/** ISO time `minute` minutes after a fixed start. */
export function minute(value: number): string {
  return new Date(START + value * 60_000).toISOString();
}

export async function sessionsFolder(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'factorydeck-logs-'));
}

export type Line = Record<string, unknown> | string;

function serialize(lines: readonly Line[]): string {
  return lines
    .map((line) => (typeof line === 'string' ? line : JSON.stringify(line)))
    .join('\n');
}

/** Writes a log; `trailingNewline: false` leaves its last line unfinished. */
export async function writeLog(
  path: string,
  lines: readonly Line[],
  { trailingNewline = true }: { trailingNewline?: boolean } = {},
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, serialize(lines) + (trailingNewline ? '\n' : ''));
}

export async function appendLog(
  path: string,
  lines: readonly Line[],
): Promise<void> {
  await appendFile(path, `${serialize(lines)}\n`);
}

interface Context {
  uuid: string;
  at: number;
  cwd?: string;
  gitBranch?: string;
  sidechain?: boolean;
  promptId?: string;
}

function context(ctx: Context): Record<string, unknown> {
  return {
    uuid: ctx.uuid,
    timestamp: minute(ctx.at),
    sessionId: 'synthetic',
    isSidechain: ctx.sidechain ?? false,
    ...(ctx.cwd === undefined ? {} : { cwd: ctx.cwd }),
    ...(ctx.gitBranch === undefined ? {} : { gitBranch: ctx.gitBranch }),
    ...(ctx.promptId === undefined ? {} : { promptId: ctx.promptId }),
  };
}

export function userText(
  ctx: Context,
  text: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    type: 'user',
    ...context(ctx),
    message: { role: 'user', content: text },
    ...extra,
  };
}

export function toolResult(ctx: Context): Record<string, unknown> {
  return {
    type: 'user',
    ...context(ctx),
    message: {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'toolu_x', content: 'ok' }],
    },
  };
}

export interface Call {
  requestId: string;
  model?: string;
  stopReason?: string | null;
  tokens?: [number, number, number, number];
  content?: Record<string, unknown>[];
}

export function assistant(ctx: Context, call: Call): Record<string, unknown> {
  const [input, cacheWrite, cacheRead, output] = call.tokens ?? [1, 2, 3, 4];
  return {
    type: 'assistant',
    ...context(ctx),
    requestId: call.requestId,
    message: {
      id: `msg_${call.requestId}`,
      role: 'assistant',
      model: call.model ?? 'claude-test-1',
      stop_reason: call.stopReason === undefined ? 'end_turn' : call.stopReason,
      content: call.content ?? [{ type: 'text', text: 'Done.' }],
      usage: {
        input_tokens: input,
        cache_creation_input_tokens: cacheWrite,
        cache_read_input_tokens: cacheRead,
        output_tokens: output,
      },
    },
  };
}

export function skillCall(skill: string): Record<string, unknown> {
  return {
    type: 'tool_use',
    id: `toolu_${skill}`,
    name: 'Skill',
    input: { skill },
  };
}

/** The record Claude Code writes with a skill's instructions after its slash command. */
export function skillInstructions(ctx: Context): Record<string, unknown> {
  return userText(ctx, '', {
    isMeta: true,
    message: {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Base directory for this skill: /skills/x\n\n# X',
        },
      ],
    },
  });
}

export function title(text: string): Record<string, unknown> {
  return { type: 'custom-title', customTitle: text, sessionId: 'synthetic' };
}

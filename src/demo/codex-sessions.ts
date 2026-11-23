import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

type Line = Record<string, unknown>;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const CODEX_DEMO_MODEL = 'gpt-codex-demo';
export const CODEX_BUILD_ID = '0c0de001-0000-4000-8000-000000000001';
export const CODEX_CHAT_ID = '0c0de002-0000-4000-8000-000000000002';
export const CODEX_WORKER_ID = '0c0de001-0000-4000-8000-0000000000a1';
export const CODEX_EXPLORER_ID = '0c0de001-0000-4000-8000-0000000000a2';
export const CODEX_WORK_ITEM = 12;
export const CODEX_BUILD_CALLS = 7;
export const CODEX_DEMO_CALLS = 9;

interface Thread {
  start: number;
  lines: Line[];
  responses: number;
  prefix: string;
}

function at(thread: Thread, minutes: number): string {
  return new Date(thread.start + minutes * MINUTE).toISOString();
}

function push(
  thread: Thread,
  minutes: number,
  type: string,
  payload: Line,
): void {
  thread.lines.push({ timestamp: at(thread, minutes), type, payload });
}

function respond(
  thread: Thread,
  minutes: number,
  [input, cached, output]: [number, number, number],
): void {
  thread.responses += 1;
  push(thread, minutes, 'token_usage_record', {
    response_id: `${thread.prefix}-resp-${String(thread.responses)}`,
    usage: {
      input_tokens: input,
      cached_input_tokens: cached,
      cache_write_input_tokens: 0,
      output_tokens: output,
      reasoning_output_tokens: Math.round(output / 3),
      total_tokens: input + output,
    },
  });
}

interface Spawn {
  parent: string;
  role: string;
  path: string;
}

function meta(
  thread: Thread,
  id: string,
  { cwd, branch, spawn }: { cwd: string; branch: string; spawn?: Spawn },
): void {
  push(thread, 0, 'session_meta', {
    id,
    session_id: spawn === undefined ? id : CODEX_BUILD_ID,
    cwd,
    originator: 'codex_cli',
    source:
      spawn === undefined
        ? 'cli'
        : {
            subagent: {
              thread_spawn: {
                parent_thread_id: spawn.parent,
                agent_role: spawn.role,
                agent_path: spawn.path,
              },
            },
          },
    git: { commit_hash: 'demo', branch },
  });
  push(thread, 0, 'turn_context', { cwd, model: CODEX_DEMO_MODEL });
}

function threadOf(start: number, prefix: string): Thread {
  return { start, lines: [], responses: 0, prefix };
}

function buildSession(now: number, cwd: string): Thread {
  const thread = threadOf(now - 3 * HOUR, 'codex-build');
  meta(thread, CODEX_BUILD_ID, {
    cwd,
    branch: `feat/${String(CODEX_WORK_ITEM)}-codex`,
  });
  push(thread, 1, 'event_msg', { type: 'task_started', turn_id: 'turn-1' });
  push(thread, 1, 'event_msg', {
    type: 'user_message',
    message: 'Build the issue',
  });
  respond(thread, 2, [42_000, 30_000, 1_800]);
  const command = ['pnpm', 'test'];
  push(thread, 3, 'response_item', {
    type: 'function_call',
    name: 'shell',
    call_id: 'call-demo-test',
    arguments: JSON.stringify({ command }),
  });
  push(thread, 4, 'event_msg', {
    type: 'exec_command_end',
    call_id: 'call-demo-test',
    command,
    exit_code: 1,
  });
  respond(thread, 5, [51_000, 44_000, 2_400]);
  respond(thread, 40, [64_000, 58_000, 3_100]);
  push(thread, 41, 'event_msg', {
    type: 'task_complete',
    last_agent_message: `Tests pass now.\n\nWork item: #${String(CODEX_WORK_ITEM)} (builder)`,
  });
  return thread;
}

function subAgent(
  now: number,
  cwd: string,
  id: string,
  spawn: { role: string; path: string; startsAfter: number; calls: number },
): Thread {
  const thread = threadOf(now - 3 * HOUR + spawn.startsAfter, id);
  meta(thread, id, {
    cwd,
    branch: `feat/${String(CODEX_WORK_ITEM)}-codex`,
    spawn: { parent: CODEX_BUILD_ID, role: spawn.role, path: spawn.path },
  });
  for (let call = 1; call <= spawn.calls; call += 1) {
    respond(thread, call * 4, [18_000, 12_000, 900]);
  }
  return thread;
}

function chatSession(now: number, cwd: string): Thread {
  const thread = threadOf(now - DAY - 5 * HOUR, 'codex-chat');
  meta(thread, CODEX_CHAT_ID, { cwd, branch: 'main' });
  push(thread, 1, 'event_msg', { type: 'task_started', turn_id: 'turn-1' });
  push(thread, 1, 'event_msg', {
    type: 'item_completed',
    item: { type: 'UserMessage', id: 'demo-prompt-1', content: [] },
  });
  respond(thread, 2, [24_000, 16_000, 700]);
  push(thread, 20, 'compacted', { message: '' });
  respond(thread, 21, [9_000, 2_000, 400]);
  push(thread, 22, 'event_msg', {
    type: 'task_complete',
    last_agent_message: 'The import code lives in the parser module.',
  });
  return thread;
}

function rolloutPath(folder: string, start: number, id: string): string {
  const date = new Date(start).toISOString();
  return join(
    folder,
    date.slice(0, 4),
    date.slice(5, 7),
    date.slice(8, 10),
    `rollout-${date.slice(0, 19).replaceAll(':', '-')}-${id}.jsonl`,
  );
}

export async function writeDemoCodexSessions(
  folder: string,
  now: Date,
  cwd: string,
): Promise<void> {
  const time = now.getTime();
  const rollouts: [string, Thread][] = [
    [CODEX_BUILD_ID, buildSession(time, cwd)],
    [
      CODEX_WORKER_ID,
      subAgent(time, cwd, CODEX_WORKER_ID, {
        role: 'worker',
        path: '/root/build_worker',
        startsAfter: 6 * MINUTE,
        calls: 3,
      }),
    ],
    [
      CODEX_EXPLORER_ID,
      subAgent(time, cwd, CODEX_EXPLORER_ID, {
        role: 'explorer',
        path: '/root/find_code',
        startsAfter: 7 * MINUTE,
        calls: 1,
      }),
    ],
    [CODEX_CHAT_ID, chatSession(time, cwd)],
  ];
  for (const [id, thread] of rollouts) {
    const path = rolloutPath(folder, thread.start, id);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(
      path,
      `${thread.lines.map((line) => JSON.stringify(line)).join('\n')}\n`,
    );
  }
}

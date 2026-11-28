import { type LogRecord, isObject, timestampOf } from './records.ts';

export const CODEX = 'codex';

export const CODEX_SHELL_TOOLS: ReadonlySet<string> = new Set([
  'shell',
  'exec_command',
]);

export const CODEX_RECORD_TYPES: ReadonlySet<string> = new Set([
  'session_meta',
  'response_item',
  'event_msg',
  'turn_context',
  'compacted',
  'token_usage_record',
  'world_state',
  'inter_agent_communication_metadata',
]);

export interface CodexMeta {
  id: string;
  cwd: string | null;
  gitBranch: string;
  sessionId: string | null;
  parentThreadId: string | null;
  agentRole: string;
  agentPath: string;
  historyStart: number | null;
  firstAt: Date | undefined;
}

export function parseCodexRecord(line: string): LogRecord | undefined {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (!isObject(value)) return undefined;
  const type = value['type'];
  return typeof type === 'string' && CODEX_RECORD_TYPES.has(type)
    ? { ...value, type }
    : undefined;
}

function field(value: unknown, ...path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!isObject(current)) return undefined;
    current = current[key];
  }
  return current;
}

function textAt(value: unknown, ...path: string[]): string | null {
  const found = field(value, ...path);
  return typeof found === 'string' && found !== '' ? found : null;
}

export function codexMetaOf(record: LogRecord): CodexMeta | undefined {
  if (record.type !== 'session_meta') return undefined;
  const payload = record['payload'];
  const id = textAt(payload, 'id');
  if (id === null) return undefined;
  const spawn = field(payload, 'source', 'subagent', 'thread_spawn');
  const ordinal = field(payload, 'subagent_history_start_ordinal');
  return {
    id,
    cwd: textAt(payload, 'cwd'),
    gitBranch: textAt(payload, 'git', 'branch') ?? '',
    sessionId: textAt(payload, 'session_id'),
    parentThreadId: textAt(spawn, 'parent_thread_id'),
    agentRole: textAt(spawn, 'agent_role') ?? '',
    agentPath: textAt(spawn, 'agent_path') ?? '',
    historyStart:
      typeof ordinal === 'number' && Number.isInteger(ordinal) ? ordinal : null,
    firstAt: timestampOf(record),
  };
}

import type { FrictionRow } from './friction-rows.ts';
import type { ToolCall } from './frictions.ts';
import { type LogRecord, type TurnState, isObject } from './records.ts';
import type {
  ApiCallRow,
  ClosingLineRow,
  Span,
  UserPromptRow,
} from './thread.ts';

/** What the reader of a rollout carries from one run to the next, with the file's offset. */
export interface CodexState {
  lines: number;
  model: string;
  usageRecords: boolean;
  lastTotal: string | null;
}

export function codexState(value: unknown): CodexState {
  const stored = isObject(value) ? value : {};
  const lines = stored['lines'];
  const model = stored['model'];
  const lastTotal = stored['lastTotal'];
  return {
    lines: typeof lines === 'number' ? lines : 0,
    model: typeof model === 'string' ? model : '',
    usageRecords: stored['usageRecords'] === true,
    lastTotal: typeof lastTotal === 'string' ? lastTotal : null,
  };
}

export interface CodexSource {
  sourcePath: string;
  sessionId: string;
  subAgentId: string | null;
  startOffset: number;
  historyStart: number | null;
}

export type FrictionBase = Pick<
  FrictionRow,
  'sourcePath' | 'recordUuid' | 'position' | 'sessionId' | 'subAgentId' | 'at'
>;

export interface PendingOutput {
  base: FrictionBase;
  callId: string;
  output: unknown;
}

export interface CodexRows {
  calls: ApiCallRow[];
  prompts: UserPromptRow[];
  closingLines: ClosingLineRow[];
  frictions: FrictionRow[];
  toolCalls: Map<string, ToolCall>;
  outputs: PendingOutput[];
  /** The file's calls read from `token_count` before its first `token_usage_record`, to delete. */
  dropTokenCountCalls: boolean;
  skipped: number;
  firstModel: string;
}

export function emptyRows(): CodexRows {
  return {
    calls: [],
    prompts: [],
    closingLines: [],
    frictions: [],
    toolCalls: new Map(),
    outputs: [],
    dropTokenCountCalls: false,
    skipped: 0,
    firstModel: '',
  };
}

export interface Reading {
  source: CodexSource;
  state: CodexState;
  rows: CodexRows;
  span: Span;
  main: TurnState | undefined;
  frictionKeys: Set<string>;
  callKeys: Set<string>;
}

export interface Entry {
  record: LogRecord;
  payload: unknown;
  at: Date;
  position: number;
  inherited: boolean;
}

export function field(value: unknown, ...path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!isObject(current)) return undefined;
    current = current[key];
  }
  return current;
}

export function textAt(value: unknown, ...path: string[]): string | undefined {
  const found = field(value, ...path);
  return typeof found === 'string' ? found : undefined;
}

export function eventType(entry: Entry): string | undefined {
  return entry.record.type === 'event_msg'
    ? textAt(entry.payload, 'type')
    : undefined;
}

export function offsetKey(entry: Entry): string {
  return `offset:${String(entry.position)}`;
}

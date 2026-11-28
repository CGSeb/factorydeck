import { readFriction } from './codex-frictions.ts';
import {
  type CodexRows,
  type CodexSource,
  type CodexState,
  type Entry,
  type Reading,
  emptyRows,
  eventType,
  offsetKey,
  textAt,
} from './codex-reading.ts';
import { readModel, readUsage } from './codex-usage.ts';
import type { KnownCall } from './frictions.ts';
import {
  type LogRecord,
  type TurnState,
  closingLineOfText,
  timestampOf,
} from './records.ts';
import type { Span } from './thread.ts';

export {
  type CodexRows,
  type CodexState,
  codexState,
} from './codex-reading.ts';
export { codexFrictionRows, codexToolCalls } from './codex-frictions.ts';
export { TOKEN_COUNT_KEY } from './codex-usage.ts';

function promptOf(reading: Reading, entry: Entry, recordUuid: string): void {
  reading.rows.prompts.push({
    sourcePath: reading.source.sourcePath,
    sessionId: reading.source.sessionId,
    at: entry.at,
    recordUuid,
    promptId: null,
    command: null,
  });
}

function taskComplete(reading: Reading, entry: Entry, main: TurnState): void {
  Object.assign(main, {
    lastStopReason: 'end_turn',
    userAfterLastAssistant: false,
    lastUserInterrupted: false,
  } satisfies TurnState);
  const message = textAt(entry.payload, 'last_agent_message');
  const line = message === undefined ? undefined : closingLineOfText(message);
  if (line === undefined) return;
  reading.rows.closingLines.push({
    sourcePath: reading.source.sourcePath,
    sessionId: reading.source.sessionId,
    at: entry.at,
    recordUuid: offsetKey(entry),
    position: entry.position,
    line,
  });
}

const MAIN_EVENTS: ReadonlyMap<
  string,
  (reading: Reading, entry: Entry, main: TurnState) => void
> = new Map([
  [
    'user_message',
    (reading: Reading, entry: Entry) => {
      promptOf(reading, entry, offsetKey(entry));
    },
  ],
  [
    'item_completed',
    (reading: Reading, entry: Entry) => {
      if (textAt(entry.payload, 'item', 'type') !== 'UserMessage') return;
      const id = textAt(entry.payload, 'item', 'id');
      promptOf(
        reading,
        entry,
        id === undefined ? offsetKey(entry) : `item:${id}`,
      );
    },
  ],
  [
    'task_started',
    (_reading: Reading, _entry: Entry, main: TurnState) => {
      Object.assign(main, {
        lastStopReason: null,
        userAfterLastAssistant: false,
        lastUserInterrupted: false,
      } satisfies TurnState);
    },
  ],
  ['task_complete', taskComplete],
]);

function readMain(reading: Reading, entry: Entry): void {
  const type = eventType(entry);
  if (reading.main === undefined || type === undefined) return;
  MAIN_EVENTS.get(type)?.(reading, entry, reading.main);
}

function widen(span: Span, at: Date): void {
  if (span.firstAt === null || at < span.firstAt) span.firstAt = at;
  if (span.lastAt === null || at > span.lastAt) span.lastAt = at;
}

export interface CodexChunk {
  source: CodexSource;
  state: CodexState;
  span: Span;
  main: TurnState | undefined;
  toolCalls?: ReadonlyMap<string, KnownCall>;
}

export function readCodexChunk(
  records: readonly { record: LogRecord; offset: number; line: number }[],
  { source, state, span, main, toolCalls }: CodexChunk,
): CodexRows {
  const rows = emptyRows();
  for (const [id, call] of toolCalls ?? []) rows.toolCalls.set(id, call);
  const reading: Reading = {
    source,
    state,
    span,
    main,
    rows,
    frictionKeys: new Set(),
    callKeys: new Set(),
  };
  for (const { record, offset, line } of records) {
    const at = timestampOf(record);
    if (at === undefined) {
      reading.rows.skipped += 1;
      continue;
    }
    const lineNumber = state.lines + line;
    const entry: Entry = {
      record,
      payload: record['payload'],
      at,
      position: source.startOffset + offset,
      inherited:
        source.historyStart !== null &&
        lineNumber > 0 &&
        lineNumber < source.historyStart,
    };
    readModel(reading, entry);
    readUsage(reading, entry);
    if (entry.inherited) continue;
    widen(span, at);
    readMain(reading, entry);
    readFriction(reading, entry);
  }
  return reading.rows;
}

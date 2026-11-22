import type { friction } from '../db/schema.ts';
import {
  CLAUDE_CODE,
  type FrictionFields,
  type ToolCall,
  compactionOf,
  stopBlockedOf,
  toolCallsOf,
  toolErrorFields,
  toolErrorsOf,
} from './frictions.ts';
import { type LogRecord, stringOf, timestampOf } from './records.ts';

export type FrictionRow = typeof friction.$inferInsert;

export interface FrictionSource {
  sourcePath: string;
  sessionId: string;
  subAgentId: string | null;
  home: string;
}

type RowBase = Pick<
  FrictionRow,
  'sourcePath' | 'recordUuid' | 'position' | 'sessionId' | 'subAgentId' | 'at'
>;

interface PendingToolError {
  base: RowBase;
  toolUseId: string;
  text: string;
}

export interface FrictionCollector {
  frictions: FrictionRow[];
  toolErrors: PendingToolError[];
  toolCalls: Map<string, ToolCall>;
  untimed: number;
}

export function frictionCollector(): FrictionCollector {
  return { frictions: [], toolErrors: [], toolCalls: new Map(), untimed: 0 };
}

const EMPTY_FIELDS = {
  tool: null,
  category: null,
  program: null,
  exitCode: null,
  commandHash: null,
  hookCommand: null,
  trigger: null,
  preTokens: null,
  postTokens: null,
} satisfies Partial<FrictionRow>;

function rowOf(base: RowBase, fields: FrictionFields): FrictionRow {
  return { ...base, ...EMPTY_FIELDS, ...fields, agent: CLAUDE_CODE };
}

export interface FrictionRecord {
  record: LogRecord;
  recordUuid: string;
  at: Date | undefined;
}

export function collectFrictions(
  collector: FrictionCollector,
  source: FrictionSource,
  { record, recordUuid, at }: FrictionRecord,
): void {
  for (const [id, call] of toolCallsOf(record)) {
    collector.toolCalls.set(id, call);
  }
  const errors = toolErrorsOf(record);
  const stops = stopBlockedOf(record, source.home);
  const compaction = compactionOf(record);
  const found =
    errors.length + stops.length + (compaction === undefined ? 0 : 1);
  if (found === 0) return;
  if (at === undefined) {
    if (record.type === 'system') collector.untimed += 1;
    return;
  }
  const base = (position: number): RowBase => ({
    sourcePath: source.sourcePath,
    sessionId: source.sessionId,
    subAgentId: source.subAgentId,
    recordUuid,
    position,
    at,
  });
  for (const error of errors) {
    collector.toolErrors.push({
      base: base(error.position),
      toolUseId: error.toolUseId,
      text: error.text,
    });
  }
  stops.forEach((fields, position) => {
    collector.frictions.push(rowOf(base(position), fields));
  });
  if (compaction !== undefined) {
    collector.frictions.push(rowOf(base(0), compaction));
  }
}

export function unresolvedToolCalls(collector: FrictionCollector): boolean {
  return collector.toolErrors.some(
    (error) => !collector.toolCalls.has(error.toolUseId),
  );
}

/** Every friction collected, each tool error named after its call, or `unknown`. */
export function frictionRows(
  collector: FrictionCollector,
  earlierCalls: ReadonlyMap<string, ToolCall> = new Map(),
): FrictionRow[] {
  return [
    ...collector.frictions,
    ...collector.toolErrors.map(({ base, toolUseId, text }) =>
      rowOf(
        base,
        toolErrorFields(
          text,
          collector.toolCalls.get(toolUseId) ?? earlierCalls.get(toolUseId),
        ),
      ),
    ),
  ];
}

export function toolCallsOfRecords(
  records: readonly { record: LogRecord }[],
): Map<string, ToolCall> {
  return new Map(records.flatMap(({ record }) => toolCallsOf(record)));
}

/** The frictions of records read on their own, without the other rows of their thread. */
export function readFrictions(
  records: readonly { record: LogRecord; offset: number }[],
  source: FrictionSource,
  startOffset: number,
): FrictionCollector {
  const collector = frictionCollector();
  for (const { record, offset } of records) {
    collectFrictions(collector, source, {
      record,
      recordUuid: recordUuidOf(record, startOffset + offset),
      at: timestampOf(record),
    });
  }
  return collector;
}

export function recordUuidOf(record: LogRecord, position: number): string {
  return stringOf(record, 'uuid') ?? `offset:${String(position)}`;
}

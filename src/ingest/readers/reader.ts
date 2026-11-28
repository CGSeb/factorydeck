import {
  type BatchThread,
  MAX_READER_STATE_BYTES,
  type ReaderState,
  isReaderState,
} from '../../cli-ingest/batch.ts';
import type { CallSummary, KnownCall } from '../frictions.ts';
import type { FrictionRow } from '../friction-rows.ts';
import { type TurnState, isObject } from '../records.ts';
import type {
  ApiCallRow,
  ClosingLineRow,
  SkillLaunchRow,
  UserPromptRow,
} from '../thread.ts';

export { MAX_READER_STATE_BYTES };
export const MAX_PENDING_CALLS = 50;

export interface LogIdentity {
  sessionId: string;
  subAgentId: string | null;
}

export interface ReaderInput {
  bytes: Uint8Array;
  from: number;
  readerState: unknown;
  home: string;
}

export type ReaderThread = Omit<BatchThread, 'remote' | 'frictions'>;

export type ReaderFriction = Omit<
  FrictionRow,
  'sourcePath' | 'sessionId' | 'subAgentId' | 'agent' | 'at' | 'recordUuid'
> & { recordId: string; at: string };

export type ReadResult =
  | {
      status: 'read';
      thread: ReaderThread;
      frictions: ReaderFriction[];
      readTo: number;
      readerState: ReaderState;
      skipped: number;
      untimed: number;
    }
  | { status: 'restart' };

export interface PendingCall extends CallSummary {
  id: string;
}

export function jsonState(state: unknown): ReaderState {
  return isReaderState(state) ? state : null;
}

export function isoOf(date: Date | null): string | null {
  return date === null ? null : date.toISOString();
}

export function dateOf(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

export function bufferOf(bytes: Uint8Array): Buffer {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

export function readerFrictions(
  rows: readonly FrictionRow[],
): ReaderFriction[] {
  return rows.map(
    ({
      sourcePath: _sourcePath,
      sessionId: _sessionId,
      subAgentId: _subAgentId,
      agent: _agent,
      recordUuid,
      at,
      ...fields
    }) => ({ ...fields, recordId: recordUuid, at: at.toISOString() }),
  );
}

export function pendingCalls(
  before: readonly PendingCall[],
  seen: Iterable<[string, KnownCall]>,
  answered: ReadonlySet<string>,
  summarize: (call: KnownCall) => CallSummary,
): PendingCall[] {
  const calls = new Map(before.map((call) => [call.id, call]));
  for (const [id, call] of seen) {
    calls.delete(id);
    calls.set(id, { id, ...summarize(call) });
  }
  return [...calls.values()]
    .filter((call) => !answered.has(call.id))
    .slice(-MAX_PENDING_CALLS);
}

export function callMap(
  calls: readonly PendingCall[],
): Map<string, CallSummary> {
  return new Map(
    calls.map(({ id, name, program, commandHash }) => [
      id,
      { name, program, commandHash },
    ]),
  );
}

function text(value: unknown): value is string {
  return typeof value === 'string';
}

function textOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

export function isTurnState(value: unknown): value is TurnState {
  return (
    isObject(value) &&
    textOrNull(value['lastStopReason']) &&
    typeof value['userAfterLastAssistant'] === 'boolean' &&
    typeof value['lastUserInterrupted'] === 'boolean'
  );
}

export function isPendingCalls(value: unknown): value is PendingCall[] {
  return (
    Array.isArray(value) &&
    value.every(
      (call) =>
        isObject(call) &&
        text(call['id']) &&
        text(call['name']) &&
        textOrNull(call['program']) &&
        textOrNull(call['commandHash']),
    )
  );
}

export function isTextList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(text);
}

export { text as isText, textOrNull as isTextOrNull };

export function turnOfState(state: unknown): TurnState | undefined {
  const turn = isObject(state) ? state['turn'] : undefined;
  return isTurnState(turn) ? turn : undefined;
}

export function stateSize(state: unknown): number {
  return Buffer.byteLength(JSON.stringify(state), 'utf8');
}

export interface RecordRows {
  calls: readonly ApiCallRow[];
  launches: readonly SkillLaunchRow[];
  prompts: readonly UserPromptRow[];
  closingLines: readonly ClosingLineRow[];
}

export function batchRecords(
  rows: RecordRows,
): Pick<
  ReaderThread,
  'apiCalls' | 'skillLaunches' | 'prompts' | 'closingLines'
> {
  return {
    apiCalls: rows.calls.map((call) => ({
      requestKey: call.requestKey,
      at: call.at.toISOString(),
      model: call.model,
      inputTokens: call.inputTokens,
      cacheWriteTokens: call.cacheWriteTokens,
      cacheReadTokens: call.cacheReadTokens,
      outputTokens: call.outputTokens,
    })),
    skillLaunches: rows.launches.map((launch) => ({
      recordId: launch.recordUuid,
      at: launch.at.toISOString(),
      skill: launch.skill,
    })),
    prompts: rows.prompts.map((prompt) => ({
      recordId: prompt.recordUuid,
      at: prompt.at.toISOString(),
      promptId: prompt.promptId,
      command: prompt.command,
    })),
    closingLines: rows.closingLines.map((closing) => ({
      recordId: closing.recordUuid,
      at: closing.at.toISOString(),
      position: closing.position,
      line: closing.line,
    })),
  };
}

function fits(state: unknown): boolean {
  return stateSize(state) <= MAX_READER_STATE_BYTES;
}

export function fitCalls<T extends { toolCalls: PendingCall[] }>(state: T): T {
  let fitted = state;
  while (!fits(fitted) && fitted.toolCalls.length > 0) {
    fitted = { ...fitted, toolCalls: fitted.toolCalls.slice(1) };
  }
  return fitted;
}

export function fitList<T>(state: T, key: keyof T & string): T {
  let fitted = state;
  for (;;) {
    const list = fitted[key];
    if (fits(fitted) || !Array.isArray(list) || list.length === 0) {
      return fitted;
    }
    fitted = { ...fitted, [key]: list.slice(0, -1) };
  }
}

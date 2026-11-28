import type { CodexMeta } from '../codex-format.ts';
import { type TurnState, isObject } from '../records.ts';
import {
  type PendingCall,
  isPendingCalls,
  isText,
  isTextOrNull,
  isTurnState,
} from './reader.ts';

export const CODEX_STATE_VERSION = 1;

export interface CodexMetaState {
  id: string;
  sessionId: string;
  subAgentId: string | null;
  cwd: string | null;
  gitBranch: string;
  agentRole: string;
  agentPath: string;
  historyStart: number | null;
}

export interface CodexReaderState {
  v: typeof CODEX_STATE_VERSION;
  meta: CodexMetaState;
  lines: number;
  model: string;
  usageRecords: boolean;
  lastTotal: string | null;
  firstModel: string;
  turn: TurnState;
  firstAt: string | null;
  lastAt: string | null;
  toolCalls: PendingCall[];
}

export interface CodexLog {
  sessionId: string;
  subAgentId: string | null;
  cwd: string | null;
}

export function freshCodexState(
  log: CodexLog,
  meta: CodexMeta | undefined,
): CodexReaderState {
  return {
    v: CODEX_STATE_VERSION,
    meta: {
      id: meta?.id ?? log.subAgentId ?? log.sessionId,
      sessionId: log.sessionId,
      subAgentId: log.subAgentId,
      cwd: log.cwd,
      gitBranch: meta?.gitBranch ?? '',
      agentRole: meta?.agentRole ?? '',
      agentPath: meta?.agentPath ?? '',
      historyStart: meta?.historyStart ?? null,
    },
    lines: 0,
    model: '',
    usageRecords: false,
    lastTotal: null,
    firstModel: '',
    turn: {
      lastStopReason: null,
      userAfterLastAssistant: false,
      lastUserInterrupted: false,
    },
    firstAt: null,
    lastAt: null,
    toolCalls: [],
  };
}

function isWhole(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isMeta(value: unknown): value is CodexMetaState {
  return (
    isObject(value) &&
    isText(value['id']) &&
    isText(value['sessionId']) &&
    isTextOrNull(value['subAgentId']) &&
    isTextOrNull(value['cwd']) &&
    isText(value['gitBranch']) &&
    isText(value['agentRole']) &&
    isText(value['agentPath']) &&
    (value['historyStart'] === null || isWhole(value['historyStart']))
  );
}

type Totals = Pick<
  CodexReaderState,
  | 'lines'
  | 'model'
  | 'usageRecords'
  | 'lastTotal'
  | 'firstModel'
  | 'firstAt'
  | 'lastAt'
>;

function hasTotals(
  value: Record<string, unknown>,
): value is Record<string, unknown> & Totals {
  return (
    isWhole(value['lines']) &&
    isText(value['model']) &&
    typeof value['usageRecords'] === 'boolean' &&
    isTextOrNull(value['lastTotal']) &&
    isText(value['firstModel']) &&
    isTextOrNull(value['firstAt']) &&
    isTextOrNull(value['lastAt'])
  );
}

export function decodeCodexState(value: unknown): CodexReaderState | undefined {
  if (
    !isObject(value) ||
    value['v'] !== CODEX_STATE_VERSION ||
    !isMeta(value['meta']) ||
    !hasTotals(value) ||
    !isTurnState(value['turn']) ||
    !isPendingCalls(value['toolCalls'])
  ) {
    return undefined;
  }
  return {
    v: CODEX_STATE_VERSION,
    meta: value['meta'],
    lines: value.lines,
    model: value.model,
    usageRecords: value.usageRecords,
    lastTotal: value.lastTotal,
    firstModel: value.firstModel,
    turn: value['turn'],
    firstAt: value.firstAt,
    lastAt: value.lastAt,
    toolCalls: value['toolCalls'],
  };
}

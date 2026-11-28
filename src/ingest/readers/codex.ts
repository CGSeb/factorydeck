import { fileKeyOf } from '../../cli-ingest/batch.ts';
import { CODEX, codexMetaOf, parseCodexRecord } from '../codex-format.ts';
import { codexFrictionRows, readCodexChunk } from '../codex-records.ts';
import type { CodexRows } from '../codex-reading.ts';
import { callSummary } from '../frictions.ts';
import {
  type LogRecord,
  type TurnState,
  parseLines,
  turnEnded,
} from '../records.ts';
import type { Span } from '../thread.ts';
import {
  type CodexLog,
  type CodexReaderState,
  decodeCodexState,
  freshCodexState,
} from './codex-state.ts';
import {
  type ReadResult,
  type ReaderInput,
  type ReaderThread,
  batchRecords,
  bufferOf,
  callMap,
  dateOf,
  fitCalls,
  isoOf,
  jsonState,
  pendingCalls,
  readerFrictions,
} from './reader.ts';

export type { CodexLog } from './codex-state.ts';

export interface CodexInput extends ReaderInput {
  log: CodexLog;
}

function startState(
  input: CodexInput,
  first: LogRecord | undefined,
): CodexReaderState | undefined {
  if (input.from > 0) return decodeCodexState(input.readerState);
  return freshCodexState(
    input.log,
    first === undefined ? undefined : codexMetaOf(first),
  );
}

function threadFields(
  state: CodexReaderState,
  log: CodexLog,
): Pick<ReaderThread, 'session' | 'subAgent'> {
  const { meta } = state;
  if (log.subAgentId !== null) {
    return {
      subAgent: {
        toolUseId: '',
        agentType: meta.agentRole,
        description: meta.agentPath,
        model: state.firstModel,
        cwd: log.cwd,
        gitBranch: meta.gitBranch,
        firstAt: state.firstAt,
        lastAt: state.lastAt,
      },
    };
  }
  return {
    session: {
      cwd: log.cwd,
      gitBranch: meta.gitBranch,
      gitBranches: meta.gitBranch === '' ? [] : [meta.gitBranch],
      title: '',
      firstAt: state.firstAt,
      lastAt: state.lastAt,
      turnEnded: turnEnded(state.turn),
    },
  };
}

function nextState(
  before: CodexReaderState,
  rows: CodexRows,
  read: { span: Span; turn: TurnState; lines: number },
): CodexReaderState {
  const answered = new Set(rows.outputs.map((output) => output.callId));
  return {
    ...before,
    lines: before.lines + read.lines,
    firstModel: before.firstModel === '' ? rows.firstModel : before.firstModel,
    turn: read.turn,
    firstAt: isoOf(read.span.firstAt),
    lastAt: isoOf(read.span.lastAt),
    toolCalls: pendingCalls(
      before.toolCalls,
      rows.toolCalls,
      answered,
      (call) => callSummary(call),
    ),
  };
}

export function readCodexLog(input: CodexInput): ReadResult {
  const { log, from } = input;
  const parsed = parseLines(bufferOf(input.bytes), parseCodexRecord);
  const before = startState(input, parsed.records[0]?.record);
  if (before === undefined) return { status: 'restart' };
  const fileKey = fileKeyOf(CODEX, log.sessionId, log.subAgentId);
  const usage = {
    lines: before.lines,
    model: before.model,
    usageRecords: before.usageRecords,
    lastTotal: before.lastTotal,
  };
  const span: Span = {
    firstAt: dateOf(before.firstAt),
    lastAt: dateOf(before.lastAt),
  };
  const turn = { ...before.turn };
  const rows = readCodexChunk(parsed.records, {
    source: {
      sourcePath: fileKey,
      sessionId: log.sessionId,
      subAgentId: log.subAgentId,
      startOffset: from,
      historyStart: before.meta.historyStart,
    },
    state: usage,
    span,
    main: log.subAgentId === null ? turn : undefined,
    toolCalls: callMap(before.toolCalls),
  });
  if (rows.dropTokenCountCalls && from > 0) return { status: 'restart' };
  const state = fitCalls({
    ...nextState(before, rows, { span, turn, lines: parsed.lines }),
    model: usage.model,
    usageRecords: usage.usageRecords,
    lastTotal: usage.lastTotal,
  });
  const readTo = from + parsed.consumed;
  const readerState = jsonState(state);
  return {
    status: 'read',
    thread: {
      fileKey,
      agent: CODEX,
      sessionId: log.sessionId,
      subAgentId: log.subAgentId,
      from,
      readTo,
      readerState,
      ...threadFields(state, log),
      ...batchRecords({ ...rows, launches: [] }),
    },
    frictions: readerFrictions(codexFrictionRows(rows)),
    readTo,
    readerState,
    skipped: parsed.skipped,
    untimed: rows.skipped,
  };
}

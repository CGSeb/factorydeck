import { fileKeyOf } from '../../cli-ingest/batch.ts';
import {
  CLAUDE_CODE,
  SHELL_TOOLS,
  callSummary,
  toolResultIdsOf,
} from '../frictions.ts';
import {
  type FrictionCollector,
  frictionRows,
  readFrictions,
} from '../friction-rows.ts';
import { type LogRecord, isObject, parseLines, turnEnded } from '../records.ts';
import {
  type MainThread,
  type Span,
  type ThreadRows,
  readThread,
} from '../thread.ts';
import {
  type ClaudeCodeState,
  decodeClaudeCodeState,
  freshClaudeCodeState,
} from './claude-code-state.ts';
import {
  type LogIdentity,
  type ReadResult,
  type ReaderInput,
  type ReaderThread,
  batchRecords,
  bufferOf,
  MAX_READER_STATE_BYTES,
  callMap,
  dateOf,
  fitCalls,
  fitList,
  isoOf,
  jsonState,
  pendingCalls,
  readerFrictions,
  stateSize,
} from './reader.ts';

export interface SubAgentMeta {
  toolUseId: string;
  agentType: string;
  description: string;
  model: string;
}

export interface ClaudeCodeInput extends ReaderInput {
  log: LogIdentity;
  meta?: SubAgentMeta | undefined;
}

const NO_META: SubAgentMeta = {
  toolUseId: '',
  agentType: '',
  description: '',
  model: '',
};

export function parseSubAgentMeta(text: string): SubAgentMeta | undefined {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!isObject(value)) return undefined;
  const textOf = (key: string): string => {
    const found = value[key];
    return typeof found === 'string' ? found : '';
  };
  return {
    toolUseId: textOf('toolUseId'),
    agentType: textOf('agentType'),
    description: textOf('description'),
    model: textOf('model'),
  };
}

function mainOf(state: ClaudeCodeState, fileKey: string, log: LogIdentity) {
  const { slash } = state;
  const main: MainThread = {
    ...state.turn,
    cwd: state.cwd,
    cwdFromMain: state.cwdFromMain,
    gitBranch: state.gitBranch,
    gitBranches: [...state.gitBranches],
    title: state.title,
    slash:
      slash === null
        ? null
        : {
            promptId: slash.promptId,
            launch: {
              sourcePath: fileKey,
              sessionId: log.sessionId,
              subAgentId: null,
              recordUuid: slash.recordId,
              at: new Date(slash.at),
              skill: slash.command,
            },
          },
  };
  return main;
}

interface Read {
  state: ClaudeCodeState;
  span: Span;
  main: MainThread | undefined;
  rows: ThreadRows;
  records: readonly { record: LogRecord }[];
}

function contextOf({ state, main, rows }: Read): Partial<ClaudeCodeState> {
  if (main === undefined) {
    return {
      cwd: state.cwd ?? rows.cwd,
      gitBranch: rows.gitBranch ?? state.gitBranch,
    };
  }
  const { slash } = main;
  return {
    turn: {
      lastStopReason: main.lastStopReason,
      userAfterLastAssistant: main.userAfterLastAssistant,
      lastUserInterrupted: main.lastUserInterrupted,
    },
    cwd: main.cwd,
    cwdFromMain: main.cwdFromMain,
    gitBranch: main.gitBranch,
    gitBranches: main.gitBranches,
    title: main.title,
    slash:
      slash === null
        ? null
        : {
            promptId: slash.promptId,
            recordId: slash.launch.recordUuid,
            at: slash.launch.at.toISOString(),
            command: slash.launch.skill,
          },
  };
}

function nextState(read: Read, collector: FrictionCollector): ClaudeCodeState {
  const answered = new Set(
    read.records.flatMap(({ record }) => toolResultIdsOf(record)),
  );
  return fitClaudeCodeState({
    ...read.state,
    ...contextOf(read),
    firstAt: isoOf(read.span.firstAt),
    lastAt: isoOf(read.span.lastAt),
    toolCalls: pendingCalls(
      read.state.toolCalls,
      collector.toolCalls,
      answered,
      (call) => callSummary(call, SHELL_TOOLS),
    ),
  });
}

function fitClaudeCodeState(state: ClaudeCodeState): ClaudeCodeState {
  const fitted = fitList(fitCalls(state), 'gitBranches');
  const over = stateSize(fitted) - MAX_READER_STATE_BYTES;
  return over > 0
    ? {
        ...fitted,
        title: fitted.title.slice(0, Math.max(0, fitted.title.length - over)),
      }
    : fitted;
}

function sessionFields(state: ClaudeCodeState): ReaderThread['session'] {
  return {
    cwd: state.cwd,
    gitBranch: state.gitBranch,
    gitBranches: state.gitBranches,
    title: state.title,
    firstAt: state.firstAt,
    lastAt: state.lastAt,
    turnEnded: turnEnded(state.turn),
  };
}

function subAgentFields(
  state: ClaudeCodeState,
  meta: SubAgentMeta | undefined,
): ReaderThread['subAgent'] {
  return {
    ...(meta ?? NO_META),
    cwd: state.cwd,
    gitBranch: state.gitBranch,
    firstAt: state.firstAt,
    lastAt: state.lastAt,
  };
}

export function readClaudeCodeLog(input: ClaudeCodeInput): ReadResult {
  const before =
    input.from === 0
      ? freshClaudeCodeState()
      : decodeClaudeCodeState(input.readerState);
  if (before === undefined) return { status: 'restart' };
  const { log, from } = input;
  const fileKey = fileKeyOf(CLAUDE_CODE, log.sessionId, log.subAgentId);
  const parsed = parseLines(bufferOf(input.bytes));
  const span: Span = {
    firstAt: dateOf(before.firstAt),
    lastAt: dateOf(before.lastAt),
  };
  const main =
    log.subAgentId === null ? mainOf(before, fileKey, log) : undefined;
  const source = { sourcePath: fileKey, ...log, startOffset: from };
  const rows = readThread(parsed.records, source, span, main);
  const collector = readFrictions(
    parsed.records,
    { ...source, home: input.home },
    from,
  );
  const state = nextState(
    { state: before, span, main, rows, records: parsed.records },
    collector,
  );
  const readTo = from + parsed.consumed;
  const readerState = jsonState(state);
  return {
    status: 'read',
    thread: {
      fileKey,
      agent: CLAUDE_CODE,
      ...log,
      from,
      readTo,
      readerState,
      ...(main === undefined
        ? { subAgent: subAgentFields(state, input.meta) }
        : { session: sessionFields(state) }),
      ...batchRecords(rows),
    },
    frictions: readerFrictions(
      frictionRows(collector, callMap(before.toolCalls)),
    ),
    readTo,
    readerState,
    skipped: parsed.skipped,
    untimed: rows.skipped + collector.untimed,
  };
}

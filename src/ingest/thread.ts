import {
  type apiCall,
  type skillLaunch,
  type userPrompt,
  UNASSIGNED_PROJECT,
} from '../db/schema.ts';
import {
  type LogRecord,
  type TurnState,
  isSidechain,
  isSlashSkillInstructions,
  isTypedPrompt,
  nextTurnState,
  skillCalls,
  slashCommandOf,
  stringOf,
  timestampOf,
  usageOf,
} from './records.ts';

export type ApiCallRow = typeof apiCall.$inferInsert;
export type SkillLaunchRow = typeof skillLaunch.$inferInsert;
export type UserPromptRow = typeof userPrompt.$inferInsert;

/** First and last record times of a session or a sub-agent. */
export interface Span {
  firstAt: Date | null;
  lastAt: Date | null;
}

/** What the main thread of a session tells about it, carried from one run to the next. */
export interface MainThread extends TurnState {
  project: string;
  cwd: string | null;
  cwdFromMain: boolean;
  gitBranch: string;
  title: string;
}

/** Where the records come from. */
export interface ThreadSource {
  sourcePath: string;
  sessionId: string;
  subAgentId: string | null;
  /** Byte offset of the chunk in the file, to name records without a `uuid`. */
  startOffset: number;
}

/** Rows to store for the records of one file. */
export interface ThreadRows {
  calls: ApiCallRow[];
  launches: SkillLaunchRow[];
  prompts: UserPromptRow[];
  /** Prompt ids of slash skill instructions whose prompt was read by an earlier run. */
  earlierSkillPrompts: string[];
  /** User and assistant records without a valid timestamp: skipped, and counted. */
  skipped: number;
  /** First working directory of the records, for a session whose main log has none. */
  cwd: string | null;
}

interface Entry {
  record: LogRecord;
  at: Date | undefined;
  uuid: string;
  base: { sourcePath: string; sessionId: string };
}

/** Record types that must carry a timestamp to be stored. */
const TIMED_TYPES: ReadonlySet<string> = new Set(['user', 'assistant']);

function nonEmpty(value: string | undefined): string | null {
  return value === undefined || value === '' ? null : value;
}

/**
 * Turns the records of a file into rows, widening `span` with their times. `main` is the
 * session's main thread state when the file is a main session log, updated in place.
 */
export function readThread(
  records: readonly { record: LogRecord; offset: number }[],
  source: ThreadSource,
  span: Span,
  main: MainThread | undefined,
): ThreadRows {
  const rows: ThreadRows = {
    calls: [],
    launches: [],
    prompts: [],
    earlierSkillPrompts: [],
    skipped: 0,
    cwd: null,
  };
  const commands = new Map<string, SkillLaunchRow>();
  for (const { record, offset } of records) {
    const entry: Entry = {
      record,
      at: timestampOf(record),
      uuid: stringOf(record, 'uuid') ?? `offset:${source.startOffset + offset}`,
      base: { sourcePath: source.sourcePath, sessionId: source.sessionId },
    };
    if (entry.at === undefined && TIMED_TYPES.has(record.type)) {
      rows.skipped += 1;
      continue;
    }
    rows.cwd ??= nonEmpty(stringOf(record, 'cwd'));
    collectAssistant(entry, source.subAgentId, span, rows);
    if (main !== undefined && !isSidechain(record)) {
      readMainRecord(main, entry, rows, commands);
    }
  }
  return rows;
}

function collectAssistant(
  { record, at, uuid, base }: Entry,
  subAgentId: string | null,
  span: Span,
  rows: ThreadRows,
): void {
  if (at === undefined) {
    return;
  }
  if (span.firstAt === null || at < span.firstAt) {
    span.firstAt = at;
  }
  if (span.lastAt === null || at > span.lastAt) {
    span.lastAt = at;
  }
  const usage = usageOf(record);
  if (usage !== undefined) {
    rows.calls.push({
      ...base,
      subAgentId,
      requestKey: usage.requestKey,
      at,
      model: usage.model,
      inputTokens: usage.input,
      cacheWriteTokens: usage.cacheWrite,
      cacheReadTokens: usage.cacheRead,
      outputTokens: usage.output,
    });
  }
  for (const skill of skillCalls(record)) {
    rows.launches.push({ ...base, subAgentId, recordUuid: uuid, at, skill });
  }
}

function readMainRecord(
  main: MainThread,
  entry: Entry,
  rows: ThreadRows,
  commands: Map<string, SkillLaunchRow>,
): void {
  const { record, at, uuid, base } = entry;
  readContext(main, record);
  Object.assign(main, nextTurnState(main, record));
  const promptId = stringOf(record, 'promptId') ?? null;
  if (at !== undefined && isTypedPrompt(record)) {
    const command = slashCommandOf(record) ?? null;
    rows.prompts.push({ ...base, recordUuid: uuid, at, promptId, command });
    if (command !== null && promptId !== null) {
      commands.set(promptId, {
        ...base,
        subAgentId: null,
        recordUuid: uuid,
        at,
        skill: command,
      });
    }
  }
  if (promptId !== null && isSlashSkillInstructions(record)) {
    const launch = commands.get(promptId);
    if (launch === undefined) {
      rows.earlierSkillPrompts.push(promptId);
    } else {
      rows.launches.push(launch);
      commands.delete(promptId);
    }
  }
}

function readContext(main: MainThread, record: LogRecord): void {
  if (record.type === 'custom-title') {
    main.title = stringOf(record, 'customTitle') ?? main.title;
    return;
  }
  const cwd = stringOf(record, 'cwd');
  if (cwd === undefined) {
    return;
  }
  if (!main.cwdFromMain && cwd !== '') {
    if (main.cwd !== cwd) {
      main.project = UNASSIGNED_PROJECT;
    }
    main.cwd = cwd;
    main.cwdFromMain = true;
  }
  main.gitBranch = stringOf(record, 'gitBranch') ?? '';
}

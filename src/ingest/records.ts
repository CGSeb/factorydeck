/** A parsed line of a Claude Code session log. */
export type LogRecord = Record<string, unknown> & { type: string };

/**
 * Record types Claude Code writes to its session logs. A line of another type is skipped and
 * counted, so a new format shows up in the summary instead of passing silently.
 */
export const KNOWN_RECORD_TYPES: ReadonlySet<string> = new Set([
  'user',
  'assistant',
  'system',
  'attachment',
  'summary',
  'custom-title',
  'agent-name',
  'last-prompt',
  'queue-operation',
  'file-history-snapshot',
  'file-history-delta',
  'atis-latch',
  'api-request',
  'api-request-shape',
  'api-request-blob',
  'tools-used',
  'cost-state',
  'mode',
  'pr-link',
  'relocated',
  'worktree-state',
]);

/** Stop reasons after which the assistant waits for the user. */
const ENDED_STOP_REASONS: ReadonlySet<string> = new Set([
  'end_turn',
  'stop_sequence',
  'max_tokens',
  'refusal',
]);

/** Model of the assistant records Claude Code writes itself, such as API errors. */
export const SYNTHETIC_MODEL = '<synthetic>';

const NEWLINE = 0x0a;

/** Records of the complete lines of a chunk; a last line without a newline is left unread. */
export function parseLines(chunk: Buffer): {
  records: { record: LogRecord; offset: number }[];
  skipped: number;
  consumed: number;
} {
  const consumed = chunk.lastIndexOf(NEWLINE) + 1;
  const records: { record: LogRecord; offset: number }[] = [];
  let skipped = 0;
  let start = 0;
  while (start < consumed) {
    const end = chunk.indexOf(NEWLINE, start);
    const line = chunk.toString('utf8', start, end).trim();
    if (line !== '') {
      const record = parseRecord(line);
      if (record === undefined) {
        skipped += 1;
      } else {
        records.push({ record, offset: start });
      }
    }
    start = end + 1;
  }
  return { records, skipped, consumed };
}

export function parseRecord(line: string): LogRecord | undefined {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (!isObject(value)) {
    return undefined;
  }
  const type = value['type'];
  return typeof type === 'string' && KNOWN_RECORD_TYPES.has(type)
    ? { ...value, type }
    : undefined;
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(
  value: Record<string, unknown>,
  key: string,
): string | undefined {
  const field = value[key];
  return typeof field === 'string' ? field : undefined;
}

function numberField(value: Record<string, unknown>, key: string): number {
  const field = value[key];
  return typeof field === 'number' && Number.isFinite(field) ? field : 0;
}

function message(record: LogRecord): Record<string, unknown> | undefined {
  const value = record['message'];
  return isObject(value) ? value : undefined;
}

function contentBlocks(record: LogRecord): Record<string, unknown>[] {
  const content = message(record)?.['content'];
  return Array.isArray(content) ? content.filter(isObject) : [];
}

/** Time of a record, if it has a valid one. */
export function timestampOf(record: LogRecord): Date | undefined {
  const value = stringField(record, 'timestamp');
  if (value === undefined) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function stringOf(record: LogRecord, key: string): string | undefined {
  return stringField(record, key);
}

/** Whether a record belongs to a sub-agent thread rather than the main one. */
export function isSidechain(record: LogRecord): boolean {
  return record['isSidechain'] === true;
}

/** Token usage of one API call, as written in the log. */
export interface Usage {
  requestKey: string;
  model: string;
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
}

/** The API call an assistant record reports, unless it has no usage or is synthetic. */
export function usageOf(record: LogRecord): Usage | undefined {
  if (record.type !== 'assistant') {
    return undefined;
  }
  const msg = message(record);
  const usage = msg?.['usage'];
  if (msg === undefined || !isObject(usage)) {
    return undefined;
  }
  const model = stringField(msg, 'model') ?? '';
  if (model === SYNTHETIC_MODEL) {
    return undefined;
  }
  const requestKey =
    stringField(record, 'requestId') ??
    stringField(msg, 'id') ??
    stringField(record, 'uuid');
  if (requestKey === undefined) {
    return undefined;
  }
  return {
    requestKey,
    model,
    input: numberField(usage, 'input_tokens'),
    cacheWrite: numberField(usage, 'cache_creation_input_tokens'),
    cacheRead: numberField(usage, 'cache_read_input_tokens'),
    output: numberField(usage, 'output_tokens'),
  };
}

/** Skill names of the `Skill` tool calls of an assistant record, as written in the call. */
export function skillCalls(record: LogRecord): string[] {
  if (record.type !== 'assistant') {
    return [];
  }
  return contentBlocks(record).flatMap((block) => {
    const input = block['input'];
    if (block['type'] !== 'tool_use' || block['name'] !== 'Skill') {
      return [];
    }
    const skill = isObject(input) ? stringField(input, 'skill') : undefined;
    return skill === undefined || skill === '' ? [] : [skill];
  });
}

function userText(record: LogRecord): string | undefined {
  const content = message(record)?.['content'];
  if (typeof content === 'string') {
    return content;
  }
  const blocks = contentBlocks(record);
  if (blocks.some((block) => block['type'] === 'tool_result')) {
    return undefined;
  }
  const texts = blocks.flatMap((block) =>
    block['type'] === 'text' && typeof block['text'] === 'string'
      ? [block['text']]
      : [],
  );
  return texts.length === 0 ? undefined : texts.join('\n');
}

const INTERRUPTION = '[Request interrupted by user';

/** Text Claude Code writes as a user record although nobody typed it. */
const GENERATED_PREFIXES = [
  INTERRUPTION,
  '<task-notification>',
  '<local-command-stdout>',
  '<local-command-stderr>',
  '<local-command-caveat>',
  '<bash-stdout>',
  '<bash-stderr>',
];

/** Whether a user record is the marker Claude Code writes when the user interrupts a turn. */
export function isInterruption(record: LogRecord): boolean {
  return (
    record.type === 'user' &&
    (userText(record)?.trimStart().startsWith(INTERRUPTION) ?? false)
  );
}

function hasImage(record: LogRecord): boolean {
  const blocks = contentBlocks(record);
  return (
    blocks.some((block) => block['type'] === 'image') &&
    !blocks.some((block) => block['type'] === 'tool_result')
  );
}

/** Whether a record is a prompt typed by the user in the main thread: text, or images alone. */
export function isTypedPrompt(record: LogRecord): boolean {
  if (
    record.type !== 'user' ||
    record['isMeta'] === true ||
    record['isCompactSummary'] === true ||
    isSidechain(record)
  ) {
    return false;
  }
  const text = userText(record)?.trimStart();
  if (text === undefined) {
    return hasImage(record);
  }
  return !GENERATED_PREFIXES.some((prefix) => text.startsWith(prefix));
}

const COMMAND_NAME = /<command-name>\/([^<\s]+)<\/command-name>/;

/** Name, without the `/`, of the slash command a typed prompt holds. */
export function slashCommandOf(record: LogRecord): string | undefined {
  const text = userText(record);
  return text === undefined ? undefined : COMMAND_NAME.exec(text)?.[1];
}

const SKILL_INSTRUCTIONS = 'Base directory for this skill:';

/**
 * Whether a record holds the instructions of a skill typed as a slash command. A `Skill` tool
 * call writes the same text, tagged with the tool call it answers.
 */
export function isSlashSkillInstructions(record: LogRecord): boolean {
  return (
    record.type === 'user' &&
    record['isMeta'] === true &&
    record['sourceToolUseID'] === undefined &&
    (userText(record)?.trimStart().startsWith(SKILL_INSTRUCTIONS) ?? false)
  );
}

/** What decides whether the last assistant turn of a main thread has ended. */
export interface TurnState {
  lastStopReason: string | null;
  userAfterLastAssistant: boolean;
  lastUserInterrupted: boolean;
}

/**
 * Whether a user record reaches the model as a new prompt: a typed prompt that is not a slash
 * command, or the instructions of a slash skill. Built-in commands and the records Claude Code
 * writes itself do not.
 */
function reopensTurn(record: LogRecord): boolean {
  return (
    (isTypedPrompt(record) && slashCommandOf(record) === undefined) ||
    isSlashSkillInstructions(record)
  );
}

/** The turn state after one more record of the main thread. */
export function nextTurnState(state: TurnState, record: LogRecord): TurnState {
  if (record.type === 'assistant') {
    const stopReason = message(record)?.['stop_reason'];
    return {
      ...state,
      lastStopReason: typeof stopReason === 'string' ? stopReason : null,
      userAfterLastAssistant: false,
      lastUserInterrupted: false,
    };
  }
  if (isInterruption(record)) {
    return { ...state, lastUserInterrupted: true };
  }
  if (reopensTurn(record)) {
    return {
      ...state,
      userAfterLastAssistant: true,
      lastUserInterrupted: false,
    };
  }
  return state;
}

/** Whether the last assistant turn has ended, by the rule of spec 002. */
export function turnEnded(state: TurnState): boolean {
  const assistantEnded =
    state.lastStopReason !== null &&
    ENDED_STOP_REASONS.has(state.lastStopReason) &&
    !state.userAfterLastAssistant;
  return assistantEnded || state.lastUserInterrupted;
}

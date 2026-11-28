export const PARSER_VERSION = 1;

export const AGENTS = ['claude-code', 'codex'] as const;
export type Agent = (typeof AGENTS)[number];

export const MAIN_THREAD = 'main';
export const MAX_READER_STATE_BYTES = 16_384;

export type ReaderState =
  | string
  | number
  | boolean
  | null
  | ReaderState[]
  | { [key: string]: ReaderState };

export function isReaderState(value: unknown): value is ReaderState {
  if (value === null || ['string', 'boolean'].includes(typeof value)) {
    return true;
  }
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isReaderState);
  return (
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.values(value).every(isReaderState)
  );
}

export function fileKeyOf(
  agent: string,
  sessionId: string,
  subAgentId: string | null,
): string {
  return `${agent}/${sessionId}/${subAgentId ?? MAIN_THREAD}`;
}

export interface BatchApiCall {
  requestKey: string;
  at: string;
  model: string;
  inputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
}

export interface BatchSkillLaunch {
  recordId: string;
  at: string;
  skill: string;
  subAgentId?: string | null | undefined;
}

export interface BatchPrompt {
  recordId: string;
  at: string;
  promptId: string | null;
  command: string | null;
}

export interface BatchClosingLine {
  recordId: string;
  at: string;
  position: number;
  line: string;
}

export type BatchToolErrorCategory =
  | 'permission-denied'
  | 'hook-blocked'
  | 'tool-misuse'
  | 'command-failed'
  | 'other';

interface FrictionBase {
  recordId: string;
  position: number;
  at: string;
}

type NotFor<K extends string> = { [key in K]?: null | undefined };

export type BatchToolError = FrictionBase & {
  kind: 'tool-error';
  tool: string;
  category: BatchToolErrorCategory;
  program: string | null;
  exitCode: number | null;
  commandHash: string | null;
} & NotFor<'hookCommand' | 'trigger' | 'preTokens' | 'postTokens'>;

export type BatchStopBlocked = FrictionBase & {
  kind: 'stop-blocked';
  hookCommand: string;
} & NotFor<
    | 'tool'
    | 'category'
    | 'program'
    | 'exitCode'
    | 'commandHash'
    | 'trigger'
    | 'preTokens'
    | 'postTokens'
  >;

export type BatchCompaction = FrictionBase & {
  kind: 'compaction';
  trigger: 'auto' | 'manual' | null;
  preTokens: number | null;
  postTokens: number | null;
} & NotFor<
    'tool' | 'category' | 'program' | 'exitCode' | 'commandHash' | 'hookCommand'
  >;

export type BatchFriction = BatchToolError | BatchStopBlocked | BatchCompaction;

export interface BatchSessionFields {
  cwd: string | null;
  gitBranch: string;
  gitBranches: string[];
  title: string;
  firstAt: string | null;
  lastAt: string | null;
  turnEnded: boolean;
}

export interface BatchSubAgentFields {
  toolUseId: string;
  agentType: string;
  description: string;
  model: string;
  cwd: string | null;
  gitBranch: string;
  firstAt: string | null;
  lastAt: string | null;
}

export interface BatchThread {
  fileKey: string;
  agent: Agent;
  sessionId: string;
  subAgentId: string | null;
  remote: string | null;
  from: number;
  readTo: number;
  readerState: ReaderState;
  session?: BatchSessionFields | undefined;
  subAgent?: BatchSubAgentFields | undefined;
  apiCalls: BatchApiCall[];
  skillLaunches: BatchSkillLaunch[];
  prompts: BatchPrompt[];
  closingLines: BatchClosingLine[];
  frictions: BatchFriction[];
}

export interface Batch {
  parserVersion: number;
  threads: BatchThread[];
}

export interface BatchCounts {
  sessions: number;
  threads: number;
  apiCalls: number;
}

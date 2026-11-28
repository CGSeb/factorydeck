import { type TurnState, isObject } from '../records.ts';
import {
  type PendingCall,
  isPendingCalls,
  isText,
  isTextList,
  isTextOrNull,
  isTurnState,
} from './reader.ts';

export const CLAUDE_CODE_STATE_VERSION = 1;

export interface SlashPrompt {
  promptId: string;
  recordId: string;
  at: string;
  command: string;
}

export interface ClaudeCodeState {
  v: typeof CLAUDE_CODE_STATE_VERSION;
  turn: TurnState;
  cwd: string | null;
  cwdFromMain: boolean;
  gitBranch: string;
  gitBranches: string[];
  title: string;
  firstAt: string | null;
  lastAt: string | null;
  toolCalls: PendingCall[];
  slash: SlashPrompt | null;
}

export function freshClaudeCodeState(): ClaudeCodeState {
  return {
    v: CLAUDE_CODE_STATE_VERSION,
    turn: {
      lastStopReason: null,
      userAfterLastAssistant: false,
      lastUserInterrupted: false,
    },
    cwd: null,
    cwdFromMain: false,
    gitBranch: '',
    gitBranches: [],
    title: '',
    firstAt: null,
    lastAt: null,
    toolCalls: [],
    slash: null,
  };
}

function isSlash(value: unknown): value is SlashPrompt | null {
  return (
    value === null ||
    (isObject(value) &&
      isText(value['promptId']) &&
      isText(value['recordId']) &&
      isText(value['at']) &&
      isText(value['command']))
  );
}

type Context = Pick<
  ClaudeCodeState,
  | 'cwd'
  | 'cwdFromMain'
  | 'gitBranch'
  | 'gitBranches'
  | 'title'
  | 'firstAt'
  | 'lastAt'
>;

function hasContext(
  value: Record<string, unknown>,
): value is Record<string, unknown> & Context {
  return (
    isTextOrNull(value['cwd']) &&
    typeof value['cwdFromMain'] === 'boolean' &&
    isText(value['gitBranch']) &&
    isTextList(value['gitBranches']) &&
    isText(value['title']) &&
    isTextOrNull(value['firstAt']) &&
    isTextOrNull(value['lastAt'])
  );
}

export function decodeClaudeCodeState(
  value: unknown,
): ClaudeCodeState | undefined {
  if (
    !isObject(value) ||
    value['v'] !== CLAUDE_CODE_STATE_VERSION ||
    !isTurnState(value['turn']) ||
    !hasContext(value) ||
    !isPendingCalls(value['toolCalls']) ||
    !isSlash(value['slash'])
  ) {
    return undefined;
  }
  return {
    v: CLAUDE_CODE_STATE_VERSION,
    turn: value['turn'],
    cwd: value.cwd,
    cwdFromMain: value.cwdFromMain,
    gitBranch: value.gitBranch,
    gitBranches: value.gitBranches,
    title: value.title,
    firstAt: value.firstAt,
    lastAt: value.lastAt,
    toolCalls: value['toolCalls'],
    slash: value['slash'],
  };
}

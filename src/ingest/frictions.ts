import { createHash } from 'node:crypto';
import { type LogRecord, isObject } from './records.ts';

export const CLAUDE_CODE = 'claude-code';

export const FRICTION_KINDS = [
  'tool-error',
  'stop-blocked',
  'compaction',
] as const;
export type FrictionKind = (typeof FRICTION_KINDS)[number];

export const TOOL_ERROR_CATEGORIES = [
  'permission-denied',
  'hook-blocked',
  'tool-misuse',
  'command-failed',
  'other',
] as const;
export type ToolErrorCategory = (typeof TOOL_ERROR_CATEGORIES)[number];

export const UNKNOWN_TOOL = 'unknown';

export const SHELL_TOOLS: ReadonlySet<string> = new Set(['Bash']);

export interface ToolCall {
  name: string;
  command: string | undefined;
}

export interface CallSummary {
  name: string;
  program: string | null;
  commandHash: string | null;
}

export type KnownCall = ToolCall | CallSummary;

export interface ToolErrorFields {
  kind: 'tool-error';
  tool: string;
  category: ToolErrorCategory;
  program: string | null;
  exitCode: number | null;
  commandHash: string | null;
}

export interface StopBlockedFields {
  kind: 'stop-blocked';
  hookCommand: string;
}

export interface CompactionFields {
  kind: 'compaction';
  trigger: string | null;
  preTokens: number | null;
  postTokens: number | null;
}

export type FrictionFields =
  ToolErrorFields | StopBlockedFields | CompactionFields;

export interface ToolErrorRef {
  position: number;
  toolUseId: string;
  text: string;
}

function contentBlocks(record: LogRecord): Record<string, unknown>[] {
  const message = record['message'];
  const content = isObject(message) ? message['content'] : undefined;
  return Array.isArray(content) ? content.filter(isObject) : [];
}

export function toolCallsOf(record: LogRecord): [string, ToolCall][] {
  if (record.type !== 'assistant') return [];
  return contentBlocks(record).flatMap((block): [string, ToolCall][] => {
    const id = block['id'];
    const name = block['name'];
    if (
      block['type'] !== 'tool_use' ||
      typeof id !== 'string' ||
      typeof name !== 'string'
    ) {
      return [];
    }
    const input = block['input'];
    const command = isObject(input) ? input['command'] : undefined;
    return [
      [
        id,
        { name, command: typeof command === 'string' ? command : undefined },
      ],
    ];
  });
}

export function resultText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter(isObject)
    .flatMap((block) =>
      block['type'] === 'text' && typeof block['text'] === 'string'
        ? [block['text']]
        : [],
    )
    .join('\n');
}

export function toolResultIdsOf(record: LogRecord): string[] {
  if (record.type !== 'user') return [];
  return contentBlocks(record).flatMap((block) => {
    const id = block['tool_use_id'];
    return block['type'] === 'tool_result' && typeof id === 'string'
      ? [id]
      : [];
  });
}

export function toolErrorsOf(record: LogRecord): ToolErrorRef[] {
  if (record.type !== 'user') return [];
  return contentBlocks(record).flatMap((block, position) => {
    if (block['type'] !== 'tool_result' || block['is_error'] !== true) {
      return [];
    }
    const id = block['tool_use_id'];
    return [
      {
        position,
        toolUseId: typeof id === 'string' ? id : '',
        text: resultText(block['content']),
      },
    ];
  });
}

const DENIED_PREFIXES = [
  'Permission for this action was denied',
  'Permission for this command was denied',
  "The user doesn't want to proceed with this tool use",
];
const HOOK_ERROR = /^[A-Za-z]+:\S+ hook error/;
const EXIT_CODE = /^Exit code (-?\d+)/;

function isDenied(text: string): boolean {
  return (
    DENIED_PREFIXES.some((prefix) => text.startsWith(prefix)) ||
    (text.startsWith('Permission to use ') &&
      text.includes('has been denied')) ||
    text.includes('was blocked by a deny rule')
  );
}

export function exitCodeOf(text: string): number | null {
  const match = EXIT_CODE.exec(text.trimStart());
  return match?.[1] === undefined ? null : Number(match[1]);
}

export function categoryOf(text: string, tool: string): ToolErrorCategory {
  const start = text.trimStart();
  if (isDenied(start)) return 'permission-denied';
  if (HOOK_ERROR.test(start)) return 'hook-blocked';
  if (start.startsWith('<tool_use_error>')) return 'tool-misuse';
  if (SHELL_TOOLS.has(tool) && exitCodeOf(start) !== null) {
    return 'command-failed';
  }
  return 'other';
}

const GROUPING: ReadonlySet<string> = new Set(['{', '}', '$']);
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=\S*$/;

export function programOf(command: string): string | null {
  for (const part of command.split(/&&|\|\||;|\||\n|\(|\)/)) {
    const words = part
      .trim()
      .split(/\s+/)
      .filter((word) => word !== '' && !GROUPING.has(word));
    const word = words.find((candidate) => !ASSIGNMENT.test(candidate));
    if (word === undefined || word === 'cd') continue;
    return word.split(/[\\/]/).findLast((segment) => segment !== '') ?? word;
  }
  return null;
}

export function commandHash(command: string): string {
  return createHash('sha256').update(command.trim()).digest('hex');
}

export function callSummary(
  call: KnownCall,
  shellTools?: ReadonlySet<string>,
): CallSummary {
  if (!('command' in call)) return call;
  const command =
    shellTools === undefined || shellTools.has(call.name)
      ? call.command
      : undefined;
  return {
    name: call.name,
    program: command === undefined ? null : programOf(command),
    commandHash: command === undefined ? null : commandHash(command),
  };
}

export function toolErrorFields(
  text: string,
  call: KnownCall | undefined,
): ToolErrorFields {
  const summary =
    call === undefined ? undefined : callSummary(call, SHELL_TOOLS);
  const tool = summary?.name ?? UNKNOWN_TOOL;
  const isShell = SHELL_TOOLS.has(tool);
  return {
    kind: 'tool-error',
    tool,
    category: categoryOf(text, tool),
    program: isShell ? (summary?.program ?? null) : null,
    exitCode: isShell ? exitCodeOf(text) : null,
    commandHash: isShell ? (summary?.commandHash ?? null) : null,
  };
}

function escapeRegExp(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function withHomeAsTilde(command: string, home: string): string {
  const root = home.replace(/\/+$/, '');
  if (root === '') return command;
  return command.replaceAll(
    new RegExp(`(?<![\\w.~/-])${escapeRegExp(root)}(?=/|$|[^\\w.-])`, 'g'),
    '~',
  );
}

function hookCommandOf(entry: unknown): string {
  if (typeof entry !== 'string' || !entry.startsWith('[')) return '';
  const labelled = entry.indexOf(']: ');
  const end = labelled === -1 ? entry.lastIndexOf(']') : labelled;
  return end === -1 ? '' : entry.slice(1, end);
}

export function stopBlockedOf(
  record: LogRecord,
  home: string,
): StopBlockedFields[] {
  if (record.type !== 'system' || record['subtype'] !== 'stop_hook_summary') {
    return [];
  }
  const errors = record['hookErrors'];
  if (!Array.isArray(errors)) return [];
  return errors.map((entry) => ({
    kind: 'stop-blocked',
    hookCommand: withHomeAsTilde(hookCommandOf(entry), home),
  }));
}

function tokens(metadata: Record<string, unknown>, key: string): number | null {
  const value = metadata[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function compactionOf(record: LogRecord): CompactionFields | undefined {
  if (record.type !== 'system' || record['subtype'] !== 'compact_boundary') {
    return undefined;
  }
  const value = record['compactMetadata'];
  const metadata = isObject(value) ? value : {};
  const trigger = metadata['trigger'];
  return {
    kind: 'compaction',
    trigger: typeof trigger === 'string' && trigger !== '' ? trigger : null,
    preTokens: tokens(metadata, 'preTokens'),
    postTokens: tokens(metadata, 'postTokens'),
  };
}

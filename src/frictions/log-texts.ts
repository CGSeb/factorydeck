import { stripVTControlCharacters } from 'node:util';
import { withHomeAsTilde } from '../ingest/frictions.ts';

export const MAX_TEXT_LENGTH = 300;
export const MAX_INPUT_LENGTH = 2000;
export const MAX_TEXT_LINES = 3;
export const MAX_TAIL_LINES = 5;
export const MAX_OUTPUT_LINES = 400;
export const MAX_OUTPUT_LENGTH = 20_000;

const HIGH_SURROGATE_START = 0xd8_00;
const HIGH_SURROGATE_END = 0xdb_ff;
const LOW_SURROGATE_START = 0xdc_00;
const LOW_SURROGATE_END = 0xdf_ff;

const EXIT_CODE_LINE = /^\s*Exit code:? -?\d+\s*$/;
const SHELL_CWD_RESET = /^\s*Shell cwd was reset to .*$/;

function isBlank(line: string): boolean {
  return line.trim() === '';
}

export function cutHead(text: string, length: number): string {
  if (text.length <= length) return text;
  const last = text.charCodeAt(length - 1);
  const end =
    last >= HIGH_SURROGATE_START && last <= HIGH_SURROGATE_END
      ? length - 1
      : length;
  return `${text.slice(0, end)}…`;
}

export function cutTail(text: string, length: number): string {
  if (text.length <= length) return text;
  const first = text.charCodeAt(text.length - length);
  const start =
    first >= LOW_SURROGATE_START && first <= LOW_SURROGATE_END
      ? text.length - length + 1
      : text.length - length;
  return `…${text.slice(start)}`;
}

function cutInput(text: string, home: string): string {
  return cutHead(withHomeAsTilde(text, home), MAX_INPUT_LENGTH);
}

export function shortInput(text: string): string {
  return cutHead(text, MAX_TEXT_LENGTH);
}

export function nonBlankLines(text: string): string[] {
  return text.split(/\r?\n/).filter((line) => !isBlank(line));
}

export function firstLines(text: string): string {
  return nonBlankLines(text).slice(0, MAX_TEXT_LINES).join('\n');
}

function withoutBlankEdges(lines: string[]): string[] {
  const start = lines.findIndex((line) => !isBlank(line));
  if (start === -1) return [];
  const end = lines.findLastIndex((line) => !isBlank(line));
  return lines.slice(start, end + 1);
}

export function cleanOutput(text: string, home: string): string {
  const lines = withoutBlankEdges(
    stripVTControlCharacters(text)
      .split(/\r?\n/)
      .filter((line) => !EXIT_CODE_LINE.test(line)),
  );
  const last = lines.at(-1);
  if (last !== undefined && SHELL_CWD_RESET.test(last)) lines.pop();
  return withHomeAsTilde(withoutBlankEdges(lines).join('\n'), home);
}

export function cleanMessage(text: string, home: string): string {
  return withHomeAsTilde(
    withoutBlankEdges(text.split(/\r?\n/)).join('\n'),
    home,
  );
}

export function headExcerpt(text: string): string {
  return cutHead(firstLines(text), MAX_TEXT_LENGTH);
}

export function tailExcerpt(text: string): string {
  return cutTail(
    nonBlankLines(text).slice(-MAX_TAIL_LINES).join('\n'),
    MAX_TEXT_LENGTH,
  );
}

export function hasMoreThan(text: string, excerpt: string): boolean {
  return nonBlankLines(text).join('\n') !== excerpt;
}

function earlierLines(count: number): string {
  return count === 1
    ? '… 1 earlier line not shown.'
    : `… ${String(count)} earlier lines not shown.`;
}

export function fullOutput(text: string): string {
  const lines = text.split(/\r?\n/);
  let kept = lines.slice(-MAX_OUTPUT_LINES);
  let length = kept.join('\n').length;
  while (kept.length > 1 && length > MAX_OUTPUT_LENGTH) {
    length -= (kept[0]?.length ?? 0) + 1;
    kept = kept.slice(1);
  }
  const hidden = lines.length - kept.length;
  const body =
    kept.length === 1
      ? cutTail(kept[0] ?? '', MAX_OUTPUT_LENGTH)
      : kept.join('\n');
  return hidden === 0 ? body : `${earlierLines(hidden)}\n${body}`;
}

export function inputText(
  input: unknown,
  shellCommand: string | undefined,
  home: string,
): string {
  if (shellCommand !== undefined) return cutInput(shellCommand, home);
  if (typeof input === 'string') return cutInput(input, home);
  return cutInput(JSON.stringify(input ?? null), home);
}

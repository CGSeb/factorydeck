import { withHomeAsTilde } from '../ingest/frictions.ts';

export const MAX_TEXT_LENGTH = 300;
export const MAX_TEXT_LINES = 3;

const HIGH_SURROGATE_START = 0xd8_00;
const HIGH_SURROGATE_END = 0xdb_ff;

const ANSI_ESCAPE =
  // eslint-disable-next-line no-control-regex
  /\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001B]*(?:\u0007|\u001B\\)|[@-Z\\-_])/g;
const EXIT_CODE_LINE = /^\s*Exit code:? -?\d+\s*$/;

export function cutText(text: string, home: string): string {
  const shown = withHomeAsTilde(text, home);
  if (shown.length <= MAX_TEXT_LENGTH) return shown;
  const last = shown.charCodeAt(MAX_TEXT_LENGTH - 1);
  const end =
    last >= HIGH_SURROGATE_START && last <= HIGH_SURROGATE_END
      ? MAX_TEXT_LENGTH - 1
      : MAX_TEXT_LENGTH;
  return `${shown.slice(0, end)}…`;
}

export function firstLines(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .slice(0, MAX_TEXT_LINES)
    .join('\n');
}

export function errorExcerpt(text: string, home: string): string {
  const lines = text
    .replaceAll(ANSI_ESCAPE, '')
    .split(/\r?\n/)
    .filter((line) => !EXIT_CODE_LINE.test(line));
  return cutText(firstLines(lines.join('\n')), home);
}

export function messageExcerpt(text: string, home: string): string {
  return cutText(firstLines(text), home);
}

export function inputText(
  input: unknown,
  shellCommand: string | undefined,
  home: string,
): string {
  if (shellCommand !== undefined) return cutText(shellCommand, home);
  if (typeof input === 'string') return cutText(input, home);
  return cutText(JSON.stringify(input ?? null), home);
}

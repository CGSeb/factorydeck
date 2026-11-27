import {
  MAX_INPUT_LENGTH,
  cutHead,
  cutTail,
  nonBlankLines,
} from './log-texts.ts';
import type { LogTexts } from './occurrence-types.ts';
import { UNASSIGNED_ISSUE } from './report-groups.ts';

export const GONE = 'The session log is no longer on this computer.';
export const NO_OUTPUT = 'No output.';
export const MAX_OUTPUT_TAIL_LINES = 40;
export const MAX_OUTPUT_TAIL_LENGTH = 4000;
export const MAX_RESULT_LINES = 20;
export const MAX_RESULT_LENGTH = 2000;

export const SEPARATOR = ' · ';
const MIN_FENCE = 3;

export interface ReportOccurrence {
  at: string;
  role: string;
  workItem: number | null;
  sessionId: string;
  sessionTitle: string;
  shell: boolean;
  exitCode: number | null;
  texts: LogTexts | null;
}

function longestRun(text: string, mark: string): number {
  let longest = 0;
  let current = 0;
  for (const char of text) {
    current = char === mark ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

export function fence(text: string, language: string): string {
  const marks = '`'.repeat(Math.max(MIN_FENCE, longestRun(text, '`') + 1));
  return `${marks}${language}\n${text}\n${marks}`;
}

export function codeSpan(text: string): string {
  const marks = '`'.repeat(longestRun(text, '`') + 1);
  const padded =
    text.startsWith('`') || text.endsWith('`') ? ` ${text} ` : text;
  return `${marks}${padded}${marks}`;
}

export function issueLabel(
  number: number | null,
  title: (number: number) => string | null,
): string {
  if (number === null) return UNASSIGNED_ISSUE;
  const known = title(number);
  return known === null || known === ''
    ? `#${String(number)}`
    : `#${String(number)} ${known}`;
}

function headLines(text: string, lines: number): string {
  return nonBlankLines(text).slice(0, lines).join('\n');
}

export function outputTail(output: string): string {
  return cutTail(
    nonBlankLines(output).slice(-MAX_OUTPUT_TAIL_LINES).join('\n'),
    MAX_OUTPUT_TAIL_LENGTH,
  );
}

export function resultHead(output: string): string {
  return cutHead(headLines(output, MAX_RESULT_LINES), MAX_RESULT_LENGTH);
}

export function messageHead(message: string): string {
  return headLines(message, MAX_RESULT_LINES);
}

function textBlock(text: string, language: string): string[] {
  return text === '' ? [NO_OUTPUT] : [fence(text, language)];
}

function exitLine(occurrence: ReportOccurrence): string[] {
  return occurrence.shell && occurrence.exitCode !== null
    ? [`Exit code ${String(occurrence.exitCode)}`]
    : [];
}

function occurrenceTexts(occurrence: ReportOccurrence): string[] {
  const { texts } = occurrence;
  if (texts === null) return [GONE, ...exitLine(occurrence)];
  if (texts.kind === 'stop-blocked') {
    return textBlock(messageHead(texts.message), 'text');
  }
  const input = cutHead(texts.input, MAX_INPUT_LENGTH);
  if (occurrence.shell) {
    return [
      fence(input, 'bash'),
      ...exitLine(occurrence),
      ...textBlock(outputTail(texts.output), 'text'),
    ];
  }
  return [fence(input, 'json'), ...textBlock(resultHead(texts.output), 'text')];
}

export function occurrenceLines(
  occurrence: ReportOccurrence,
  formatAt: (at: string) => string,
): string[] {
  const heading = [
    formatAt(occurrence.at),
    occurrence.role,
    issueLabel(occurrence.workItem, () => null),
    `${occurrence.sessionTitle} (${codeSpan(occurrence.sessionId)})`,
  ].join(SEPARATOR);
  return [
    `#### ${heading}`,
    ...occurrenceTexts(occurrence).flatMap((block) => ['', block]),
  ];
}

import { SHELL_TOOLS, toolErrorsOf } from '../ingest/frictions.ts';
import { recordUuidOf } from '../ingest/friction-rows.ts';
import { type LogRecord, isObject, parseRecord } from '../ingest/records.ts';
import { errorExcerpt, inputText, messageExcerpt } from './log-texts.ts';
import { type FileReading, type LogTarget, settle } from './log-reading.ts';
import type { OccurrenceTexts } from './occurrence-types.ts';

function callInputs(record: LogRecord, home: string): [string, string][] {
  if (record.type !== 'assistant') return [];
  const message = record['message'];
  const content = isObject(message) ? message['content'] : undefined;
  if (!Array.isArray(content)) return [];
  return content.filter(isObject).flatMap((block): [string, string][] => {
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
    const shell =
      SHELL_TOOLS.has(name) && typeof command === 'string'
        ? command
        : undefined;
    return [[id, inputText(input, shell, home)]];
  });
}

const ERROR_TAG_START = /^\s*<tool_use_error>/;
const ERROR_TAG_END = /<\/tool_use_error>\s*$/;

export function withoutErrorTag(text: string): string {
  return text.replace(ERROR_TAG_START, '').replace(ERROR_TAG_END, '');
}

function hookMessage(entry: unknown): string {
  if (typeof entry !== 'string') return '';
  if (!entry.startsWith('[')) return entry;
  const labelled = entry.indexOf(']: ');
  if (labelled !== -1) return entry.slice(labelled + 3);
  const end = entry.lastIndexOf(']');
  return end === -1 ? entry : entry.slice(end + 1).trimStart();
}

function textsOf(
  record: LogRecord,
  target: LogTarget,
  calls: ReadonlyMap<string, string>,
  home: string,
): OccurrenceTexts | null {
  if (target.kind === 'stop-blocked') {
    const errors = record['hookErrors'];
    if (
      record.type !== 'system' ||
      !Array.isArray(errors) ||
      target.position >= errors.length
    ) {
      return null;
    }
    return {
      kind: 'stop-blocked',
      message: messageExcerpt(hookMessage(errors[target.position]), home),
    };
  }
  const error = toolErrorsOf(record).find(
    (candidate) => candidate.position === target.position,
  );
  const input = error === undefined ? undefined : calls.get(error.toolUseId);
  if (error === undefined || input === undefined) return null;
  return {
    kind: 'tool-error',
    input,
    error: errorExcerpt(withoutErrorTag(error.text), home),
  };
}

export function readClaudeLine(
  reading: FileReading,
  calls: Map<string, string>,
  line: { offset: number; text: string },
): void {
  const record = parseRecord(line.text.trim());
  if (record === undefined) return;
  for (const [id, input] of callInputs(record, reading.home)) {
    calls.set(id, input);
  }
  const uuid = recordUuidOf(record, line.offset);
  for (const target of reading.targets) {
    if (target.recordUuid !== uuid || reading.found.has(target.key)) continue;
    settle(reading, target, textsOf(record, target, calls, reading.home));
  }
}

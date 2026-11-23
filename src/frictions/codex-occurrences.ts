import { parseCodexRecord } from '../ingest/codex-files.ts';
import {
  commandText,
  functionCallOf,
  outputFriction,
  parseJson,
} from '../ingest/codex-frictions.ts';
import { field, textAt } from '../ingest/codex-reading.ts';
import type { ToolCall } from '../ingest/frictions.ts';
import { type LogRecord, isObject } from '../ingest/records.ts';
import { type FileReading, type LogTarget, settle } from './log-reading.ts';
import { errorExcerpt, inputText } from './log-texts.ts';
import type { OccurrenceTexts } from './occurrence-types.ts';

export interface CodexCalls {
  calls: Map<string, ToolCall>;
  inputs: Map<string, string>;
}

export function codexCalls(): CodexCalls {
  return { calls: new Map(), inputs: new Map() };
}

interface Result {
  callId: string | undefined;
  failed: boolean;
  input: string | undefined;
  error: string;
}

function contentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter(isObject)
    .flatMap((block) =>
      typeof block['text'] === 'string' ? [block['text']] : [],
    )
    .join('\n');
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value !== '') return value;
  }
  return '';
}

function argumentsText(value: unknown, home: string): string | undefined {
  if (value === undefined) return undefined;
  const parsed =
    typeof value === 'string' ? (parseJson(value) ?? value) : value;
  return inputText(parsed, undefined, home);
}

function shellInput(command: unknown, home: string): string | undefined {
  const text = commandText(command);
  return text === undefined ? undefined : inputText(undefined, text, home);
}

function errorText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (isObject(value)) {
    return firstText(value['message'], contentText(value['content']));
  }
  return '';
}

function commandResult(
  callId: string | undefined,
  source: unknown,
  home: string,
): Result {
  const exitCode = field(source, 'exit_code');
  return {
    callId,
    failed: typeof exitCode === 'number' && exitCode !== 0,
    input: shellInput(field(source, 'command'), home),
    error: firstText(
      field(source, 'aggregated_output'),
      field(source, 'aggregatedOutput'),
      field(source, 'formatted_output'),
      [field(source, 'stderr'), field(source, 'stdout')]
        .filter((part) => typeof part === 'string' && part !== '')
        .join('\n'),
    ),
  };
}

function itemResult(payload: unknown, home: string): Result | undefined {
  const item = field(payload, 'item');
  const type = textAt(item, 'type');
  if (type === 'CommandExecution') {
    return commandResult(textAt(item, 'id'), item, home);
  }
  if (type !== 'McpToolCall') return undefined;
  return {
    callId: textAt(item, 'id'),
    failed:
      field(item, 'result', 'isError') === true ||
      textAt(item, 'status') === 'failed',
    input: argumentsText(field(item, 'arguments'), home),
    error: firstText(
      contentText(field(item, 'result', 'content')),
      errorText(field(item, 'error')),
    ),
  };
}

function mcpEndResult(payload: unknown, home: string): Result {
  const result = field(payload, 'result');
  const err = field(result, 'Err');
  return {
    callId: textAt(payload, 'call_id'),
    failed: err !== undefined || field(result, 'Ok', 'isError') === true,
    input: argumentsText(field(payload, 'invocation', 'arguments'), home),
    error: firstText(
      errorText(err),
      contentText(field(result, 'Ok', 'content')),
    ),
  };
}

function patchResult(payload: unknown): Result {
  return {
    callId: textAt(payload, 'call_id'),
    failed: field(payload, 'success') === false,
    input: undefined,
    error: firstText(field(payload, 'stderr'), field(payload, 'stdout')),
  };
}

const EVENT_RESULTS: ReadonlyMap<
  string,
  (payload: unknown, home: string) => Result | undefined
> = new Map([
  [
    'exec_command_end',
    (payload: unknown, home: string) =>
      commandResult(textAt(payload, 'call_id'), payload, home),
  ],
  ['item_completed', itemResult],
  ['mcp_tool_call_end', mcpEndResult],
  ['patch_apply_end', patchResult],
]);

function eventResult(payload: unknown, home: string): Result | undefined {
  const type = textAt(payload, 'type');
  return type === undefined
    ? undefined
    : EVENT_RESULTS.get(type)?.(payload, home);
}

function outputText(output: unknown): string {
  const parsed = typeof output === 'string' ? parseJson(output) : output;
  const inner = field(parsed, 'output');
  if (typeof inner === 'string') return inner;
  if (typeof output === 'string') return output;
  return contentText(output);
}

function outputResult(
  payload: unknown,
  { calls }: CodexCalls,
): Result | undefined {
  const callId = textAt(payload, 'call_id');
  if (callId === undefined) return undefined;
  const output = field(payload, 'output');
  return {
    callId,
    failed: outputFriction(output, calls.get(callId)) !== undefined,
    input: undefined,
    error: outputText(output),
  };
}

function rememberCall(payload: unknown, known: CodexCalls, home: string): void {
  const type = textAt(payload, 'type');
  if (type === 'custom_tool_call') {
    const callId = textAt(payload, 'call_id');
    const input = field(payload, 'input');
    if (callId !== undefined && input !== undefined) {
      known.inputs.set(callId, inputText(input, undefined, home));
    }
    return;
  }
  if (type !== 'function_call') return;
  const call = functionCallOf(payload);
  if (call === undefined) return;
  const [callId, toolCall] = call;
  known.calls.set(callId, toolCall);
  known.inputs.set(
    callId,
    toolCall.command === undefined
      ? (argumentsText(field(payload, 'arguments'), home) ?? '')
      : inputText(undefined, toolCall.command, home),
  );
}

function resultOf(
  record: LogRecord,
  known: CodexCalls,
  home: string,
): Result | undefined {
  const payload = record['payload'];
  if (record.type === 'event_msg') return eventResult(payload, home);
  if (record.type !== 'response_item') return undefined;
  if (textAt(payload, 'type') === 'function_call_output') {
    return outputResult(payload, known);
  }
  rememberCall(payload, known, home);
  return undefined;
}

function matches(target: LogTarget, result: Result, offset: number): boolean {
  if (target.recordUuid === `offset:${String(offset)}`) return true;
  return (
    result.failed &&
    result.callId !== undefined &&
    target.recordUuid === `call:${result.callId}`
  );
}

const OUTPUT_HEADER =
  /^\s*(?:Exit code:? -?\d+|Process exited with code -?\d+|Wall time: .*|Chunk ID: .*|Original token count: \d+|Output:)\s*$/;

export function withoutOutputHeader(text: string): string {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => !OUTPUT_HEADER.test(line));
  return start === -1 ? '' : lines.slice(start).join('\n');
}

function textsOf(
  result: Result,
  known: CodexCalls,
  home: string,
): OccurrenceTexts | null {
  const input =
    (result.callId === undefined
      ? undefined
      : known.inputs.get(result.callId)) ?? result.input;
  if (input === undefined) return null;
  return {
    kind: 'tool-error',
    input,
    error: errorExcerpt(withoutOutputHeader(result.error), home),
  };
}

export function readCodexLine(
  reading: FileReading,
  known: CodexCalls,
  line: { offset: number; text: string },
): void {
  const record = parseCodexRecord(line.text.trim());
  if (record === undefined) return;
  const result = resultOf(record, known, reading.home);
  for (const target of reading.targets) {
    if (reading.found.has(target.key)) continue;
    if (result === undefined) {
      if (target.recordUuid === `offset:${String(line.offset)}`) {
        settle(reading, target, null);
      }
      continue;
    }
    if (!matches(target, result, line.offset)) continue;
    settle(
      reading,
      target,
      target.kind === 'tool-error'
        ? textsOf(result, known, reading.home)
        : null,
    );
  }
}

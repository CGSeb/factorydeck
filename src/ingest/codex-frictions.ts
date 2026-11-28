import { CODEX, CODEX_SHELL_TOOLS } from './codex-files.ts';
import {
  type CodexRows,
  type Entry,
  type FrictionBase,
  type Reading,
  eventType,
  field,
  offsetKey,
  textAt,
} from './codex-reading.ts';
import type { FrictionRow } from './friction-rows.ts';
import {
  type FrictionFields,
  type ToolCall,
  UNKNOWN_TOOL,
  commandHash,
  programOf,
} from './frictions.ts';
import type { LogRecord } from './records.ts';

const EXEC_COMMAND = 'exec_command';

const EMPTY_FIELDS = {
  tool: null,
  category: null,
  program: null,
  exitCode: null,
  commandHash: null,
  hookCommand: null,
  trigger: null,
  preTokens: null,
  postTokens: null,
} satisfies Partial<FrictionRow>;

const EXIT_CODE_LINES = [
  /^Exit code:? (-?\d+)/m,
  /^Process exited with code (-?\d+)/m,
];

export function commandText(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.every((part) => typeof part === 'string')) {
    return value.join(' ');
  }
  return undefined;
}

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function functionCallOf(
  payload: unknown,
): [string, ToolCall] | undefined {
  const callId = textAt(payload, 'call_id');
  const name = textAt(payload, 'name');
  if (callId === undefined || name === undefined) return undefined;
  if (!CODEX_SHELL_TOOLS.has(name))
    return [callId, { name, command: undefined }];
  const raw = field(payload, 'arguments');
  const args = typeof raw === 'string' ? parseJson(raw) : raw;
  const command =
    commandText(field(args, 'command')) ?? commandText(field(args, 'cmd'));
  return [callId, { name, command }];
}

function outputExitCode(output: unknown): number | null {
  const parsed = typeof output === 'string' ? parseJson(output) : output;
  const code = field(parsed, 'metadata', 'exit_code');
  if (typeof code === 'number' && Number.isInteger(code)) return code;
  if (typeof output !== 'string') return null;
  for (const pattern of EXIT_CODE_LINES) {
    const match = pattern.exec(output);
    if (match?.[1] !== undefined) return Number(match[1]);
  }
  return null;
}

function outputFailed(output: unknown): boolean {
  const parsed = typeof output === 'string' ? parseJson(output) : output;
  return field(parsed, 'success') === false;
}

function shellFailure(
  tool: string,
  command: string | undefined,
  exitCode: number,
): FrictionFields {
  return {
    kind: 'tool-error',
    tool,
    category: 'command-failed',
    program: command === undefined ? null : programOf(command),
    exitCode,
    commandHash: command === undefined ? null : commandHash(command),
  };
}

function otherFailure(tool: string): FrictionFields {
  return {
    kind: 'tool-error',
    tool,
    category: 'other',
    program: null,
    exitCode: null,
    commandHash: null,
  };
}

function frictionRow(base: FrictionBase, fields: FrictionFields): FrictionRow {
  return { ...base, ...EMPTY_FIELDS, ...fields, agent: CODEX };
}

export function outputFriction(
  output: unknown,
  call: ToolCall | undefined,
): FrictionFields | undefined {
  if (call !== undefined && CODEX_SHELL_TOOLS.has(call.name)) {
    const exitCode = outputExitCode(output);
    return exitCode === null || exitCode === 0
      ? undefined
      : shellFailure(call.name, call.command, exitCode);
  }
  return outputFailed(output)
    ? otherFailure(call?.name ?? UNKNOWN_TOOL)
    : undefined;
}

function mcpToolName(server: unknown, tool: unknown): string {
  return typeof server === 'string' && typeof tool === 'string'
    ? `mcp__${server}__${tool}`
    : UNKNOWN_TOOL;
}

function baseOf(reading: Reading, entry: Entry, key: string): FrictionBase {
  return {
    sourcePath: reading.source.logPath ?? reading.source.sourcePath,
    sessionId: reading.source.sessionId,
    subAgentId: reading.source.subAgentId,
    recordUuid: key,
    position: 0,
    at: entry.at,
  };
}

function callKey(callId: string | undefined, entry: Entry): string {
  return callId === undefined ? offsetKey(entry) : `call:${callId}`;
}

function pushFriction(
  reading: Reading,
  entry: Entry,
  key: string,
  fields: FrictionFields,
): void {
  if (reading.frictionKeys.has(key)) return;
  reading.frictionKeys.add(key);
  reading.rows.frictions.push(frictionRow(baseOf(reading, entry, key), fields));
}

function execCommandEnd(reading: Reading, entry: Entry): void {
  const { payload } = entry;
  const exitCode = field(payload, 'exit_code');
  if (typeof exitCode !== 'number' || exitCode === 0) return;
  const callId = textAt(payload, 'call_id');
  const call =
    callId === undefined ? undefined : reading.rows.toolCalls.get(callId);
  pushFriction(
    reading,
    entry,
    callKey(callId, entry),
    shellFailure(
      call?.name ?? EXEC_COMMAND,
      commandText(field(payload, 'command')) ?? call?.command,
      exitCode,
    ),
  );
}

function commandExecution(reading: Reading, entry: Entry, item: unknown): void {
  const exitCode = field(item, 'exit_code');
  if (typeof exitCode !== 'number' || exitCode === 0) return;
  pushFriction(
    reading,
    entry,
    callKey(textAt(item, 'id'), entry),
    shellFailure(EXEC_COMMAND, commandText(field(item, 'command')), exitCode),
  );
}

function itemCompleted(reading: Reading, entry: Entry): void {
  const item = field(entry.payload, 'item');
  const type = textAt(item, 'type');
  if (type === 'CommandExecution') {
    commandExecution(reading, entry, item);
    return;
  }
  if (type !== 'McpToolCall') return;
  const failed =
    field(item, 'result', 'isError') === true ||
    textAt(item, 'status') === 'failed';
  if (!failed) return;
  pushFriction(
    reading,
    entry,
    callKey(textAt(item, 'id'), entry),
    otherFailure(mcpToolName(field(item, 'server'), field(item, 'tool'))),
  );
}

function mcpToolCallEnd(reading: Reading, entry: Entry): void {
  const result = field(entry.payload, 'result');
  const failed =
    field(result, 'Err') !== undefined ||
    field(result, 'Ok', 'isError') === true;
  if (!failed) return;
  const invocation = field(entry.payload, 'invocation');
  pushFriction(
    reading,
    entry,
    callKey(textAt(entry.payload, 'call_id'), entry),
    otherFailure(
      mcpToolName(field(invocation, 'server'), field(invocation, 'tool')),
    ),
  );
}

function patchApplyEnd(reading: Reading, entry: Entry): void {
  if (field(entry.payload, 'success') !== false) return;
  pushFriction(
    reading,
    entry,
    callKey(textAt(entry.payload, 'call_id'), entry),
    otherFailure('apply_patch'),
  );
}

const EVENT_FRICTIONS: ReadonlyMap<
  string,
  (reading: Reading, entry: Entry) => void
> = new Map([
  ['exec_command_end', execCommandEnd],
  ['item_completed', itemCompleted],
  ['mcp_tool_call_end', mcpToolCallEnd],
  ['patch_apply_end', patchApplyEnd],
]);

function readResponseItem(reading: Reading, entry: Entry): void {
  const itemType = textAt(entry.payload, 'type');
  if (itemType === 'function_call') {
    const call = functionCallOf(entry.payload);
    if (call !== undefined) reading.rows.toolCalls.set(...call);
    return;
  }
  const callId = textAt(entry.payload, 'call_id');
  if (itemType !== 'function_call_output' || callId === undefined) return;
  reading.rows.outputs.push({
    base: baseOf(reading, entry, `call:${callId}`),
    callId,
    output: field(entry.payload, 'output'),
  });
}

export function readFriction(reading: Reading, entry: Entry): void {
  if (entry.record.type === 'compacted') {
    pushFriction(reading, entry, offsetKey(entry), {
      kind: 'compaction',
      trigger: 'auto',
      preTokens: null,
      postTokens: null,
    });
    return;
  }
  if (entry.record.type === 'response_item') {
    readResponseItem(reading, entry);
    return;
  }
  const type = eventType(entry);
  if (type !== undefined) EVENT_FRICTIONS.get(type)?.(reading, entry);
}

export function unresolvedOutputs(rows: CodexRows): boolean {
  return rows.outputs.some((output) => !rows.toolCalls.has(output.callId));
}

export function codexFrictionRows(
  rows: CodexRows,
  earlier: ReadonlyMap<string, ToolCall> = new Map(),
): FrictionRow[] {
  const keys = new Set(rows.frictions.map((row) => row.recordUuid));
  const frictions = [...rows.frictions];
  for (const { base, callId, output } of rows.outputs) {
    if (keys.has(base.recordUuid)) continue;
    const fields = outputFriction(
      output,
      rows.toolCalls.get(callId) ?? earlier.get(callId),
    );
    if (fields === undefined) continue;
    keys.add(base.recordUuid);
    frictions.push(frictionRow(base, fields));
  }
  return frictions;
}

export function codexToolCalls(
  records: readonly { record: LogRecord }[],
): Map<string, ToolCall> {
  return new Map(
    records.flatMap(({ record }) => {
      if (
        record.type !== 'response_item' ||
        textAt(record['payload'], 'type') !== 'function_call'
      ) {
        return [];
      }
      const call = functionCallOf(record['payload']);
      return call === undefined ? [] : [call];
    }),
  );
}

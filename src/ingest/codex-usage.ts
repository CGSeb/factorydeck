import {
  type Entry,
  type Reading,
  eventType,
  field,
  textAt,
} from './codex-reading.ts';
import { isObject } from './records.ts';

export const TOKEN_COUNT_KEY = 'token_count:';

function count(value: Record<string, unknown>, key: string): number {
  const found = value[key];
  return typeof found === 'number' && Number.isFinite(found) ? found : 0;
}

export function tokensOf(usage: Record<string, unknown>): {
  inputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
} {
  const cacheReadTokens = count(usage, 'cached_input_tokens');
  const cacheWriteTokens = count(usage, 'cache_write_input_tokens');
  return {
    inputTokens: Math.max(
      0,
      count(usage, 'input_tokens') - cacheReadTokens - cacheWriteTokens,
    ),
    cacheWriteTokens,
    cacheReadTokens,
    outputTokens: count(usage, 'output_tokens'),
  };
}

function pushCall(
  reading: Reading,
  entry: Entry,
  requestKey: string,
  usage: unknown,
): void {
  if (!isObject(usage) || reading.callKeys.has(requestKey)) return;
  reading.callKeys.add(requestKey);
  reading.rows.calls.push({
    sourcePath: reading.source.sourcePath,
    sessionId: reading.source.sessionId,
    subAgentId: reading.source.subAgentId,
    requestKey,
    at: entry.at,
    model: reading.state.model,
    ...tokensOf(usage),
  });
}

export function readModel(reading: Reading, entry: Entry): void {
  const model =
    entry.record.type === 'turn_context'
      ? textAt(entry.payload, 'model')
      : eventType(entry) === 'thread_settings_applied'
        ? textAt(entry.payload, 'thread_settings', 'model')
        : undefined;
  if (model === undefined) return;
  reading.state.model = model;
  if (!entry.inherited && reading.rows.firstModel === '') {
    reading.rows.firstModel = model;
  }
}

function readUsageRecord(reading: Reading, entry: Entry): void {
  const { state, rows } = reading;
  if (!state.usageRecords) {
    state.usageRecords = true;
    rows.dropTokenCountCalls = true;
    rows.calls = rows.calls.filter(
      (call) => !call.requestKey.startsWith(TOKEN_COUNT_KEY),
    );
  }
  const responseId = textAt(entry.payload, 'response_id');
  if (responseId !== undefined && responseId !== '') {
    pushCall(reading, entry, responseId, field(entry.payload, 'usage'));
  }
}

function readTokenCount(reading: Reading, entry: Entry): void {
  const { state } = reading;
  const info = field(entry.payload, 'info');
  if (state.usageRecords || !isObject(info)) return;
  const total = JSON.stringify(info['total_token_usage'] ?? null);
  if (total === state.lastTotal) return;
  state.lastTotal = total;
  pushCall(
    reading,
    entry,
    `${TOKEN_COUNT_KEY}${String(entry.position)}`,
    info['last_token_usage'],
  );
}

export function readUsage(reading: Reading, entry: Entry): void {
  if (entry.record.type === 'token_usage_record') {
    readUsageRecord(reading, entry);
  } else if (eventType(entry) === 'token_count') {
    readTokenCount(reading, entry);
  }
}

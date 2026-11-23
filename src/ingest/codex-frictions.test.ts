import { describe, expect, it } from 'vitest';
import {
  chunkOf,
  commandItem,
  compacted,
  execEnd,
  failedMcpCall,
  item,
  readLines,
  sessionMeta,
  shellCall,
  shellOutput,
  turnContext,
  usageRecord,
} from '../test/codex-logs.ts';
import { minute } from '../test/session-logs.ts';
import { parseCodexRecord } from './codex-files.ts';
import {
  codexFrictionRows,
  codexState,
  codexToolCalls,
} from './codex-records.ts';
import { commandHash } from './frictions.ts';
import { type LogRecord, parseLines } from './records.ts';

describe('readCodexChunk frictions', () => {
  it('stores a failed shell command once, with its program, exit code and hash', () => {
    const command = ['pnpm', 'test', '--run'];
    const { rows } = readLines([
      shellCall(1, 'call_1', command),
      execEnd(2, 'call_1', command, 2),
      shellOutput(2, 'call_1', 2),
      shellCall(3, 'call_2', ['ls']),
      shellOutput(3, 'call_2', 0),
    ]);
    expect(codexFrictionRows(rows)).toEqual([
      expect.objectContaining({
        agent: 'codex',
        kind: 'tool-error',
        tool: 'shell',
        category: 'command-failed',
        program: 'pnpm',
        exitCode: 2,
        commandHash: commandHash('pnpm test --run'),
        recordUuid: 'call:call_1',
      }),
    ]);
  });

  it('stores a failed command execution item, and nothing for one that exits with 0', () => {
    const { rows } = readLines([
      commandItem(1, 'item_1', ['pwsh.exe', '-Command', 'pnpm lint'], 0),
      commandItem(
        2,
        'item_2',
        ['C:\\tools\\pwsh.exe', '-Command', 'pnpm test'],
        1,
      ),
    ]);
    expect(codexFrictionRows(rows)).toEqual([
      expect.objectContaining({
        kind: 'tool-error',
        tool: 'exec_command',
        category: 'command-failed',
        program: 'pwsh.exe',
        exitCode: 1,
        commandHash: commandHash('C:\\tools\\pwsh.exe -Command pnpm test'),
        recordUuid: 'call:item_2',
      }),
    ]);
  });

  it('reads the exit code of an output whose call came in an earlier chunk', () => {
    const { rows } = readLines([shellOutput(2, 'call_9', 1)]);
    const earlier = codexToolCalls(
      parseLines(chunkOf([shellCall(1, 'call_9', ['make'])]), parseCodexRecord)
        .records,
    );
    expect(codexFrictionRows(rows, earlier)).toEqual([
      expect.objectContaining({ program: 'make', exitCode: 1 }),
    ]);
  });

  it('stores other failed tools and compactions, and no text', () => {
    const { rows } = readLines([
      failedMcpCall(1, 'mcp_1'),
      item(2, {
        type: 'function_call',
        name: 'view_image',
        call_id: 'call_v',
        arguments: '{}',
      }),
      item(2, {
        type: 'function_call_output',
        call_id: 'call_v',
        output: { content: 'secret text', success: false },
      }),
      compacted(3),
    ]);
    const frictions = codexFrictionRows(rows);
    expect(frictions).toEqual([
      expect.objectContaining({
        kind: 'tool-error',
        tool: 'mcp__docs__search',
        category: 'other',
      }),
      expect.objectContaining({
        kind: 'compaction',
        trigger: 'auto',
        preTokens: null,
        postTokens: null,
      }),
      expect.objectContaining({
        kind: 'tool-error',
        tool: 'view_image',
        category: 'other',
      }),
    ]);
    expect(JSON.stringify(frictions)).not.toContain('secret');
  });
});

describe('readCodexChunk records', () => {
  it('skips an unknown record type and an unparseable line, and counts them', () => {
    const { records, skipped } = parseLines(
      chunkOf([
        { timestamp: minute(1), type: 'future_record', payload: {} },
        'not json',
        turnContext(1, 'gpt-test-1'),
        {
          timestamp: minute(1),
          type: 'inter_agent_communication_metadata',
          payload: { trigger_turn: true },
        },
      ]),
      parseCodexRecord,
    );
    expect(skipped).toBe(2);
    expect(records.map(({ record }) => record.type)).toEqual([
      'turn_context',
      'inter_agent_communication_metadata',
    ]);
  });

  it('leaves a last line without newline for the next run', () => {
    const chunk = Buffer.from(
      `${JSON.stringify(turnContext(1, 'gpt-test-1'))}\n{"type":"event_msg"`,
    );
    const { records, consumed, lines } = parseLines(chunk, parseCodexRecord);
    expect(records).toHaveLength(1);
    expect(lines).toBe(1);
    expect(consumed).toBe(chunk.indexOf('\n') + 1);
  });

  it('reads no prompt, closing line or friction before the history start of a sub-agent', () => {
    const { rows, span } = readLines(
      [
        sessionMeta({ id: 'sub', parent: 'root', historyStart: 3, at: 5 }),
        usageRecord(1, 'resp_parent', { input: 1, output: 1 }),
        execEnd(1, 'call_p', ['false'], 1),
        compacted(6),
        usageRecord(7, 'resp_own', { input: 1, output: 1 }),
      ],
      { subAgentId: 'sub', historyStart: 3 },
    );
    expect(rows.calls.map((call) => call.requestKey)).toEqual([
      'resp_parent',
      'resp_own',
    ]);
    expect(codexFrictionRows(rows).map((row) => row.kind)).toEqual([
      'compaction',
    ]);
    expect(span.firstAt).toEqual(new Date(minute(5)));
  });

  it('counts the history start from lines read by earlier runs', () => {
    const state = { ...codexState(undefined), lines: 4 };
    const { rows } = readLines([compacted(9)], {
      subAgentId: 'sub',
      historyStart: 5,
      state,
    });
    expect(codexFrictionRows(rows)).toEqual([]);
  });

  it('skips a record without a valid timestamp', () => {
    const record: LogRecord = { type: 'compacted', payload: {} };
    const { rows } = readLines([record]);
    expect(rows.skipped).toBe(1);
  });
});

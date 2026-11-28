import { describe, expect, it } from 'vitest';
import {
  PARSER_VERSION as SCHEMA_PARSER_VERSION,
  checkBatch,
} from '../../src/cli-ingest/batch-schema.ts';
import { PARSER_VERSION } from '../../src/cli-ingest/batch.ts';
import { readClaudeCodeLog } from '../../src/ingest/readers/claude-code.ts';
import { readCodexLog } from '../../src/ingest/readers/codex.ts';

const AT = '2026-01-05T09:00:00.000Z';

function lines(...records: Record<string, unknown>[]): Buffer {
  return Buffer.from(
    records.map((record) => `${JSON.stringify(record)}\n`).join(''),
  );
}

describe('the parser from the CLI package', () => {
  it('reads a log of each agent into a batch the schema accepts', () => {
    const claude = readClaudeCodeLog({
      bytes: lines({
        type: 'assistant',
        uuid: 'a1',
        timestamp: AT,
        requestId: 'req_1',
        message: {
          model: 'claude-test-1',
          content: [],
          usage: { input_tokens: 1, output_tokens: 2 },
        },
      }),
      from: 0,
      readerState: null,
      home: '/home/dev',
      log: { sessionId: 's-1', subAgentId: null },
    });
    const codex = readCodexLog({
      bytes: lines({
        timestamp: AT,
        type: 'session_meta',
        payload: { id: 'r-1', cwd: '/work/app' },
      }),
      from: 0,
      readerState: null,
      home: '/home/dev',
      log: { sessionId: 'r-1', subAgentId: null, cwd: '/work/app' },
    });
    if (claude.status !== 'read' || codex.status !== 'read') {
      throw new Error('A reader asked to restart');
    }
    expect(claude.thread.apiCalls).toHaveLength(1);
    expect(SCHEMA_PARSER_VERSION).toBe(PARSER_VERSION);
    expect(Number.isInteger(PARSER_VERSION) && PARSER_VERSION > 0).toBe(true);
    expect(
      checkBatch({
        parserVersion: PARSER_VERSION,
        threads: [
          { ...claude.thread, remote: null },
          { ...codex.thread, remote: null },
        ],
      }).status,
    ).toBe('ok');
  });
});

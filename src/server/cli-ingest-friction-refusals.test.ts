import { describe, expect, it } from 'vitest';
import { MAX_RECORDS } from '../cli-ingest/batch-schema.ts';
import { addProject, mainThread, minutes } from '../test/cli-batch.ts';
import {
  type FrictionInput,
  batch,
  failedCommand,
  storedFrictions,
} from '../test/cli-frictions.ts';
import { useIngestApp } from '../test/cli-ingest-app.ts';

const app = useIngestApp();
const { send } = app;

describe('POST /api/cli/ingest refusing frictions', () => {
  it.each([
    [{ ...failedCommand(), kind: 'retry' }, 'threads.0.frictions.0.kind'],
    [{ ...failedCommand(), tool: undefined }, 'threads.0.frictions.0.tool'],
    [
      { ...failedCommand(), category: 'slow' },
      'threads.0.frictions.0.category',
    ],
    [
      { ...failedCommand(), commandHash: 'ABC' },
      'threads.0.frictions.0.commandHash',
    ],
    [
      { ...failedCommand(), hookCommand: 'x' },
      'threads.0.frictions.0.hookCommand',
    ],
    [{ ...failedCommand(), position: -1 }, 'threads.0.frictions.0.position'],
    [{ ...failedCommand(), position: 1.5 }, 'threads.0.frictions.0.position'],
    [{ ...failedCommand(), recordId: '' }, 'threads.0.frictions.0.recordId'],
    [
      { ...failedCommand(), recordId: 'r'.repeat(201) },
      'threads.0.frictions.0.recordId',
    ],
    [
      { ...failedCommand(), at: '2026-03-12T09:00:00' },
      'threads.0.frictions.0.at',
    ],
    [{ ...failedCommand(), at: undefined }, 'threads.0.frictions.0.at'],
    [
      { kind: 'stop-blocked', recordId: 'r', position: 0, at: minutes(1) },
      'threads.0.frictions.0.hookCommand',
    ],
    [
      {
        kind: 'compaction',
        recordId: 'r',
        position: 0,
        at: minutes(1),
        trigger: 'sometimes',
      },
      'threads.0.frictions.0.trigger',
    ],
    [
      {
        kind: 'compaction',
        recordId: 'r',
        position: 0,
        at: minutes(1),
        exitCode: 1,
      },
      'threads.0.frictions.0.exitCode',
    ],
  ])('refuses %o with its path and stores nothing', async (item, path) => {
    await addProject(app.h().db);
    const answer = await send(batch([item as FrictionInput]));
    expect(answer).toMatchObject({ status: 400, body: { path } });
    expect(await storedFrictions(app.h().db)).toEqual([]);
  });

  it('counts frictions toward the record limit', async () => {
    const calls = MAX_RECORDS - 3;
    const thread = mainThread('s-1', {
      calls: Array.from({ length: calls }, (_, index) => ({
        requestKey: `r${String(index)}`,
        at: minutes(1),
        model: 'claude-sonnet-4-5',
        inputTokens: 1,
        cacheWriteTokens: 0,
        cacheReadTokens: 0,
        outputTokens: 1,
      })),
    });
    const frictions = [
      failedCommand('a'),
      failedCommand('b'),
      failedCommand('c'),
    ];
    const answer = await send({
      parserVersion: 1,
      threads: [{ ...thread, frictions: [...frictions, failedCommand('d')] }],
    });
    expect(answer).toEqual({
      status: 413,
      body: { error: 'Batch too large', limit: 'records' },
    });
  });
});

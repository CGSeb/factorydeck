import { describe, expect, it } from 'vitest';
import { MAX_RECORDS, checkBatch, fileKeyOf } from './batch-schema.ts';

const AT = '2026-03-12T10:00:00.000Z';

function call(key: string, at = AT) {
  return {
    requestKey: key,
    at,
    model: 'claude-sonnet-4-5',
    inputTokens: 10,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    outputTokens: 5,
  };
}

function mainThread(sessionId = 's1', apiCalls = [call('r1')]) {
  return {
    fileKey: fileKeyOf('claude-code', sessionId, null),
    agent: 'claude-code',
    sessionId,
    subAgentId: null,
    remote: 'git@github.com:acme/app.git',
    from: 0,
    readTo: 100,
    readerState: null,
    session: { cwd: '/work/app', firstAt: AT, lastAt: AT },
    apiCalls,
  };
}

function invalid(threads: unknown[], parserVersion: unknown = 1) {
  const result = checkBatch({ parserVersion, threads });
  return result.status === 'invalid'
    ? { error: result.error, path: result.path }
    : result.status;
}

function launch(recordId: string, change: Record<string, unknown> = {}) {
  return { recordId, at: AT, skill: 'build-feature', ...change };
}

function prompt(recordId: string, change: Record<string, unknown> = {}) {
  return { recordId, at: AT, promptId: 'p1', command: null, ...change };
}

function closing(recordId: string, change: Record<string, unknown> = {}) {
  return { recordId, at: AT, position: 120, line: 'Done.', ...change };
}

function subAgentThread() {
  return {
    ...mainThread('s'),
    fileKey: fileKeyOf('claude-code', 's', 'a1'),
    subAgentId: 'a1',
    session: undefined,
    subAgent: { agentType: 'general-purpose' },
  };
}

describe('checkBatch with skill launches, prompts and closing lines', () => {
  it('accepts each kind with its fields, and an offset record id', () => {
    const thread = {
      ...mainThread('s'),
      skillLaunches: [
        launch('u1', { subAgentId: null }),
        launch('u1', { skill: 'check-spec' }),
      ],
      prompts: [
        prompt('offset:42', { promptId: null }),
        prompt('u2', { command: 'build-feature' }),
      ],
      closingLines: [closing('u3', { line: 'x'.repeat(200), position: 0 })],
    };
    const result = checkBatch({ parserVersion: 1, threads: [thread] });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.batch.threads[0]?.prompts[0]).toEqual({
      recordId: 'offset:42',
      at: AT,
      promptId: null,
      command: null,
    });
  });

  it('accepts a skill launch on a sub-agent thread', () => {
    const thread = {
      ...subAgentThread(),
      skillLaunches: [launch('u1', { subAgentId: 'a1' }), launch('u2')],
    };
    expect(checkBatch({ parserVersion: 1, threads: [thread] }).status).toBe(
      'ok',
    );
  });

  it.each([
    ['prompts', [prompt('u1')], 'threads.0.prompts'],
    ['closingLines', [closing('u1')], 'threads.0.closingLines'],
  ])('refuses %s on a sub-agent thread', (field, records, path) => {
    expect(invalid([{ ...subAgentThread(), [field]: records }])).toMatchObject({
      path,
    });
  });

  it.each([
    ['skillLaunches', launch('')],
    ['prompts', prompt('a'.repeat(201))],
    ['closingLines', closing('')],
  ])('refuses an empty or too long record id in %s', (field, record) => {
    expect(invalid([{ ...mainThread('s'), [field]: [record] }])).toMatchObject({
      path: `threads.0.${field}.0.recordId`,
    });
  });

  it('accepts a record id of 200 characters', () => {
    const thread = {
      ...mainThread('s'),
      prompts: [prompt('a'.repeat(200))],
    };
    expect(checkBatch({ parserVersion: 1, threads: [thread] }).status).toBe(
      'ok',
    );
  });

  it.each([
    ['an empty skill', 'skillLaunches', launch('u', { skill: '' }), 'skill'],
    [
      'a subAgentId of another thread',
      'skillLaunches',
      launch('u', { subAgentId: 'a9' }),
      'subAgentId',
    ],
    ['an empty command', 'prompts', prompt('u', { command: '' }), 'command'],
    ['an empty line', 'closingLines', closing('u', { line: '' }), 'line'],
    [
      'a line over 200 characters',
      'closingLines',
      closing('u', { line: 'x'.repeat(201) }),
      'line',
    ],
    [
      'a negative position',
      'closingLines',
      closing('u', { position: -1 }),
      'position',
    ],
    [
      'a fractional position',
      'closingLines',
      closing('u', { position: 1.5 }),
      'position',
    ],
    [
      'a time without offset',
      'prompts',
      prompt('u', { at: '2026-03-12T10:00:00' }),
      'at',
    ],
    [
      'a launch time without offset',
      'skillLaunches',
      launch('u', { at: '2026-03-12 10:00' }),
      'at',
    ],
  ])('refuses %s', (_name, field, record, key) => {
    const valid: Record<string, (recordId: string) => unknown> = {
      skillLaunches: launch,
      prompts: prompt,
      closingLines: closing,
    };
    const thread = {
      ...mainThread('s'),
      [field]: [valid[field]?.('ok'), record],
    };
    expect(invalid([thread])).toMatchObject({
      path: `threads.0.${field}.1.${key}`,
    });
  });

  it('counts skill launches, prompts and closing lines toward the record limit', () => {
    const quarter = MAX_RECORDS / 4;
    const records = (count: number) =>
      Array.from({ length: count }, (_, index) => `r${index}`);
    const thread = (extra: number) => ({
      ...mainThread(
        'a',
        records(quarter).map((key) => call(key)),
      ),
      skillLaunches: records(quarter).map((recordId) => launch(recordId)),
      prompts: records(quarter).map((recordId) => prompt(recordId)),
      closingLines: records(quarter + extra).map((recordId) =>
        closing(recordId),
      ),
    });
    expect(checkBatch({ parserVersion: 1, threads: [thread(0)] }).status).toBe(
      'ok',
    );
    expect(checkBatch({ parserVersion: 1, threads: [thread(1)] })).toEqual({
      status: 'too-large',
      limit: 'records',
    });
  });
});

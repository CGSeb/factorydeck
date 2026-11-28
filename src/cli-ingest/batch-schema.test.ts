import { describe, expect, it } from 'vitest';
import {
  MAX_PARSER_VERSION,
  MAX_RECORDS,
  MAX_THREADS,
  checkBatch,
  fileKeyOf,
} from './batch-schema.ts';

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

describe('checkBatch', () => {
  it('accepts a batch and ignores unknown fields', () => {
    const result = checkBatch({
      parserVersion: 3,
      threads: [{ ...mainThread(), extra: true }],
      newer: { field: 1 },
    });
    expect(result.status).toBe('ok');
  });

  it('accepts no thread and a thread with no API call', () => {
    expect(checkBatch({ parserVersion: 1, threads: [] }).status).toBe('ok');
    const { apiCalls: _calls, ...thread } = mainThread();
    expect(checkBatch({ parserVersion: 1, threads: [thread] }).status).toBe(
      'ok',
    );
  });

  it.each([0, -1, 1.5, '1', 2_147_483_648])(
    'refuses parserVersion %s',
    (version) => {
      expect(invalid([], version)).toMatchObject({ path: 'parserVersion' });
    },
  );

  it('accepts the largest parserVersion the database stores', () => {
    expect(
      checkBatch({ parserVersion: MAX_PARSER_VERSION, threads: [] }).status,
    ).toBe('ok');
  });

  it('names the dotted path of the first problem', () => {
    const calls = [call('r1'), call('r2'), call('r3', '2026-03-12 10:00')];
    expect(invalid([mainThread('s1'), mainThread('s2', calls)])).toEqual({
      error: 'Expected an ISO 8601 time with an offset',
      path: 'threads.1.apiCalls.2.at',
    });
  });

  it('accepts a time with a numeric offset and refuses one without', () => {
    expect(
      invalid([mainThread('s', [call('r', AT.replace('Z', ''))])]),
    ).toEqual(expect.objectContaining({ path: 'threads.0.apiCalls.0.at' }));
    const offset = mainThread('s', [call('r', '2026-03-12T11:00:00+01:00')]);
    expect(checkBatch({ parserVersion: 1, threads: [offset] }).status).toBe(
      'ok',
    );
  });

  it.each([
    ['a negative token count', { inputTokens: -1 }, 'inputTokens'],
    ['a fractional token count', { outputTokens: 1.5 }, 'outputTokens'],
  ])('refuses %s', (_name, change, field) => {
    const thread = mainThread('s', [{ ...call('r'), ...change }]);
    expect(invalid([thread])).toMatchObject({
      path: `threads.0.apiCalls.0.${field}`,
    });
  });

  it.each([
    ['a negative offset', { from: -1 }, 'from'],
    ['a fractional offset', { readTo: 2.5 }, 'readTo'],
    ['readTo below from', { from: 10, readTo: 9 }, 'readTo'],
    ['an unknown agent', { agent: 'gemini-cli' }, 'agent'],
    [
      'a fileKey of another thread',
      { fileKey: 'claude-code/s2/main' },
      'fileKey',
    ],
    [
      'a sub-agent log without its fields',
      { subAgentId: 'a1', fileKey: 'claude-code/s/a1' },
      'subAgent',
    ],
  ])('refuses %s', (_name, change, field) => {
    expect(invalid([{ ...mainThread('s'), ...change }])).toMatchObject({
      path: `threads.0.${field}`,
    });
  });

  it.each([
    ['empty', ''],
    ['over 200 characters', 'a'.repeat(201)],
    ['containing /', 'a/b'],
  ])('refuses a session id %s', (_name, sessionId) => {
    expect(invalid([{ ...mainThread(), sessionId }])).toMatchObject({
      path: 'threads.0.sessionId',
    });
  });

  it('accepts a session id of 200 characters', () => {
    const thread = mainThread('a'.repeat(200));
    expect(checkBatch({ parserVersion: 1, threads: [thread] }).status).toBe(
      'ok',
    );
  });

  it('refuses a fileKey sent twice', () => {
    expect(
      invalid([mainThread('s1'), mainThread('s2'), mainThread('s1')]),
    ).toEqual({
      error: 'fileKey claude-code/s1/main is sent twice',
      path: 'threads.2.fileKey',
    });
  });

  it('accepts the thread and record limits and refuses one more', () => {
    const threads = (count: number) =>
      Array.from({ length: count }, (_, index) => mainThread(`s${index}`, []));
    expect(
      checkBatch({ parserVersion: 1, threads: threads(MAX_THREADS) }).status,
    ).toBe('ok');
    expect(
      checkBatch({ parserVersion: 1, threads: threads(MAX_THREADS + 1) }),
    ).toEqual({
      status: 'too-large',
      limit: 'threads',
    });
    const calls = (count: number) =>
      Array.from({ length: count }, (_, index) => call(`r${index}`));
    const half = MAX_RECORDS / 2;
    expect(
      checkBatch({
        parserVersion: 1,
        threads: [mainThread('a', calls(half)), mainThread('b', calls(half))],
      }).status,
    ).toBe('ok');
    expect(
      checkBatch({
        parserVersion: 1,
        threads: [
          mainThread('a', calls(half)),
          mainThread('b', calls(half + 1)),
        ],
      }),
    ).toEqual({ status: 'too-large', limit: 'records' });
  });
});

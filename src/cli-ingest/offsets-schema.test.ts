import { describe, expect, it } from 'vitest';
import {
  MAX_OFFSET_KEYS,
  MAX_READER_STATE_BYTES,
  checkBatch,
  checkOffsetsRequest,
  fileKeyOf,
  isFileKey,
} from './batch-schema.ts';

function thread(fields: Record<string, unknown> = {}) {
  return {
    fileKey: fileKeyOf('codex', 's1', null),
    agent: 'codex',
    sessionId: 's1',
    subAgentId: null,
    remote: null,
    from: 0,
    readTo: 100,
    readerState: null,
    session: {},
    ...fields,
  };
}

function check(fields: Record<string, unknown>) {
  const result = checkBatch({ parserVersion: 1, threads: [thread(fields)] });
  return result.status === 'invalid'
    ? { error: result.error, path: result.path }
    : result.status;
}

function stateOfBytes(bytes: number) {
  return { pad: 'x'.repeat(bytes - '{"pad":""}'.length) };
}

describe('readerState of a thread', () => {
  it('is required, with JSON null allowed', () => {
    const { readerState: _state, ...missing } = thread();
    const result = checkBatch({ parserVersion: 1, threads: [missing] });
    expect(result.status === 'invalid' && result.path).toBe(
      'threads.0.readerState',
    );
    expect(check({ readerState: null })).toBe('ok');
  });

  it.each([
    ['an object', { sessionId: 's1', pending: ['run'] }],
    ['an array', [1, 'two', null]],
    ['a string', 'state'],
    ['a number', 3],
    ['a boolean', false],
  ])('takes any JSON value: %s', (_name, readerState) => {
    const result = checkBatch({
      parserVersion: 1,
      threads: [thread({ readerState })],
    });
    expect(
      result.status === 'ok' && result.batch.threads[0]?.readerState,
    ).toEqual(readerState);
  });

  it('accepts 16,384 bytes once serialised and refuses one more, with its path', () => {
    expect(check({ readerState: stateOfBytes(MAX_READER_STATE_BYTES) })).toBe(
      'ok',
    );
    expect(
      check({ readerState: stateOfBytes(MAX_READER_STATE_BYTES + 1) }),
    ).toEqual({
      error: 'readerState is over 16384 bytes',
      path: 'threads.0.readerState',
    });
  });

  it('counts the UTF-8 bytes, not the characters', () => {
    const chars = (MAX_READER_STATE_BYTES - '""'.length) / 2;
    expect(check({ readerState: 'é'.repeat(chars) })).toBe('ok');
    expect(check({ readerState: 'é'.repeat(chars + 1) })).toEqual({
      error: 'readerState is over 16384 bytes',
      path: 'threads.0.readerState',
    });
  });

  it('accepts readTo equal to from, a thread that only moves its reader state', () => {
    expect(check({ from: 100, readTo: 100, readerState: { line: 2 } })).toBe(
      'ok',
    );
  });
});

describe('isFileKey', () => {
  it.each([
    ['claude-code/s1/main', true],
    ['codex/s1/a1', true],
    ['gemini/s1/main', false],
    ['claude-code/s1', false],
    ['claude-code/s1/main/extra', false],
    ['claude-code//main', false],
    [`claude-code/${'x'.repeat(201)}/main`, false],
    ['', false],
    ['__proto__', false],
  ])('%s is well formed: %s', (key, expected) => {
    expect(isFileKey(key)).toBe(expected);
  });
});

describe('checkOffsetsRequest', () => {
  it('collapses duplicates and keeps keys that are not well formed', () => {
    expect(
      checkOffsetsRequest({
        fileKeys: ['codex/s1/main', 'nope', 'codex/s1/main'],
      }),
    ).toEqual({ status: 'ok', fileKeys: ['codex/s1/main', 'nope'] });
    expect(checkOffsetsRequest({ fileKeys: [] })).toEqual({
      status: 'ok',
      fileKeys: [],
    });
  });

  it.each([
    ['fileKeys missing', {}, 'fileKeys'],
    ['fileKeys not an array', { fileKeys: 'codex/s1/main' }, 'fileKeys'],
    [
      'a key that is not a string',
      { fileKeys: ['codex/s1/main', 3] },
      'fileKeys.1',
    ],
    ['a body that is not an object', [], ''],
  ])('refuses %s with its path', (_name, body, path) => {
    const result = checkOffsetsRequest(body);
    expect(result.status === 'invalid' && result.path).toBe(path);
  });

  it('accepts 500 keys and refuses 501', () => {
    const keys = (count: number) =>
      Array.from({ length: count }, (_, index) => `codex/s${index}/main`);
    expect(
      checkOffsetsRequest({ fileKeys: keys(MAX_OFFSET_KEYS) }).status,
    ).toBe('ok');
    expect(
      checkOffsetsRequest({ fileKeys: keys(MAX_OFFSET_KEYS + 1) }).status,
    ).toBe('too-large');
  });

  it('checks the keys before their count', () => {
    const keys: unknown[] = Array.from({ length: 600 }, () => 'codex/s/main');
    keys[550] = null;
    expect(checkOffsetsRequest({ fileKeys: keys }).status).toBe('invalid');
  });
});

import { describe, expect, it } from 'vitest';
import { fileKeyOf } from '../cli-ingest/batch-schema.ts';
import { removedSession } from '../db/schema.ts';
import {
  type ThreadInput,
  apiCall as call,
  ingestRequest,
  mainThread,
  minutes,
  subAgentThread,
} from '../test/cli-batch.ts';
import { useIngestApp } from '../test/cli-ingest-app.ts';

const app = useIngestApp();
const { send, stored } = app;
const MAIN = fileKeyOf('claude-code', 's-1', null);
const SUB = fileKeyOf('claude-code', 's-1', 'a1');

async function offsets(
  body: unknown,
  token = app.token(),
  up = true,
): Promise<{ status: number; body: unknown }> {
  const response = await app
    .h()
    .app(up)
    .request('/api/cli/ingest/offsets', ingestRequest(body, token));
  return { status: response.status, body: await response.json() };
}

function part(
  thread: ThreadInput,
  from: number,
  readTo: number,
  readerState: ThreadInput['readerState'] = null,
): ThreadInput {
  return { ...thread, from, readTo, readerState };
}

function batch(...threads: ThreadInput[]) {
  return { parserVersion: 1, threads };
}

const firstPart = () =>
  part(mainThread('s-1', { calls: [call('s-1-r1', minutes(1))] }), 0, 4096, {
    pending: ['build-feature'],
  });
const nextPart = () =>
  part(mainThread('s-1', { calls: [call('s-1-r2', minutes(2))] }), 4096, 8192, {
    pending: [],
  });

describe('POST /api/cli/ingest/offsets', () => {
  it('answers each key as last stored, null for a key never sent', async () => {
    await send(batch(firstPart(), part(subAgentThread('s-1', 'a1'), 0, 2048)));
    expect(await offsets({ fileKeys: [MAIN, SUB, 'codex/s-9/main'] })).toEqual({
      status: 200,
      body: {
        offsets: {
          [MAIN]: {
            readTo: 4096,
            parserVersion: 1,
            readerState: { pending: ['build-feature'] },
          },
          [SUB]: { readTo: 2048, parserVersion: 1, readerState: null },
          'codex/s-9/main': null,
        },
      },
    });
  });

  it('gives back the reader state as an equal JSON value', async () => {
    const readerState = {
      b: [1, 2.5, 'é', null, true],
      a: { nested: { empty: {} } },
    };
    await send(batch(part(mainThread('s-1'), 0, 10, readerState)));
    expect(await offsets({ fileKeys: [MAIN] })).toEqual({
      status: 200,
      body: {
        offsets: { [MAIN]: { readTo: 10, parserVersion: 1, readerState } },
      },
    });
  });

  it('answers null for a key that is not well formed, collapses duplicates, and an empty list', async () => {
    await send(batch(firstPart()));
    expect(
      await offsets({ fileKeys: [MAIN, 'claude-code/s-1', MAIN, '__proto__'] }),
    ).toEqual({
      status: 200,
      body: {
        offsets: {
          [MAIN]: expect.objectContaining({ readTo: 4096 }) as unknown,
          'claude-code/s-1': null,
          ['__proto__']: null,
        },
      },
    });
    expect(await offsets({ fileKeys: [] })).toEqual({
      status: 200,
      body: { offsets: {} },
    });
  });

  it('lets any CLI token read the offsets of a key another account sent', async () => {
    await send(batch(firstPart()));
    const other = await app.connect('bo@example.test', 'Bo', 'new-laptop');
    const answer = await offsets({ fileKeys: [MAIN] }, other);
    expect(answer.body).toEqual({
      offsets: { [MAIN]: expect.objectContaining({ readTo: 4096 }) as unknown },
    });
    expect((await send(batch(nextPart()), {}, other)).status).toBe(200);
    expect((await stored()).calls.map((row) => row.requestKey)).toEqual([
      's-1-r1',
      's-1-r2',
    ]);
  });

  it.each([
    ['fileKeys missing', {}, 'fileKeys'],
    ['fileKeys not an array', { fileKeys: MAIN }, 'fileKeys'],
    ['a key that is not a string', { fileKeys: [MAIN, 7] }, 'fileKeys.1'],
  ])('answers 400 with its path to %s', async (_name, body, path) => {
    const answer = await offsets(body);
    expect(answer.status).toBe(400);
    expect(answer.body).toEqual({ error: expect.any(String) as unknown, path });
  });

  it('accepts 500 keys and answers 413 to 501', async () => {
    const keys = (count: number) =>
      Array.from({ length: count }, (_, index) => `codex/s-${index}/main`);
    const accepted = await offsets({ fileKeys: keys(500) });
    expect(accepted.status).toBe(200);
    expect(
      Object.keys((accepted.body as { offsets: object }).offsets),
    ).toHaveLength(500);
    expect(await offsets({ fileKeys: keys(501) })).toEqual({
      status: 413,
      body: { error: 'Too many file keys', limit: 'fileKeys' },
    });
  });

  it('answers 401 to a refused token and the usual 503 while the database is unreachable', async () => {
    expect(await offsets({ fileKeys: [MAIN] }, 'fdk_wrong')).toEqual({
      status: 401,
      body: { error: 'Run factorydeck login' },
    });
    expect(
      (await offsets({ fileKeys: [MAIN] }, app.token(), false)).status,
    ).toBe(503);
  });
});

describe('POST /api/cli/ingest checks from against the stored offsets', () => {
  it('stores a batch that starts at the stored readTo', async () => {
    await send(batch(firstPart()));
    expect((await send(batch(nextPart()))).status).toBe(200);
    const rows = await stored();
    expect(
      rows.files.map((row) => [row.fileKey, row.readTo, row.readerState]),
    ).toEqual([[MAIN, 8192, { pending: [] }]]);
    expect(rows.calls).toHaveLength(2);
  });

  it('refuses a batch with a mismatch, lists every mismatching thread, and stores nothing of it', async () => {
    await send(batch(firstPart(), part(subAgentThread('s-1', 'a1'), 0, 2048)));
    const before = await stored();
    const answer = await send(
      batch(
        part(mainThread('s-1'), 1000, 5000),
        part(subAgentThread('s-1', 'a1'), 2048, 3000),
        part(subAgentThread('s-1', 'a2'), 10, 20),
        part(mainThread('s-2'), 0, 100),
      ),
    );
    expect(answer).toEqual({
      status: 409,
      body: {
        error: 'Offset mismatch',
        mismatches: [
          { fileKey: MAIN, readTo: 4096 },
          { fileKey: fileKeyOf('claude-code', 's-1', 'a2'), readTo: 0 },
        ],
      },
    });
    expect(await stored()).toEqual(before);
  });

  it('always accepts a thread that starts at 0, even a log sent again or rewritten shorter', async () => {
    await send(batch(firstPart()));
    await send(batch(nextPart()));
    expect((await send(batch(firstPart()))).status).toBe(200);
    expect((await stored()).files.map((row) => row.readTo)).toEqual([4096]);
    expect((await send(batch(part(mainThread('s-1'), 0, 100)))).status).toBe(
      200,
    );
    expect((await stored()).files.map((row) => row.readTo)).toEqual([100]);
  });

  it('keeps the offset of a key when its remote changes', async () => {
    await send(batch(firstPart()));
    const moved = { ...nextPart(), remote: 'git@github.com:acme/other.git' };
    expect((await send(batch(moved))).status).toBe(200);
    expect((await stored()).files.map((row) => row.readTo)).toEqual([8192]);
  });

  it('ignores the threads of a removed session, whatever their from', async () => {
    await app
      .h()
      .db.insert(removedSession)
      .values({
        sessionId: 's-1',
        projectName: 'shop',
        removedAt: new Date(minutes(0)),
      });
    expect(await send(batch(nextPart()))).toEqual({
      status: 200,
      body: { sessions: 0, threads: 0, apiCalls: 0 },
    });
    expect((await offsets({ fileKeys: [MAIN] })).body).toEqual({
      offsets: { [MAIN]: null },
    });
  });
});

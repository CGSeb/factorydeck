import { gzipSync } from 'node:zlib';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  MAX_BATCH_BYTES,
  MAX_DECOMPRESSED_BYTES,
} from '../cli-ingest/batch-schema.ts';
import { LOCK_KEY } from '../ingest/lock.ts';
import {
  apiCall as call,
  ingestRequest,
  mainThread,
  twoSessions,
} from '../test/cli-batch.ts';
import { useIngestApp } from '../test/cli-ingest-app.ts';

const app = useIngestApp();
const { send, stored } = app;

describe('POST /api/cli/ingest refuses', () => {
  it('answers 401 to a refused token and stores nothing', async () => {
    const response = await send(twoSessions(), {}, 'fdk_wrong');
    expect(response).toEqual({
      status: 401,
      body: { error: 'Run factorydeck login' },
    });
    const noHeader = await app
      .h()
      .app()
      .request('/api/cli/ingest', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'x',
      });
    expect(noHeader.status).toBe(401);
    expect((await stored()).sessions).toEqual([]);
  });

  it.each([
    ['a body that is not JSON', { 'content-type': 'text/plain' }],
    ['an unknown encoding', { 'content-encoding': 'br' }],
  ])('answers 415 to %s', async (_name, headers) => {
    expect((await send(twoSessions(), { headers })).status).toBe(415);
    expect((await stored()).sessions).toEqual([]);
  });

  it('answers 400 with the path of the first schema problem, and stores nothing', async () => {
    const batch = twoSessions();
    const bad = mainThread('s-9', {
      calls: [call('k1'), call('k2', '2026-03-12T09:00:00')],
    });
    expect(await send({ ...batch, threads: [...batch.threads, bad] })).toEqual({
      status: 400,
      body: {
        error: 'Expected an ISO 8601 time with an offset',
        path: 'threads.5.apiCalls.1.at',
      },
    });
    expect((await stored()).sessions).toEqual([]);
  });

  it('answers 400 to a body that is not valid JSON or gzip', async () => {
    expect(await send('{"parserVersion": 1,')).toEqual({
      status: 400,
      body: { error: 'Body is not valid JSON', path: '' },
    });
    const corrupt = await app
      .h()
      .app()
      .request('/api/cli/ingest', {
        ...ingestRequest('', app.token(), { gzip: true }),
        body: Buffer.from('not gzip at all'),
      });
    expect(corrupt.status).toBe(400);
    expect(await corrupt.json()).toEqual({
      error: 'Body is not valid gzip',
      path: '',
    });
  });

  function padded(bytes: number): string {
    const start = JSON.stringify({ parserVersion: 1, threads: [], pad: '' });
    return `${start.slice(0, -2)}${'x'.repeat(bytes - start.length)}"}`;
  }

  it('accepts 5 MB as sent and refuses one byte more, before reading it all', async () => {
    expect((await send(padded(MAX_BATCH_BYTES))).status).toBe(200);
    expect(await send(padded(MAX_BATCH_BYTES + 1))).toEqual({
      status: 413,
      body: { error: 'Batch too large', limit: 'body' },
    });
  });

  it('accepts 20 MB decompressed and refuses one byte more', async () => {
    expect(
      (await send(padded(MAX_DECOMPRESSED_BYTES), { gzip: true })).status,
    ).toBe(200);
    const over = gzipSync(padded(MAX_DECOMPRESSED_BYTES + 1));
    expect(over.byteLength).toBeLessThan(MAX_BATCH_BYTES);
    const response = await app
      .h()
      .app()
      .request('/api/cli/ingest', {
        ...ingestRequest('', app.token(), { gzip: true }),
        body: over,
      });
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      error: 'Batch too large',
      limit: 'decompressed',
    });
  });

  it('answers 413 above 2000 threads or 20 000 records, and stores nothing', async () => {
    const threads = Array.from({ length: 2001 }, (_, index) =>
      mainThread(`s-${index}`, { calls: [] }),
    );
    expect(await send({ parserVersion: 1, threads })).toEqual({
      status: 413,
      body: { error: 'Batch too large', limit: 'threads' },
    });
    const calls = Array.from({ length: 20_001 }, (_, index) =>
      call(`r-${index}`),
    );
    expect(
      await send({ parserVersion: 1, threads: [mainThread('s-1', { calls })] }),
    ).toEqual({
      status: 413,
      body: { error: 'Batch too large', limit: 'records' },
    });
    expect((await stored()).sessions).toEqual([]);
  });

  it('waits for the ingestion lock, then answers 503 Busy and stores nothing', async () => {
    app.h().lockWaitMs = 200;
    let release: () => void = () => undefined;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    let locked: () => void = () => undefined;
    const isLocked = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const holder = app.h().db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${LOCK_KEY})`);
      locked();
      await released;
    });
    await isLocked;
    const started = Date.now();
    expect(await send(twoSessions())).toEqual({
      status: 503,
      body: { error: 'Busy, try again' },
    });
    expect(Date.now() - started).toBeGreaterThanOrEqual(200);
    release();
    await holder;
    expect((await stored()).sessions).toEqual([]);
    expect((await send(twoSessions())).status).toBe(200);
  });

  it('answers the usual 503 while the database is unreachable', async () => {
    const response = await app
      .h()
      .app(false)
      .request('/api/cli/ingest', ingestRequest(twoSessions(), app.token()));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'unreachable',
      refreshSeconds: 10,
    });
  });

  it('keeps the 1 MB limit of the other routes', async () => {
    const response = await app
      .h()
      .app()
      .request('/api/cli/logout', {
        ...ingestRequest(padded(1024 * 1024 + 1), app.token()),
      });
    expect(response.status).toBe(413);
  });
});

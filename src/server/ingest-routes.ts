import { promisify } from 'node:util';
import { gunzip } from 'node:zlib';
import type { Context, Hono } from 'hono';
import {
  type Batch,
  type BatchLimit,
  MAX_BATCH_BYTES,
  MAX_DECOMPRESSED_BYTES,
  OFFSET_MISMATCH,
  type OffsetsAnswer,
  TOO_MANY_FILE_KEYS,
  checkBatch,
  checkOffsetsRequest,
} from '../cli-ingest/batch-schema.ts';
import type { Sender, StoreResult } from '../cli-ingest/store-batch.ts';
import type { ApiContext } from './api-context.ts';
import type { CliEnv } from './cli-routes.ts';

export type StoreBatch = (batch: Batch, sender: Sender) => Promise<StoreResult>;
export type ReadOffsets = (fileKeys: string[]) => Promise<OffsetsAnswer>;

export const INGEST_PATH = '/api/cli/ingest';
export const BUSY = 'Busy, try again';
const GZIP = new Set(['gzip', 'x-gzip']);
const IDENTITY = new Set(['', 'identity']);
const unzip = promisify(gunzip);

type BodyRead =
  | { status: 'ok'; bytes: Buffer }
  | { status: 'too-large'; limit: BatchLimit }
  | { status: 'invalid'; error: string };

function isJson(contentType: string | undefined): boolean {
  const mediaType = (contentType ?? '').split(';')[0] ?? '';
  return mediaType.trim().toLowerCase() === 'application/json';
}

function encodingOf(c: Context): string {
  return (c.req.header('content-encoding') ?? '').trim().toLowerCase();
}

async function readLimited(c: Context): Promise<Buffer | undefined> {
  const length = Number(c.req.header('content-length') ?? '0');
  if (length > MAX_BATCH_BYTES) return undefined;
  const body = c.req.raw.body;
  if (body === null) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BATCH_BYTES) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

function isTooLarge(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ERR_BUFFER_TOO_LARGE'
  );
}

async function readBody(c: Context): Promise<BodyRead> {
  const sent = await readLimited(c);
  if (sent === undefined) return { status: 'too-large', limit: 'body' };
  if (!GZIP.has(encodingOf(c))) return { status: 'ok', bytes: sent };
  try {
    return {
      status: 'ok',
      bytes: await unzip(sent, { maxOutputLength: MAX_DECOMPRESSED_BYTES }),
    };
  } catch (error) {
    return isTooLarge(error)
      ? { status: 'too-large', limit: 'decompressed' }
      : { status: 'invalid', error: 'Body is not valid gzip' };
  }
}

function parseJson(bytes: Buffer): { value: unknown } | undefined {
  try {
    return { value: JSON.parse(bytes.toString('utf8')) };
  } catch {
    return undefined;
  }
}

function tooLarge(c: Context, limit: BatchLimit): Response {
  return c.json({ error: 'Batch too large', limit }, 413);
}

function unsupportedMedia(c: Context): Response | undefined {
  if (!isJson(c.req.header('content-type'))) {
    return c.json({ error: 'JSON body expected' }, 415);
  }
  const encoding = encodingOf(c);
  if (!GZIP.has(encoding) && !IDENTITY.has(encoding)) {
    return c.json({ error: 'Content-Encoding must be gzip' }, 415);
  }
  return undefined;
}

export function ingestRoute(
  routes: Hono<CliEnv>,
  store: StoreBatch,
  { fromDatabase }: ApiContext,
): void {
  routes.post('/ingest', async (c) => {
    const refused = unsupportedMedia(c);
    if (refused !== undefined) return refused;
    const body = await readBody(c);
    if (body.status === 'too-large') return tooLarge(c, body.limit);
    const json = body.status === 'ok' ? parseJson(body.bytes) : undefined;
    if (json === undefined) {
      const error =
        body.status === 'invalid' ? body.error : 'Body is not valid JSON';
      return c.json({ error, path: '' }, 400);
    }
    const checked = checkBatch(json.value);
    if (checked.status === 'invalid') {
      return c.json({ error: checked.error, path: checked.path }, 400);
    }
    if (checked.status === 'too-large') return tooLarge(c, checked.limit);
    const { account, machine } = c.get('cli');
    const result = await fromDatabase(() =>
      store(checked.batch, { accountId: account.id, machine }),
    );
    if (result.status === 'unreachable') return c.json(result, 503);
    if (result.status === 'busy') return c.json({ error: BUSY }, 503);
    if (result.status === 'mismatch') {
      return c.json(
        { error: OFFSET_MISMATCH, mismatches: result.mismatches },
        409,
      );
    }
    const { status: _stored, ...counts } = result;
    return c.json(counts, 200);
  });
}

export function offsetsRoute(
  routes: Hono<CliEnv>,
  read: ReadOffsets,
  { fromDatabase }: ApiContext,
): void {
  routes.post('/ingest/offsets', async (c) => {
    const json: unknown = await c.req.json().catch(() => undefined);
    if (json === undefined) {
      return c.json({ error: 'Body is not valid JSON', path: '' }, 400);
    }
    const checked = checkOffsetsRequest(json);
    if (checked.status === 'invalid') {
      return c.json({ error: checked.error, path: checked.path }, 400);
    }
    if (checked.status === 'too-large') {
      return c.json({ error: TOO_MANY_FILE_KEYS, limit: 'fileKeys' }, 413);
    }
    const answer = await fromDatabase(() => read(checked.fileKeys));
    if ('status' in answer) return c.json(answer, 503);
    return c.json(answer, 200);
  });
}

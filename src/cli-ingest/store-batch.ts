import { inArray, sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { ingestFile, removedSession } from '../db/schema.ts';
import { LOCK_KEY } from '../ingest/lock.ts';
import type { Transaction } from '../ingest/store.ts';
import type { Batch, BatchCounts, BatchThread } from './batch.ts';
import type { OffsetMismatch } from './offsets-schema.ts';
import { offsetMismatches } from './offsets.ts';
import { type Sender, storeThread, useSubAgentCwds } from './store-thread.ts';

export type { Sender } from './store-thread.ts';

export interface StoreOptions {
  lockWaitMs?: number;
  now?: () => Date;
}

export type StoreResult =
  | ({ status: 'stored' } & BatchCounts)
  | { status: 'busy' }
  | { status: 'mismatch'; mismatches: OffsetMismatch[] };

export const LOCK_WAIT_MS = 30_000;
const LOCK_NOT_AVAILABLE = '55P03';

class Busy extends Error {}

function errorCode(error: unknown): string | undefined {
  let current: unknown = error;
  while (typeof current === 'object' && current !== null) {
    if ('code' in current && typeof current.code === 'string') {
      return current.code;
    }
    current = 'cause' in current ? current.cause : undefined;
  }
  return undefined;
}

async function takeLock(tx: Transaction, waitMs: number): Promise<void> {
  await tx.execute(
    sql.raw(
      `set local lock_timeout = ${String(Math.max(1, Math.trunc(waitMs)))}`,
    ),
  );
  try {
    await tx.execute(sql`select pg_advisory_xact_lock(${LOCK_KEY})`);
  } catch (error) {
    if (errorCode(error) === LOCK_NOT_AVAILABLE) throw new Busy();
    throw error;
  }
  await tx.execute(sql`set local lock_timeout to default`);
}

async function storeOffset(
  tx: Transaction,
  thread: BatchThread,
  parserVersion: number,
  now: Date,
): Promise<void> {
  const values = {
    readTo: thread.readTo,
    parserVersion,
    readerState: thread.readerState,
    sessionId: thread.sessionId,
    updatedAt: now,
  };
  await tx
    .insert(ingestFile)
    .values({ fileKey: thread.fileKey, ...values })
    .onConflictDoUpdate({ target: ingestFile.fileKey, set: values });
}

async function removedOf(
  tx: Transaction,
  threads: readonly BatchThread[],
): Promise<Set<string>> {
  const ids = [...new Set(threads.map((thread) => thread.sessionId))];
  if (ids.length === 0) return new Set();
  const rows = await tx
    .select({ id: removedSession.sessionId })
    .from(removedSession)
    .where(inArray(removedSession.sessionId, ids));
  return new Set(rows.map((row) => row.id));
}

export async function storeBatch(
  db: Database,
  batch: Batch,
  sender: Sender,
  { lockWaitMs = LOCK_WAIT_MS, now = () => new Date() }: StoreOptions = {},
): Promise<StoreResult> {
  try {
    return await db.transaction(async (tx): Promise<StoreResult> => {
      await takeLock(tx, lockWaitMs);
      const sessionIds = new Set<string>();
      let apiCalls = 0;
      const at = now();
      const removed = await removedOf(tx, batch.threads);
      const threads = batch.threads.filter(
        (thread) => !removed.has(thread.sessionId),
      );
      const mismatches = await offsetMismatches(tx, threads);
      if (mismatches.length > 0) return { status: 'mismatch', mismatches };
      for (const thread of threads) {
        sessionIds.add(thread.sessionId);
        apiCalls += (await storeThread(tx, thread, sender)).apiCalls;
        await storeOffset(tx, thread, batch.parserVersion, at);
      }
      await useSubAgentCwds(tx, [...sessionIds]);
      return {
        status: 'stored',
        sessions: sessionIds.size,
        threads: threads.length,
        apiCalls,
      };
    });
  } catch (error) {
    if (error instanceof Busy) return { status: 'busy' };
    throw error;
  }
}

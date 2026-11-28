import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import {
  apiCall,
  ingestFile,
  removedSession,
  session,
  subAgent,
} from '../db/schema.ts';
import { TOKEN_COUNT_KEY } from '../ingest/codex-usage.ts';
import { LOCK_KEY } from '../ingest/lock.ts';
import { type Transaction, insertChunks } from '../ingest/store.ts';
import { parseRemote } from '../team/remote.ts';
import type {
  Batch,
  BatchApiCall,
  BatchCounts,
  BatchThread,
} from './batch-schema.ts';
import type { OffsetMismatch } from './offsets-schema.ts';
import { offsetMismatches } from './offsets.ts';
import { storeFrictions } from './store-frictions.ts';
import { storeThreadRecords } from './store-records.ts';

export interface Sender {
  accountId: number;
  machine: string;
}

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
const KEY_CHUNK = 500;

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

function normalRemote(remote: string | null): string | null {
  return remote === null ? null : (parseRemote(remote)?.remote ?? null);
}

function dateOf(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

async function storeSession(
  tx: Transaction,
  thread: BatchThread,
  sender: Sender,
): Promise<void> {
  await tx
    .insert(session)
    .values({
      id: thread.sessionId,
      agent: thread.agent,
      sentByAccountId: sender.accountId,
      sentByMachine: sender.machine,
    })
    .onConflictDoUpdate({
      target: session.id,
      set: {
        sentByAccountId: sql`case when ${session.sentByMachine} is null then excluded.sent_by_account_id else ${session.sentByAccountId} end`,
        sentByMachine: sql`coalesce(${session.sentByMachine}, excluded.sent_by_machine)`,
      },
    });
  const remote = normalRemote(thread.remote);
  const fields = thread.session;
  if (thread.subAgentId !== null || fields === undefined) {
    if (remote === null) return;
    await tx
      .update(session)
      .set({ remote })
      .where(and(eq(session.id, thread.sessionId), isNull(session.remote)));
    return;
  }
  const firstAt = dateOf(fields.firstAt);
  await tx
    .update(session)
    .set({
      cwd: fields.cwd,
      cwdFromMain: fields.cwd !== null,
      gitBranch: fields.gitBranch,
      gitBranches: fields.gitBranches,
      title: fields.title,
      firstAt: sql`least(${session.firstAt}, ${firstAt?.toISOString() ?? null}::timestamptz)`,
      lastAt: dateOf(fields.lastAt),
      turnEnded: fields.turnEnded,
      remote: remote ?? sql`${session.remote}`,
    })
    .where(eq(session.id, thread.sessionId));
}

async function storeSubAgent(
  tx: Transaction,
  thread: BatchThread,
): Promise<void> {
  const fields = thread.subAgent;
  if (thread.subAgentId === null || fields === undefined) return;
  const values = {
    toolUseId: fields.toolUseId,
    agentType: fields.agentType,
    description: fields.description,
    model: fields.model,
    cwd: fields.cwd,
    gitBranch: fields.gitBranch,
    lastAt: dateOf(fields.lastAt),
  };
  const firstAt = dateOf(fields.firstAt);
  await tx
    .insert(subAgent)
    .values({
      sessionId: thread.sessionId,
      id: thread.subAgentId,
      ...values,
      firstAt,
    })
    .onConflictDoUpdate({
      target: [subAgent.sessionId, subAgent.id],
      set: {
        ...values,
        firstAt: sql`least(${subAgent.firstAt}, excluded.first_at)`,
      },
    });
}

async function keysOfOtherFiles(
  tx: Transaction,
  thread: BatchThread,
): Promise<Set<string>> {
  const stored = new Set<string>();
  if (thread.agent !== 'codex') return stored;
  const keys = thread.apiCalls
    .map((call) => call.requestKey)
    .filter((key) => !key.startsWith(TOKEN_COUNT_KEY));
  for (let index = 0; index < keys.length; index += KEY_CHUNK) {
    const rows = await tx
      .select({ key: apiCall.requestKey })
      .from(apiCall)
      .where(
        and(
          eq(apiCall.sessionId, thread.sessionId),
          ne(apiCall.sourcePath, thread.fileKey),
          inArray(apiCall.requestKey, keys.slice(index, index + KEY_CHUNK)),
        ),
      );
    for (const row of rows) stored.add(row.key);
  }
  return stored;
}

function callRow(thread: BatchThread, call: BatchApiCall) {
  return {
    sourcePath: thread.fileKey,
    requestKey: call.requestKey,
    sessionId: thread.sessionId,
    subAgentId: thread.subAgentId,
    at: new Date(call.at),
    model: call.model,
    inputTokens: call.inputTokens,
    cacheWriteTokens: call.cacheWriteTokens,
    cacheReadTokens: call.cacheReadTokens,
    outputTokens: call.outputTokens,
  };
}

async function storeCalls(
  tx: Transaction,
  thread: BatchThread,
): Promise<number> {
  const elsewhere = await keysOfOtherFiles(tx, thread);
  const rows = thread.apiCalls
    .filter((call) => !elsewhere.has(call.requestKey))
    .map((call) => callRow(thread, call));
  return insertChunks(rows, (chunk) =>
    tx
      .insert(apiCall)
      .values(chunk)
      .onConflictDoNothing()
      .returning({ id: apiCall.id }),
  );
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

async function useSubAgentCwds(
  tx: Transaction,
  sessionIds: readonly string[],
): Promise<void> {
  if (sessionIds.length === 0) return;
  const ids = sql.join(
    sessionIds.map((id) => sql`${id}`),
    sql`, `,
  );
  await tx.execute(sql`
    update session s set cwd = f.cwd, git_branch = f.git_branch,
      git_branches = case when f.git_branch = '' then '{}'::text[] else array[f.git_branch] end
    from (
      select s2.id, a.cwd, coalesce(a.git_branch, '') as git_branch
      from session s2
      left join lateral (
        select cwd, git_branch from sub_agent
        where session_id = s2.id and cwd is not null
        order by first_at asc nulls last, id limit 1
      ) a on true
      where s2.id in (${ids}) and not s2.cwd_from_main
    ) f
    where s.id = f.id`);
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
        await storeSession(tx, thread, sender);
        await storeSubAgent(tx, thread);
        apiCalls += await storeCalls(tx, thread);
        await storeThreadRecords(tx, thread);
        await storeFrictions(tx, thread);
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

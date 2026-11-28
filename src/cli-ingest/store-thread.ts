import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { apiCall, session, subAgent } from '../db/schema.ts';
import { TOKEN_COUNT_KEY } from '../ingest/codex-usage.ts';
import { type Transaction, insertChunks } from '../ingest/store.ts';
import { parseRemote } from '../team/remote.ts';
import type { BatchApiCall, BatchThread } from './batch.ts';
import { storeFrictions } from './store-frictions.ts';
import { storeThreadRecords } from './store-records.ts';

export interface Sender {
  accountId: number;
  machine: string;
}

const KEY_CHUNK = 500;

function normalRemote(remote: string | null): string | null {
  return remote === null ? null : (parseRemote(remote)?.remote ?? null);
}

function dateOf(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

async function insertSession(
  tx: Transaction,
  thread: BatchThread,
  sender: Sender | null,
): Promise<void> {
  const row = { id: thread.sessionId, agent: thread.agent };
  if (sender === null) {
    await tx.insert(session).values(row).onConflictDoNothing();
    return;
  }
  await tx
    .insert(session)
    .values({
      ...row,
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
}

async function storeSession(
  tx: Transaction,
  thread: BatchThread,
  sender: Sender | null,
): Promise<void> {
  await insertSession(tx, thread, sender);
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

export async function storeThread(
  tx: Transaction,
  thread: BatchThread,
  sender: Sender | null,
): Promise<{ apiCalls: number; skillLaunches: number }> {
  await storeSession(tx, thread, sender);
  await storeSubAgent(tx, thread);
  const apiCalls = await storeCalls(tx, thread);
  const skillLaunches = await storeThreadRecords(tx, thread);
  await storeFrictions(tx, thread);
  return { apiCalls, skillLaunches };
}

export async function useSubAgentCwds(
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

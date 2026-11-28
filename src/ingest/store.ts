import { and, eq, sql } from 'drizzle-orm';
import type { PgAsyncTransaction, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
  UNASSIGNED_PROJECT,
  apiCall,
  closingLine,
  friction,
  ingestState,
  session,
  skillLaunch,
  sourceFile,
  subAgent,
  userPrompt,
} from '../db/schema.ts';
import { STATE_ID } from '../projects/remove.ts';

export type Transaction = PgAsyncTransaction<PgQueryResultHKT>;
type StoredFile = typeof sourceFile.$inferSelect;

const INSERT_CHUNK = 500;

/** State of one ingestion: what each session touched was before it, to resolve projects. */
export interface Run {
  tx: Transaction;
  storedFiles: Map<string, StoredFile>;
  sessions: Map<string, TouchedSession>;
  subAgents: Set<string>;
  projects: Map<string, string>;
}

export interface TouchedSession {
  cwd: string | null;
  project: string;
  reset: boolean;
}

export async function startRun(tx: Transaction): Promise<Run> {
  const stored = await tx.select().from(sourceFile);
  return {
    tx,
    storedFiles: new Map(stored.map((row) => [row.path, row])),
    sessions: new Map(),
    subAgents: new Set(),
    projects: new Map(),
  };
}

export async function touchSession(
  run: Run,
  id: string,
  subAgentId: string | null,
): Promise<TouchedSession> {
  if (subAgentId !== null) run.subAgents.add(`${id}/${subAgentId}`);
  const touched = run.sessions.get(id);
  if (touched !== undefined) return touched;
  const [row] = await run.tx
    .select({ cwd: session.cwd, project: session.project })
    .from(session)
    .where(eq(session.id, id));
  const before = {
    cwd: row?.cwd ?? null,
    project: row?.project ?? UNASSIGNED_PROJECT,
    reset: false,
  };
  run.sessions.set(id, before);
  return before;
}

export async function saveOffset(
  run: Run,
  path: string,
  sizes: {
    sizeBytes: number;
    readOffset: number;
    readerState?: Record<string, unknown>;
  },
): Promise<void> {
  const row = {
    path,
    readerState: null,
    ...sizes,
    ingestedAt: new Date(),
  };
  await run.tx
    .insert(sourceFile)
    .values(row)
    .onConflictDoUpdate({ target: sourceFile.path, set: row });
  run.storedFiles.set(path, row);
}

/**
 * Forgets the read offsets of the main session logs once, so the run reads them again from the
 * start and fills the branches of sessions stored before `git_branches` existed.
 */
export async function readMainLogsAgainOnce(tx: Transaction): Promise<void> {
  const [state] = await tx
    .select()
    .from(ingestState)
    .where(eq(ingestState.id, STATE_ID));
  if (state?.branchesReadDone === true) return;
  await tx.execute(
    sql`delete from ${sourceFile} f using ${session} s
      where right(f.path, length(s.id) + 6) = s.id || '.jsonl'`,
  );
  await tx
    .insert(ingestState)
    .values({ id: STATE_ID, branchesReadDone: true })
    .onConflictDoUpdate({
      target: ingestState.id,
      set: { branchesReadDone: true },
    });
}

/** Deletes the rows read from a file, before it is read again from the start. */
export async function forgetFileRows(
  run: Run,
  thread: { fileKey: string; sessionId: string; subAgentId: string | null },
  path: string,
): Promise<void> {
  const { tx } = run;
  const { fileKey, sessionId, subAgentId } = thread;
  await tx.delete(apiCall).where(eq(apiCall.sourcePath, fileKey));
  await tx.delete(skillLaunch).where(eq(skillLaunch.sourcePath, fileKey));
  await tx.delete(userPrompt).where(eq(userPrompt.sourcePath, fileKey));
  await tx.delete(closingLine).where(eq(closingLine.sourcePath, fileKey));
  await tx.delete(friction).where(eq(friction.sourcePath, path));
  const touched = await touchSession(run, sessionId, subAgentId);
  if (subAgentId === null) {
    touched.reset = true;
    await tx
      .update(session)
      .set({ firstAt: null })
      .where(eq(session.id, sessionId));
  } else {
    await tx
      .update(subAgent)
      .set({ firstAt: null })
      .where(
        and(eq(subAgent.sessionId, sessionId), eq(subAgent.id, subAgentId)),
      );
  }
}

export async function forgetStaleCalls(
  tx: Transaction,
  fileKey: string,
  keys: readonly string[],
): Promise<void> {
  await tx
    .delete(apiCall)
    .where(
      and(
        eq(apiCall.sourcePath, fileKey),
        sql`${apiCall.requestKey} <> all(${sql.param([...keys])}::text[])`,
      ),
    );
}

export async function insertChunks<T>(
  rows: T[],
  insert: (chunk: T[]) => Promise<unknown[]>,
): Promise<number> {
  let inserted = 0;
  for (let index = 0; index < rows.length; index += INSERT_CHUNK) {
    inserted += (await insert(rows.slice(index, index + INSERT_CHUNK))).length;
  }
  return inserted;
}

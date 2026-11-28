import { eq, inArray, or, sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import {
  UNASSIGNED_PROJECT,
  markedReport,
  project,
  projectSession,
  removedSession,
  rootRemote,
  session,
} from '../db/schema.ts';
import { forgetGitHostData } from '../git-host/store.ts';
import { LOCK_KEY } from '../ingest/lock.ts';
import type { Transaction } from '../ingest/store.ts';
import type { RemoveProjectResult } from './project-types.ts';

export const PROJECT_LOCK = 1_990_002;
export const REMOVE_LOCK_TIMEOUT_MS = 30_000;

const CHUNK = 1000;
const LOCK_NOT_AVAILABLE = '55P03';

function codeOf(error: unknown): unknown {
  if (typeof error !== 'object' || error === null) return undefined;
  if ('code' in error && error.code !== undefined) return error.code;
  return 'cause' in error ? codeOf(error.cause) : undefined;
}

async function inChunks<T>(
  values: readonly T[],
  action: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  for (let index = 0; index < values.length; index += CHUNK) {
    await action(values.slice(index, index + CHUNK));
  }
}

async function lockForRemoval(
  tx: Transaction,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (const key of [PROJECT_LOCK, LOCK_KEY]) {
    const left = Math.max(1, deadline - Date.now());
    await tx.execute(
      sql`select set_config('lock_timeout', ${`${String(left)}ms`}, true)`,
    );
    await tx.execute(sql`select pg_advisory_xact_lock(${key})`);
  }
  await tx.execute(sql`select set_config('lock_timeout', '0', true)`);
}

async function forgetSessions(
  tx: Transaction,
  slug: string,
  name: string,
  at: Date,
): Promise<void> {
  const ids = (
    await tx
      .select({ id: projectSession.id })
      .from(projectSession)
      .where(eq(projectSession.project, slug))
  ).map((row) => row.id);
  await inChunks(ids, async (chunk) => {
    await tx
      .insert(removedSession)
      .values(
        chunk.map((sessionId) => ({
          sessionId,
          projectName: name,
          removedAt: at,
        })),
      )
      .onConflictDoNothing();
    await tx.delete(session).where(inArray(session.id, chunk));
  });
}

async function rootsOf(
  tx: Transaction,
  slug: string,
  remote: string,
): Promise<string[]> {
  const recorded = await tx
    .select({ root: rootRemote.root })
    .from(rootRemote)
    .where(eq(rootRemote.remote, remote));
  const linked = await tx
    .selectDistinct({ root: projectSession.root })
    .from(projectSession)
    .where(eq(projectSession.project, slug));
  return [...new Set([...recorded, ...linked].map((row) => row.root))].filter(
    (root) => root !== UNASSIGNED_PROJECT,
  );
}

async function removeLocked(
  tx: Transaction,
  id: number,
  at: Date,
): Promise<RemoveProjectResult> {
  const [found] = await tx.select().from(project).where(eq(project.id, id));
  if (found === undefined) return 'not-found';
  const roots = await rootsOf(tx, found.slug, found.remote);
  await forgetSessions(tx, found.slug, found.name, at);
  if (roots.length > 0) await forgetGitHostData(tx, roots);
  await tx
    .delete(markedReport)
    .where(
      roots.length === 0
        ? eq(markedReport.project, found.slug)
        : or(
            eq(markedReport.project, found.slug),
            inArray(markedReport.project, roots),
          ),
    );
  await tx.delete(rootRemote).where(eq(rootRemote.remote, found.remote));
  await tx.delete(project).where(eq(project.id, id));
  return 'removed';
}

export async function removeProject(
  db: Database,
  id: number,
  at: Date,
  lockTimeoutMs = REMOVE_LOCK_TIMEOUT_MS,
): Promise<RemoveProjectResult> {
  try {
    return await db.transaction(async (tx) => {
      await lockForRemoval(tx, lockTimeoutMs);
      return removeLocked(tx, id, at);
    });
  } catch (error) {
    if (codeOf(error) === LOCK_NOT_AVAILABLE) return 'busy';
    throw error;
  }
}

import { and, count, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import {
  UNASSIGNED_PROJECT,
  projectGitHost,
  ingestState,
  session,
  skippedFile,
  sourceFile,
} from '../db/schema.ts';
import { type FactoryCheck, factoryFile } from '../ingest/factory.ts';
import { sessionIdOfPath } from '../ingest/files.ts';
import type { Transaction } from '../ingest/store.ts';
import { projectNames } from './names.ts';
import type { FactoryStatus, MissingFactory } from './types.ts';

const CHUNK = 1000;
export const STATE_ID = 'ingestion';

async function inChunks<T>(
  values: readonly T[],
  action: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  for (let index = 0; index < values.length; index += CHUNK) {
    await action(values.slice(index, index + CHUNK));
  }
}

function readerSession(state: Record<string, unknown> | null): string {
  const id = state?.['sessionId'];
  return typeof id === 'string' ? id : '';
}

export async function forgetProjects(
  tx: Transaction,
  projects: readonly string[],
  { keepSent = false }: { keepSent?: boolean } = {},
): Promise<number> {
  if (projects.length === 0) return 0;
  const ids = new Set(
    (
      await tx
        .delete(session)
        .where(
          and(
            inArray(session.project, [...projects]),
            keepSent ? isNull(session.sentByMachine) : undefined,
          ),
        )
        .returning({ id: session.id })
    ).map((row) => row.id),
  );
  const paths = (
    await tx
      .select({ path: sourceFile.path, state: sourceFile.readerState })
      .from(sourceFile)
  )
    .filter(
      ({ path, state }) =>
        ids.has(sessionIdOfPath(path)) || ids.has(readerSession(state)),
    )
    .map((row) => row.path);
  await inChunks(paths, (chunk) =>
    tx.delete(sourceFile).where(inArray(sourceFile.path, chunk)),
  );
  await inChunks([...ids], (chunk) =>
    tx.delete(skippedFile).where(inArray(skippedFile.sessionId, chunk)),
  );
  return ids.size;
}

export async function forgetProjectsWithoutFactoryOnce(
  tx: Transaction,
  hasFactory: FactoryCheck,
): Promise<void> {
  const [state] = await tx
    .select()
    .from(ingestState)
    .where(eq(ingestState.id, STATE_ID));
  if (state?.factoryCleanupDone === true) return;
  const projects = (
    await tx.selectDistinct({ project: session.project }).from(session)
  ).map((row) => row.project);
  const without: string[] = [];
  for (const project of projects) {
    if (project === UNASSIGNED_PROJECT || !(await hasFactory(project))) {
      without.push(project);
    }
  }
  await forgetProjects(tx, without, { keepSent: true });
  await tx
    .insert(ingestState)
    .values({ id: STATE_ID, factoryCleanupDone: true })
    .onConflictDoUpdate({
      target: ingestState.id,
      set: { factoryCleanupDone: true },
    });
}

export async function factoryStatus(
  db: Database,
  hasFactory: FactoryCheck,
): Promise<FactoryStatus> {
  const [rows, names, bugs] = await Promise.all([
    db
      .select({ project: session.project, sessions: count() })
      .from(session)
      .groupBy(session.project),
    projectNames(db),
    db
      .select({ project: projectGitHost.project })
      .from(projectGitHost)
      .where(
        and(
          isNotNull(projectGitHost.bugLabel),
          isNotNull(projectGitHost.syncedFrom),
        ),
      )
      .orderBy(projectGitHost.project),
  ]);
  const missing: MissingFactory[] = [];
  for (const { project, sessions } of rows) {
    if (project === UNASSIGNED_PROJECT || (await hasFactory(project))) continue;
    missing.push({
      project,
      name: names.rootLabel(project),
      factoryFile: factoryFile(project),
      sessions,
    });
  }
  missing.sort(
    (a, b) =>
      compare(a.name.toLowerCase(), b.name.toLowerCase()) ||
      compare(a.project, b.project),
  );
  return {
    hasSessions: rows.length > 0,
    missing,
    projects: names.options(),
    bugTickets: bugs.map((row) => row.project),
  };
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

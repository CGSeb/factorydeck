import { eq, inArray, ne } from 'drizzle-orm';
import { storeThread, useSubAgentCwds } from '../cli-ingest/store-thread.ts';
import { UNASSIGNED_PROJECT, friction, session } from '../db/schema.ts';
import { resolveProjects } from './project.ts';
import { type ReadResult, turnOfState } from './readers/reader.ts';
import { type Run, insertChunks, touchSession } from './store.ts';

export type ThreadRead = Extract<ReadResult, { status: 'read' }>;

export interface StoredCounts {
  apiCalls: number;
  skillLaunches: number;
  frictions: number;
}

export async function storeFrictions(
  run: Run,
  path: string,
  { thread, frictions }: ThreadRead,
): Promise<number> {
  const rows = frictions.map(({ recordId, at, ...fields }) => ({
    ...fields,
    sourcePath: path,
    recordUuid: recordId,
    at: new Date(at),
    sessionId: thread.sessionId,
    subAgentId: thread.subAgentId,
    agent: thread.agent,
  }));
  return insertChunks(rows, (chunk) =>
    run.tx
      .insert(friction)
      .values(chunk)
      .onConflictDoNothing()
      .returning({ id: friction.id }),
  );
}

export async function storeRead(
  run: Run,
  path: string,
  read: ThreadRead,
): Promise<StoredCounts> {
  const { thread } = read;
  await touchSession(run, thread.sessionId, thread.subAgentId);
  const stored = await storeThread(
    run.tx,
    { ...thread, remote: null, frictions: [] },
    null,
  );
  const turn =
    thread.subAgentId === null ? turnOfState(read.readerState) : undefined;
  if (turn !== undefined) {
    await run.tx
      .update(session)
      .set(turn)
      .where(eq(session.id, thread.sessionId));
  }
  return { ...stored, frictions: await storeFrictions(run, path, read) };
}

export async function saveSessions(run: Run): Promise<void> {
  const ids = [...run.sessions.keys()];
  if (ids.length === 0) return;
  await useSubAgentCwds(run.tx, ids);
  const rows = (
    await run.tx
      .select({ id: session.id, cwd: session.cwd, project: session.project })
      .from(session)
      .where(inArray(session.id, ids))
  ).map((row) => ({ ...row, project: projectBefore(run, row) }));
  await resolveUnassigned(run, rows);
  for (const row of rows) {
    if (row.project === run.sessions.get(row.id)?.project) continue;
    await run.tx
      .update(session)
      .set({ project: row.project })
      .where(eq(session.id, row.id));
  }
}

function projectBefore(
  run: Run,
  row: { id: string; cwd: string | null; project: string },
): string {
  const before = run.sessions.get(row.id);
  const changed =
    before === undefined || before.reset || before.cwd !== row.cwd;
  const project = changed ? UNASSIGNED_PROJECT : row.project;
  return project === UNASSIGNED_PROJECT
    ? (run.projects.get(row.id) ?? project)
    : project;
}

async function resolveUnassigned(
  run: Run,
  rows: { cwd: string | null; project: string }[],
): Promise<void> {
  const unresolved = rows.filter(
    (row) => row.cwd !== null && row.project === UNASSIGNED_PROJECT,
  );
  if (unresolved.length === 0) return;
  const known = await run.tx
    .selectDistinct({ project: session.project })
    .from(session)
    .where(ne(session.project, UNASSIGNED_PROJECT));
  const projects = await resolveProjects(
    unresolved.flatMap((row) => (row.cwd === null ? [] : [row.cwd])),
    known.map((row) => row.project),
  );
  for (const row of unresolved) {
    row.project = projects.get(row.cwd ?? '') ?? row.project;
  }
}

import { and, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import type { PgAsyncTransaction, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
  UNASSIGNED_PROJECT,
  apiCall,
  session,
  skillLaunch,
  sourceFile,
  subAgent,
  userPrompt,
} from '../db/schema.ts';
import { resolveProjects } from './project.ts';
import { turnEnded } from './records.ts';
import type { SkillLaunchRow, ThreadRows } from './thread.ts';

export type Transaction = PgAsyncTransaction<PgQueryResultHKT>;
export type SessionRow = typeof session.$inferSelect;
export type SubAgentRow = typeof subAgent.$inferSelect;
type StoredFile = typeof sourceFile.$inferSelect;

const INSERT_CHUNK = 500;

/** State of one ingestion: rows touched so far, saved at the end. */
export interface Run {
  tx: Transaction;
  storedFiles: Map<string, StoredFile>;
  sessions: Map<string, SessionRow>;
  subAgents: Map<string, SubAgentRow>;
  projects: Map<string, string>;
}

export async function startRun(tx: Transaction): Promise<Run> {
  const stored = await tx.select().from(sourceFile);
  return {
    tx,
    storedFiles: new Map(stored.map((row) => [row.path, row])),
    sessions: new Map(),
    subAgents: new Map(),
    projects: new Map(),
  };
}

/** The session row, created if needed, kept in the run until `saveSessions`. */
export async function loadSession(run: Run, id: string): Promise<SessionRow> {
  const cached = run.sessions.get(id);
  if (cached !== undefined) {
    return cached;
  }
  const [row] = await run.tx
    .insert(session)
    .values({ id })
    .onConflictDoUpdate({ target: session.id, set: { id } })
    .returning();
  if (row === undefined) {
    throw new Error(`Session ${id} could not be stored.`);
  }
  run.sessions.set(id, row);
  return row;
}

/** The sub-agent row, created with its session if needed, kept until `saveSubAgents`. */
export async function loadSubAgent(
  run: Run,
  sessionId: string,
  id: string,
): Promise<SubAgentRow> {
  const key = `${sessionId}/${id}`;
  const cached = run.subAgents.get(key);
  if (cached !== undefined) {
    return cached;
  }
  await loadSession(run, sessionId);
  const [row] = await run.tx
    .insert(subAgent)
    .values({ sessionId, id })
    .onConflictDoUpdate({
      target: [subAgent.sessionId, subAgent.id],
      set: { id },
    })
    .returning();
  if (row === undefined) {
    throw new Error(`Sub-agent ${key} could not be stored.`);
  }
  run.subAgents.set(key, row);
  return row;
}

export async function saveOffset(
  run: Run,
  path: string,
  sizes: { sizeBytes: number; readOffset: number },
): Promise<void> {
  const row = { path, ...sizes, ingestedAt: new Date() };
  await run.tx
    .insert(sourceFile)
    .values(row)
    .onConflictDoUpdate({ target: sourceFile.path, set: row });
  run.storedFiles.set(path, row);
}

/** Deletes the rows read from a file, before it is read again from the start. */
export async function forgetFileRows(run: Run, path: string): Promise<void> {
  await run.tx.delete(apiCall).where(eq(apiCall.sourcePath, path));
  await run.tx.delete(skillLaunch).where(eq(skillLaunch.sourcePath, path));
  await run.tx.delete(userPrompt).where(eq(userPrompt.sourcePath, path));
}

export function resetSession(row: SessionRow): void {
  Object.assign(row, {
    project: UNASSIGNED_PROJECT,
    cwd: null,
    cwdFromMain: false,
    gitBranch: '',
    title: '',
    firstAt: null,
    lastAt: null,
    turnEnded: false,
    lastStopReason: null,
    userAfterLastAssistant: false,
    lastUserInterrupted: false,
  } satisfies Omit<SessionRow, 'id'>);
}

async function insertChunks<T>(
  rows: T[],
  insert: (chunk: T[]) => Promise<unknown[]>,
): Promise<number> {
  let inserted = 0;
  for (let index = 0; index < rows.length; index += INSERT_CHUNK) {
    inserted += (await insert(rows.slice(index, index + INSERT_CHUNK))).length;
  }
  return inserted;
}

/** Stores the rows of a file, skipping those already stored; returns how many are new. */
export async function insertThreadRows(
  run: Run,
  sessionId: string,
  rows: ThreadRows,
): Promise<{ apiCalls: number; skillLaunches: number }> {
  const { tx } = run;
  await insertChunks(rows.prompts, (chunk) =>
    tx
      .insert(userPrompt)
      .values(chunk)
      .onConflictDoNothing()
      .returning({ id: userPrompt.id }),
  );
  const launches = [
    ...rows.launches,
    ...(await earlierSlashSkills(run, sessionId, rows.earlierSkillPrompts)),
  ];
  return {
    apiCalls: await insertChunks(rows.calls, (chunk) =>
      tx
        .insert(apiCall)
        .values(chunk)
        .onConflictDoNothing()
        .returning({ id: apiCall.id }),
    ),
    skillLaunches: await insertChunks(launches, (chunk) =>
      tx
        .insert(skillLaunch)
        .values(chunk)
        .onConflictDoNothing()
        .returning({ id: skillLaunch.id }),
    ),
  };
}

/** Skill launches of slash commands typed before this run, whose instructions came now. */
async function earlierSlashSkills(
  run: Run,
  sessionId: string,
  promptIds: string[],
): Promise<SkillLaunchRow[]> {
  if (promptIds.length === 0) {
    return [];
  }
  const prompts = await run.tx
    .select()
    .from(userPrompt)
    .where(
      and(
        eq(userPrompt.sessionId, sessionId),
        inArray(userPrompt.promptId, promptIds),
        isNotNull(userPrompt.command),
      ),
    );
  return prompts.flatMap((prompt) =>
    prompt.command === null
      ? []
      : [
          {
            sourcePath: prompt.sourcePath,
            sessionId,
            subAgentId: null,
            recordUuid: prompt.recordUuid,
            at: prompt.at,
            skill: prompt.command,
          },
        ],
  );
}

async function useSubAgentCwds(run: Run, rows: SessionRow[]): Promise<void> {
  for (const row of rows.filter((candidate) => !candidate.cwdFromMain)) {
    const [first] = await run.tx
      .select({ cwd: subAgent.cwd, gitBranch: subAgent.gitBranch })
      .from(subAgent)
      .where(and(eq(subAgent.sessionId, row.id), isNotNull(subAgent.cwd)))
      .orderBy(sql`${subAgent.firstAt} asc nulls last`, subAgent.id)
      .limit(1);
    const cwd = first?.cwd ?? null;
    if (cwd !== row.cwd) {
      row.cwd = cwd;
      row.project = UNASSIGNED_PROJECT;
    }
    row.gitBranch = first?.gitBranch ?? '';
  }
}

/** Resolves the projects of new working directories, then saves every session touched. */
export async function saveSessions(run: Run): Promise<void> {
  const rows = [...run.sessions.values()];
  await useSubAgentCwds(run, rows);
  for (const row of rows) {
    const project = run.projects.get(row.id);
    if (project !== undefined && row.project === UNASSIGNED_PROJECT) {
      row.project = project;
    }
  }
  const unresolved = rows.filter(
    (row) => row.cwd !== null && row.project === UNASSIGNED_PROJECT,
  );
  if (unresolved.length > 0) {
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
  for (const { id, ...fields } of rows) {
    await run.tx
      .update(session)
      .set({ ...fields, turnEnded: turnEnded(fields) })
      .where(eq(session.id, id));
  }
}

export async function saveSubAgents(run: Run): Promise<void> {
  for (const { sessionId, id, ...fields } of run.subAgents.values()) {
    await run.tx
      .update(subAgent)
      .set(fields)
      .where(and(eq(subAgent.sessionId, sessionId), eq(subAgent.id, id)));
  }
}

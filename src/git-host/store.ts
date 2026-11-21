import { and, count, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import {
  gitHostIssue,
  gitHostProject,
  gitHostRequest,
  gitHostRun,
  session,
} from '../db/schema.ts';
import { LOCK_KEY } from '../ingest/lock.ts';
import type { Transaction } from '../ingest/store.ts';
import type { Changes } from './parse.ts';
import type { GitHostName } from './types.ts';

const CHUNK = 500;
const RUN_ID = 'git-host';

export interface ProjectState {
  gitHost: GitHostName | null;
  repository: string | null;
  syncedFrom: Date | null;
}

function isGitHost(value: string | null): value is GitHostName {
  return value === 'github' || value === 'gitlab';
}

export async function projectState(
  db: Database,
  project: string,
): Promise<ProjectState | undefined> {
  const [row] = await db
    .select()
    .from(gitHostProject)
    .where(eq(gitHostProject.project, project));
  if (row === undefined) return undefined;
  return {
    gitHost: isGitHost(row.gitHost) ? row.gitHost : null,
    repository: row.repository,
    syncedFrom: row.syncedFrom,
  };
}

export async function pendingRequests(
  db: Database,
  project: string,
): Promise<number[]> {
  const rows = await db
    .select({ number: gitHostRequest.number })
    .from(gitHostRequest)
    .where(
      and(
        eq(gitHostRequest.project, project),
        eq(gitHostRequest.state, 'open'),
        eq(gitHostRequest.checks, 'pending'),
      ),
    );
  return rows.map((row) => row.number).sort((a, b) => a - b);
}

async function lockedProject(
  tx: Transaction,
  project: string,
): Promise<boolean> {
  await tx.execute(sql`select pg_advisory_xact_lock(${LOCK_KEY})`);
  const [found] = await tx
    .select({ sessions: count() })
    .from(session)
    .where(eq(session.project, project));
  return (found?.sessions ?? 0) > 0;
}

export async function forgetGitHostData(
  tx: Transaction,
  projects: string[],
): Promise<void> {
  if (projects.length === 0) return;
  await tx.delete(gitHostIssue).where(inArray(gitHostIssue.project, projects));
  await tx
    .delete(gitHostRequest)
    .where(inArray(gitHostRequest.project, projects));
  await tx
    .delete(gitHostProject)
    .where(inArray(gitHostProject.project, projects));
}

async function inChunks<T>(
  rows: readonly T[],
  action: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  for (let index = 0; index < rows.length; index += CHUNK) {
    await action(rows.slice(index, index + CHUNK));
  }
}

export interface Success {
  gitHost: GitHostName;
  repository: string;
  startedAt: Date;
  replace: boolean;
  changes: Changes;
}

function dateOrNull(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

const EXCLUDED_ISSUE = {
  title: sql`excluded.title`,
  state: sql`excluded.state`,
  labels: sql`excluded.labels`,
  url: sql`excluded.url`,
  createdAt: sql`excluded.created_at`,
  closedAt: sql`excluded.closed_at`,
  updatedAt: sql`excluded.updated_at`,
};

const EXCLUDED_REQUEST = {
  title: sql`excluded.title`,
  state: sql`excluded.state`,
  draft: sql`excluded.draft`,
  headBranch: sql`excluded.head_branch`,
  url: sql`excluded.url`,
  createdAt: sql`excluded.created_at`,
  mergedAt: sql`excluded.merged_at`,
  closedAt: sql`excluded.closed_at`,
  updatedAt: sql`excluded.updated_at`,
  closes: sql`excluded.closes`,
  checks: sql`excluded.checks`,
};

async function saveChanges(
  tx: Transaction,
  project: string,
  changes: Changes,
): Promise<void> {
  await inChunks(changes.issues, (chunk) =>
    tx
      .insert(gitHostIssue)
      .values(
        chunk.map((issue) => ({
          ...issue,
          project,
          createdAt: new Date(issue.createdAt),
          closedAt: dateOrNull(issue.closedAt),
          updatedAt: new Date(issue.updatedAt),
        })),
      )
      .onConflictDoUpdate({
        target: [gitHostIssue.project, gitHostIssue.number],
        set: EXCLUDED_ISSUE,
      }),
  );
  await inChunks(changes.requests, (chunk) =>
    tx
      .insert(gitHostRequest)
      .values(
        chunk.map((request) => ({
          ...request,
          project,
          createdAt: new Date(request.createdAt),
          mergedAt: dateOrNull(request.mergedAt),
          closedAt: dateOrNull(request.closedAt),
          updatedAt: new Date(request.updatedAt),
        })),
      )
      .onConflictDoUpdate({
        target: [gitHostRequest.project, gitHostRequest.number],
        set: EXCLUDED_REQUEST,
      }),
  );
}

export async function saveSuccess(
  db: Database,
  project: string,
  { gitHost, repository, startedAt, replace, changes }: Success,
): Promise<void> {
  await db.transaction(async (tx) => {
    if (!(await lockedProject(tx, project))) return;
    if (replace) await forgetGitHostData(tx, [project]);
    await saveChanges(tx, project, changes);
    const state = {
      gitHost,
      repository,
      syncedFrom: startedAt,
      error: null,
      errorGitHost: null,
    };
    await tx
      .insert(gitHostProject)
      .values({ project, ...state })
      .onConflictDoUpdate({ target: gitHostProject.project, set: state });
  });
}

export async function saveFailure(
  db: Database,
  project: string,
  gitHost: GitHostName | null,
  error: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    if (!(await lockedProject(tx, project))) return;
    await tx
      .insert(gitHostProject)
      .values({ project, errorGitHost: gitHost, error })
      .onConflictDoUpdate({
        target: gitHostProject.project,
        set: { error, errorGitHost: gitHost },
      });
  });
}

export async function saveRunFinished(db: Database, at: Date): Promise<void> {
  await db
    .insert(gitHostRun)
    .values({ id: RUN_ID, finishedAt: at })
    .onConflictDoUpdate({ target: gitHostRun.id, set: { finishedAt: at } });
}

export async function runFinishedAt(db: Database): Promise<Date | null> {
  const [row] = await db
    .select()
    .from(gitHostRun)
    .where(eq(gitHostRun.id, RUN_ID));
  return row?.finishedAt ?? null;
}

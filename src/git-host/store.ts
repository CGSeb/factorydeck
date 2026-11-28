import { and, count, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import {
  gitHostIssue,
  gitHostProject,
  gitHostRequest,
  gitHostRun,
  project,
} from '../db/schema.ts';
import { LOCK_KEY } from '../ingest/lock.ts';
import type { Transaction } from '../ingest/store.ts';
import type { ProjectOutcomeSettings } from './outcome-settings.ts';
import type { Changes } from './parse.ts';
import type { GitHostName, LabelChange, LabelEvent } from './types.ts';

const CHUNK = 500;
const RUN_ID = 'git-host';

export interface ProjectState {
  gitHost: GitHostName | null;
  repository: string | null;
  syncedFrom: Date | null;
  outcomeSettings: boolean;
  historyRead: boolean;
  fixRead: boolean;
  stateEventsRead: boolean;
  bodyClosesRead: boolean;
}

function isGitHost(value: string | null): value is GitHostName {
  return value === 'github' || value === 'gitlab';
}

export async function projectState(
  db: Database,
  remote: string,
): Promise<ProjectState | undefined> {
  const [row] = await db
    .select()
    .from(gitHostProject)
    .where(eq(gitHostProject.remote, remote));
  if (row === undefined) return undefined;
  return {
    gitHost: isGitHost(row.gitHost) ? row.gitHost : null,
    repository: row.repository,
    syncedFrom: row.syncedFrom,
    outcomeSettings: row.stageLabels !== null,
    historyRead: row.historyRead,
    fixRead: row.fixRead,
    stateEventsRead: row.stateEventsRead,
    bodyClosesRead: row.bodyClosesRead,
  };
}

export async function pendingRequests(
  db: Database,
  remote: string,
): Promise<number[]> {
  const rows = await db
    .select({ number: gitHostRequest.number })
    .from(gitHostRequest)
    .where(
      and(
        eq(gitHostRequest.remote, remote),
        eq(gitHostRequest.state, 'open'),
        eq(gitHostRequest.checks, 'pending'),
      ),
    );
  return rows.map((row) => row.number).sort((a, b) => a - b);
}

async function lockedRemote(tx: Transaction, remote: string): Promise<boolean> {
  await tx.execute(sql`select pg_advisory_xact_lock(${LOCK_KEY})`);
  const [found] = await tx
    .select({ projects: count() })
    .from(project)
    .where(eq(project.remote, remote));
  return (found?.projects ?? 0) > 0;
}

export async function forgetGitHostData(
  tx: Transaction,
  remotes: string[],
): Promise<void> {
  if (remotes.length === 0) return;
  await tx.delete(gitHostIssue).where(inArray(gitHostIssue.remote, remotes));
  await tx
    .delete(gitHostRequest)
    .where(inArray(gitHostRequest.remote, remotes));
  await tx
    .delete(gitHostProject)
    .where(inArray(gitHostProject.remote, remotes));
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
  settings: ProjectOutcomeSettings;
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
  reopened: sql`excluded.reopened`,
  stateEvents: sql`excluded.state_events`,
  needsSpec: sql`excluded.needs_spec`,
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
  report: sql`excluded.report`,
  reports: sql`excluded.reports`,
};

function sameLabel(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function labelChanges(
  events: readonly LabelEvent[],
  label: string,
): LabelChange[] {
  return events
    .filter((event) => sameLabel(event.label, label))
    .map(({ added, at }) => ({ added, at }))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

async function saveChanges(
  tx: Transaction,
  remote: string,
  changes: Changes,
  needsSpecLabel: string,
): Promise<void> {
  await inChunks(changes.issues, (chunk) =>
    tx
      .insert(gitHostIssue)
      .values(
        chunk.map(({ labelEvents, ...issue }) => ({
          ...issue,
          needsSpec: labelChanges(labelEvents, needsSpecLabel),
          remote,
          createdAt: new Date(issue.createdAt),
          closedAt: dateOrNull(issue.closedAt),
          updatedAt: new Date(issue.updatedAt),
        })),
      )
      .onConflictDoUpdate({
        target: [gitHostIssue.remote, gitHostIssue.number],
        set: EXCLUDED_ISSUE,
      }),
  );
  await inChunks(changes.requests, (chunk) =>
    tx
      .insert(gitHostRequest)
      .values(
        chunk.map((request) => ({
          ...request,
          remote,
          createdAt: new Date(request.createdAt),
          mergedAt: dateOrNull(request.mergedAt),
          closedAt: dateOrNull(request.closedAt),
          updatedAt: new Date(request.updatedAt),
        })),
      )
      .onConflictDoUpdate({
        target: [gitHostRequest.remote, gitHostRequest.number],
        set: EXCLUDED_REQUEST,
      }),
  );
}

export async function saveSuccess(
  db: Database,
  remote: string,
  { gitHost, repository, startedAt, replace, changes, settings }: Success,
): Promise<void> {
  await db.transaction(async (tx) => {
    if (!(await lockedRemote(tx, remote))) return;
    if (replace) await forgetGitHostData(tx, [remote]);
    await saveChanges(tx, remote, changes, settings.labels.needs_spec);
    const state = {
      gitHost,
      repository,
      syncedFrom: startedAt,
      error: null,
      errorGitHost: null,
      stageLabels: settings.labels,
      autoMerge: settings.autoMerge,
      bugLabel: settings.bugLabel,
      historyRead: true,
      fixRead: true,
      stateEventsRead: true,
      bodyClosesRead: true,
    };
    await tx
      .insert(gitHostProject)
      .values({ remote, ...state })
      .onConflictDoUpdate({ target: gitHostProject.remote, set: state });
  });
}

export async function saveFailure(
  db: Database,
  remote: string,
  gitHost: GitHostName | null,
  error: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    if (!(await lockedRemote(tx, remote))) return;
    await tx
      .insert(gitHostProject)
      .values({ remote, errorGitHost: gitHost, error })
      .onConflictDoUpdate({
        target: gitHostProject.remote,
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

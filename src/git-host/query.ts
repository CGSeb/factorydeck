import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { gitHostIssue, gitHostProject, gitHostRequest } from '../db/schema.ts';
import type { FactoryCheck } from '../ingest/factory.ts';
import { projectName } from '../projects/remove.ts';
import { runFinishedAt } from './store.ts';
import type {
  ChecksSummary,
  CollectionFailure,
  CollectionStatus,
  GitHostName,
  IssueDetail,
  IssueState,
  RequestState,
  WorkItemIssue,
} from './types.ts';

export interface WorkItemKey {
  project: string;
  number: number | null;
}

export type IssueLookup = (key: WorkItemKey) => WorkItemIssue | null;

function issueState(value: string): IssueState {
  return value === 'closed' ? 'closed' : 'open';
}

function requestState(value: string): RequestState {
  return value === 'merged' || value === 'closed' ? value : 'open';
}

function checksOf(value: string): ChecksSummary {
  return value === 'passing' || value === 'failing' || value === 'pending'
    ? value
    : 'none';
}

function gitHostOf(value: string | null): GitHostName | null {
  return value === 'github' || value === 'gitlab' ? value : null;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export async function lookupIssues(
  db: Database,
  keys: readonly WorkItemKey[],
): Promise<IssueLookup> {
  const wanted = keys.filter(
    (key): key is { project: string; number: number } => key.number !== null,
  );
  const projects = [...new Set(wanted.map((key) => key.project))];
  if (projects.length === 0) return () => null;
  const [collected, issues] = await Promise.all([
    db
      .select({ project: gitHostProject.project })
      .from(gitHostProject)
      .where(
        and(
          inArray(gitHostProject.project, projects),
          isNotNull(gitHostProject.syncedFrom),
        ),
      ),
    db
      .select({
        project: gitHostIssue.project,
        number: gitHostIssue.number,
        title: gitHostIssue.title,
        url: gitHostIssue.url,
      })
      .from(gitHostIssue)
      .where(
        sql`(${gitHostIssue.project}, ${gitHostIssue.number}) in (${sql.join(
          wanted.map((key) => sql`(${key.project}, ${key.number})`),
          sql`, `,
        )})`,
      ),
  ]);
  const done = new Set(collected.map((row) => row.project));
  const found = new Map(
    issues.map((row) => [`${String(row.number)} ${row.project}`, row]),
  );
  return ({ project, number }) => {
    if (number === null) return null;
    if (!done.has(project)) return { status: 'not-collected' };
    const issue = found.get(`${String(number)} ${project}`);
    return issue === undefined
      ? { status: 'not-found' }
      : { status: 'found', title: issue.title, url: issue.url };
  };
}

export async function withIssues<T extends { workItem: number | null }>(
  db: Database,
  rows: T[],
  projectOf: (row: T) => string,
): Promise<(T & { issue: WorkItemIssue | null })[]> {
  const keys = rows.map((row) => ({
    project: projectOf(row),
    number: row.workItem,
  }));
  const issueOf = await lookupIssues(db, keys);
  return rows.map((row, index) => ({
    ...row,
    issue: issueOf(keys[index] ?? { project: '', number: null }),
  }));
}

export async function issueDetail(
  db: Database,
  project: string,
  number: number,
): Promise<IssueDetail | null> {
  const [[state], [issue], requests] = await Promise.all([
    db
      .select({ gitHost: gitHostProject.gitHost })
      .from(gitHostProject)
      .where(
        and(
          eq(gitHostProject.project, project),
          isNotNull(gitHostProject.syncedFrom),
        ),
      ),
    db
      .select()
      .from(gitHostIssue)
      .where(
        and(eq(gitHostIssue.project, project), eq(gitHostIssue.number, number)),
      ),
    db
      .select()
      .from(gitHostRequest)
      .where(
        and(
          eq(gitHostRequest.project, project),
          sql`${gitHostRequest.closes} @> ${JSON.stringify([number])}::jsonb`,
        ),
      )
      .orderBy(desc(gitHostRequest.createdAt), desc(gitHostRequest.number)),
  ]);
  const gitHost = gitHostOf(state?.gitHost ?? null);
  if (gitHost === null || issue === undefined) return null;
  return {
    gitHost,
    number: issue.number,
    title: issue.title,
    url: issue.url,
    state: issueState(issue.state),
    labels: [...issue.labels].sort(
      (a, b) =>
        compareText(a.name.toLowerCase(), b.name.toLowerCase()) ||
        compareText(a.name, b.name),
    ),
    requests: requests.map((request) => ({
      number: request.number,
      title: request.title,
      url: request.url,
      state: requestState(request.state),
      draft: request.draft,
      checks: checksOf(request.checks),
      createdAt: request.createdAt.toISOString(),
    })),
  };
}

export async function collectionStatus(
  db: Database,
  hasFactory: FactoryCheck,
): Promise<CollectionStatus> {
  const [finishedAt, rows] = await Promise.all([
    runFinishedAt(db),
    db
      .select()
      .from(gitHostProject)
      .where(isNotNull(gitHostProject.error))
      .orderBy(gitHostProject.project),
  ]);
  const failures: CollectionFailure[] = [];
  for (const row of rows) {
    if (row.error === null || !(await hasFactory(row.project))) continue;
    failures.push({
      project: row.project,
      name: projectName(row.project),
      gitHost: gitHostOf(row.errorGitHost) ?? gitHostOf(row.gitHost),
      reason: row.error,
    });
  }
  failures.sort(
    (a, b) => compareText(a.name, b.name) || compareText(a.project, b.project),
  );
  return { collectedAt: finishedAt?.toISOString() ?? null, failures };
}

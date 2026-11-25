import { and, inArray, isNotNull, sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { gitHostIssue, gitHostProject } from '../db/schema.ts';
import { type IssueKind, kindOf } from './kind.ts';
import type { WorkItemIssue } from './types.ts';

export interface WorkItemKey {
  project: string;
  number: number | null;
}

export type IssueLookup = (key: WorkItemKey) => WorkItemIssue | null;

interface WorkItem {
  issue: WorkItemIssue | null;
  kind: IssueKind | null;
}

const NO_WORK_ITEM: WorkItem = { issue: null, kind: null };

async function lookupWorkItems(
  db: Database,
  keys: readonly WorkItemKey[],
): Promise<(key: WorkItemKey) => WorkItem> {
  const wanted = keys.filter(
    (key): key is { project: string; number: number } => key.number !== null,
  );
  const projects = [...new Set(wanted.map((key) => key.project))];
  if (projects.length === 0) return () => NO_WORK_ITEM;
  const [collected, issues] = await Promise.all([
    db
      .select({
        project: gitHostProject.project,
        bugLabel: gitHostProject.bugLabel,
      })
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
        labels: gitHostIssue.labels,
      })
      .from(gitHostIssue)
      .where(
        sql`(${gitHostIssue.project}, ${gitHostIssue.number}) in (${sql.join(
          wanted.map((key) => sql`(${key.project}, ${key.number})`),
          sql`, `,
        )})`,
      ),
  ]);
  const done = new Map(collected.map((row) => [row.project, row.bugLabel]));
  const found = new Map(
    issues.map((row) => [`${String(row.number)} ${row.project}`, row]),
  );
  return ({ project, number }) => {
    if (number === null) return NO_WORK_ITEM;
    const bugLabel = done.get(project);
    if (bugLabel === undefined) {
      return { issue: { status: 'not-collected' }, kind: null };
    }
    const issue = found.get(`${String(number)} ${project}`);
    return issue === undefined
      ? { issue: { status: 'not-found' }, kind: null }
      : {
          issue: { status: 'found', title: issue.title, url: issue.url },
          kind: kindOf(issue, bugLabel),
        };
  };
}

export async function lookupIssues(
  db: Database,
  keys: readonly WorkItemKey[],
): Promise<IssueLookup> {
  const workItemOf = await lookupWorkItems(db, keys);
  return (key) => workItemOf(key).issue;
}

export async function withIssues<T extends { workItem: number | null }>(
  db: Database,
  rows: T[],
  projectOf: (row: T) => string,
): Promise<(T & WorkItem)[]> {
  const keys = rows.map((row) => ({
    project: projectOf(row),
    number: row.workItem,
  }));
  const workItemOf = await lookupWorkItems(db, keys);
  return rows.map((row, index) => ({
    ...row,
    ...workItemOf(keys[index] ?? { project: '', number: null }),
  }));
}

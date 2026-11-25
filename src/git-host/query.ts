import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { gitHostIssue, gitHostProject, gitHostRequest } from '../db/schema.ts';
import type { FactoryCheck } from '../ingest/factory.ts';
import { projectNames } from '../projects/names.ts';
import { type IssueKind, kindOf } from './kind.ts';
import { issueMilestones } from './milestones.ts';
import { type StageLabels, issueOutcome } from './outcome.ts';
import {
  type RequestRow,
  outcomeRequest,
  requestState,
} from './outcome-request.ts';
import { runFinishedAt } from './store.ts';
import type {
  ChecksSummary,
  ClosingRequest,
  CollectionFailure,
  CollectionStatus,
  GitHostName,
  IssueDetail,
  IssueLabel,
  IssueOutcome,
  IssueState,
  WorkItemIssue,
} from './types.ts';

function issueState(value: string): IssueState {
  return value === 'closed' ? 'closed' : 'open';
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

export type { RequestRow };

export type IssueRow = typeof gitHostIssue.$inferSelect;

export function outcomeOf(
  issue: IssueRow,
  requests: RequestRow[],
  state: { stageLabels: StageLabels | null; autoMerge: boolean | null },
): IssueOutcome {
  return issueOutcome(
    {
      state: issueState(issue.state),
      labels: issue.labels.map((label) => label.name),
      reopened: issue.reopened,
      needsSpec: issue.needsSpec,
    },
    requests.map(outcomeRequest),
    { labels: state.stageLabels, autoMerge: state.autoMerge },
  );
}

function closingRequest(request: RequestRow): ClosingRequest {
  return {
    number: request.number,
    title: request.title,
    url: request.url,
    state: requestState(request.state),
    draft: request.draft,
    checks: checksOf(request.checks),
    createdAt: request.createdAt.toISOString(),
  };
}

function sortedLabels(labels: IssueLabel[]): IssueLabel[] {
  return [...labels].sort(
    (a, b) =>
      compareText(a.name.toLowerCase(), b.name.toLowerCase()) ||
      compareText(a.name, b.name),
  );
}

export type OutcomeLookup = (key: { project: string; number: number }) => {
  issue: WorkItemIssue;
  outcome: IssueOutcome | null;
  kind: IssueKind | null;
};

function unknownIssue(
  status: 'not-collected' | 'not-found',
): ReturnType<OutcomeLookup> {
  return { issue: { status }, outcome: null, kind: null };
}

export async function lookupOutcomes(
  db: Database,
  keys: readonly { project: string; number: number }[],
): Promise<OutcomeLookup> {
  const projects = [...new Set(keys.map((key) => key.project))];
  if (projects.length === 0) return () => unknownIssue('not-collected');
  const [states, issues, requests] = await Promise.all([
    db
      .select({
        project: gitHostProject.project,
        stageLabels: gitHostProject.stageLabels,
        autoMerge: gitHostProject.autoMerge,
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
      .select()
      .from(gitHostIssue)
      .where(
        sql`(${gitHostIssue.project}, ${gitHostIssue.number}) in (${sql.join(
          keys.map((key) => sql`(${key.project}, ${key.number})`),
          sql`, `,
        )})`,
      ),
    db
      .select()
      .from(gitHostRequest)
      .where(inArray(gitHostRequest.project, projects)),
  ]);
  const stateOf = new Map(states.map((row) => [row.project, row]));
  const issueOf = new Map(
    issues.map((row) => [`${String(row.number)} ${row.project}`, row]),
  );
  return ({ project, number }) => {
    const state = stateOf.get(project);
    if (state === undefined) return unknownIssue('not-collected');
    const issue = issueOf.get(`${String(number)} ${project}`);
    if (issue === undefined) return unknownIssue('not-found');
    const closing = requests.filter(
      (request) =>
        request.project === project && request.closes.includes(number),
    );
    return {
      issue: { status: 'found', title: issue.title, url: issue.url },
      outcome: outcomeOf(issue, closing, state),
      kind: kindOf(issue, state.bugLabel),
    };
  };
}

export async function issueDetail(
  db: Database,
  project: string,
  number: number,
): Promise<IssueDetail | null> {
  const [[state], [issue], requests] = await Promise.all([
    db
      .select({
        gitHost: gitHostProject.gitHost,
        stageLabels: gitHostProject.stageLabels,
        autoMerge: gitHostProject.autoMerge,
      })
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
  if (state === undefined || gitHost === null || issue === undefined) {
    return null;
  }
  return {
    gitHost,
    number: issue.number,
    title: issue.title,
    url: issue.url,
    state: issueState(issue.state),
    labels: sortedLabels(issue.labels),
    requests: requests.map(closingRequest),
    outcome: outcomeOf(issue, requests, state),
    milestones: issueMilestones(requests, issue.needsSpec, state.autoMerge),
  };
}

export async function collectionStatus(
  db: Database,
  hasFactory: FactoryCheck,
): Promise<CollectionStatus> {
  const [finishedAt, rows, names] = await Promise.all([
    runFinishedAt(db),
    db
      .select()
      .from(gitHostProject)
      .where(isNotNull(gitHostProject.error))
      .orderBy(gitHostProject.project),
    projectNames(db),
  ]);
  const failures: CollectionFailure[] = [];
  for (const row of rows) {
    if (row.error === null || !(await hasFactory(row.project))) continue;
    failures.push({
      project: row.project,
      name: names.label(row.project),
      gitHost: gitHostOf(row.errorGitHost) ?? gitHostOf(row.gitHost),
      reason: row.error,
    });
  }
  failures.sort(
    (a, b) =>
      compareText(a.name.toLowerCase(), b.name.toLowerCase()) ||
      compareText(a.project, b.project),
  );
  return { collectedAt: finishedAt?.toISOString() ?? null, failures };
}

import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { gitHostIssue, gitHostProject, gitHostRequest } from '../db/schema.ts';
import type { IssueAccumulator } from '../features/allocate.ts';
import type { FeatureQuery } from '../features/types.ts';
import { type UsageWindow, usageInWindows } from '../features/usage.ts';
import { issueKey } from '../features/values.ts';
import { kindOf } from '../git-host/kind.ts';
import type { IssueRow } from '../git-host/query.ts';
import { periodStart } from '../overview/query.ts';
import { withTokenCounts } from '../overview/tokens.ts';
import { projectNames } from '../projects/names.ts';
import type { WorkflowConfig } from '../roles/config.ts';
import { type BugProject, type BugUsage, bugGroups } from './groups.ts';
import type { BugCounts, BugList } from './types.ts';
import { currentVersion, versionsOf } from './versions.ts';

async function bugProjects(
  db: Database,
  project: string | undefined,
): Promise<Omit<BugProject, 'name'>[]> {
  const rows = await db
    .select({
      project: gitHostProject.project,
      stageLabels: gitHostProject.stageLabels,
      autoMerge: gitHostProject.autoMerge,
      bugLabel: gitHostProject.bugLabel,
    })
    .from(gitHostProject)
    .where(
      and(
        isNotNull(gitHostProject.bugLabel),
        isNotNull(gitHostProject.syncedFrom),
        project === undefined ? undefined : eq(gitHostProject.project, project),
      ),
    );
  return rows.flatMap(({ bugLabel, ...row }) =>
    bugLabel === null ? [] : [{ ...row, bugLabel }],
  );
}

const NO_COUNTS: BugCounts = { open: 0, fixed: 0, closed: 0 };

function bugSources(db: Database, roots: string[]) {
  return Promise.all([
    db.select().from(gitHostIssue).where(inArray(gitHostIssue.project, roots)),
    db
      .select()
      .from(gitHostRequest)
      .where(inArray(gitHostRequest.project, roots)),
  ]);
}

export async function bugCounts(
  db: Database,
  project: string | undefined,
): Promise<{ bugTickets: boolean; counts: BugCounts }> {
  const found = await bugProjects(db, project);
  if (found.length === 0) return { bugTickets: false, counts: NO_COUNTS };
  const [issues, requests] = await bugSources(
    db,
    found.map((row) => row.project),
  );
  const { counts } = bugGroups({
    projects: found.map((row) => ({ ...row, name: row.project })),
    issues,
    requests,
    usage: () => undefined,
    startAt: null,
  });
  return { bugTickets: true, counts };
}

function isBug(issue: IssueRow, bugLabels: Map<string, string>): boolean {
  const label = bugLabels.get(issue.project);
  return label !== undefined && kindOf(issue, label) === 'bug';
}

function bugUsage(issue: IssueAccumulator): BugUsage {
  const { tokens, tokenCounts } = withTokenCounts(
    { tokens: issue.tokens },
    issue.tokenCounts,
  );
  return { tokens, tokenCounts, costUsd: issue.costUsd, lastAt: issue.lastAt };
}

async function bugUsages(
  db: Database,
  config: WorkflowConfig,
  scope: UsageWindow,
  { issues, bugLabels }: { issues: IssueRow[]; bugLabels: Map<string, string> },
): Promise<Map<string, BugUsage>> {
  const accumulators = await usageInWindows(
    db,
    config,
    scope,
    issues
      .filter((issue) => isBug(issue, bugLabels))
      .map((issue) => ({
        key: issueKey(issue.project, issue.number),
        startAt: currentVersion(versionsOf(issue)).startedAt,
        endAt: null,
      })),
  );
  return new Map(
    [...accumulators].map(([key, issue]) => [key, bugUsage(issue)]),
  );
}

export async function listBugs(
  db: Database,
  query: FeatureQuery,
  config: WorkflowConfig,
): Promise<BugList> {
  const [found, names] = await Promise.all([
    bugProjects(db, query.project),
    projectNames(db),
  ]);
  const projects = found.map((row) => ({
    ...row,
    name: names.label(row.project),
  }));
  const roots = projects.map((row) => row.project);
  if (roots.length === 0) {
    return {
      bugTickets: false,
      groups: { open: [], fixing: [], fixed: [] },
      counts: NO_COUNTS,
      projects: names.options(),
    };
  }
  const [[issues, requests], startAt] = await Promise.all([
    bugSources(db, roots),
    periodStart(db, query),
  ]);
  const usage = await bugUsages(
    db,
    config,
    { project: query.project, startAt },
    {
      issues,
      bugLabels: new Map(projects.map((row) => [row.project, row.bugLabel])),
    },
  );
  return {
    bugTickets: true,
    ...bugGroups({
      projects,
      issues,
      requests,
      usage: (project, number) => usage.get(issueKey(project, number)),
      startAt,
    }),
    projects: names.options(),
  };
}

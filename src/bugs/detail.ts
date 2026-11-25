import { and, eq, isNotNull, sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { gitHostIssue, gitHostProject, gitHostRequest } from '../db/schema.ts';
import type { StageLabels } from '../git-host/outcome.ts';
import {
  type IssueRow,
  type RequestRow,
  outcomeOf,
} from '../git-host/query.ts';
import type { IssueDetail, IssueOutcome } from '../git-host/types.ts';
import { bugFix } from './fix.ts';
import type { BugFix, BugVersionSpan } from './types.ts';
import { currentVersion, versionOfRequest, versionsOf } from './versions.ts';

export interface BugVersionScope {
  version: BugVersionSpan;
  requests: readonly number[];
  outcome: IssueOutcome;
  fix: BugFix | null;
}

function isoOf(at: number): string {
  return new Date(at).toISOString();
}

export function versionScope(
  issue: IssueRow,
  requests: readonly RequestRow[],
  project: { stageLabels: StageLabels | null; autoMerge: boolean | null },
  requested?: number,
): BugVersionScope | undefined {
  const versions = versionsOf(issue);
  const version =
    requested === undefined
      ? currentVersion(versions)
      : versions.find((found) => found.number === requested);
  if (version === undefined) return undefined;
  const next = versions.find((found) => found.number === version.number + 1);
  const own = requests.filter(
    (request) => versionOfRequest(versions, request) === version.number,
  );
  return {
    version: {
      number: version.number,
      count: versions.length,
      startedAt: isoOf(version.startedAt),
      endedAt: version.endedAt === null ? null : isoOf(version.endedAt),
      reopenedAt: next === undefined ? null : isoOf(next.startedAt),
    },
    requests: own.map((request) => request.number),
    outcome: outcomeOf(
      next === undefined ? issue : { ...issue, state: 'closed' },
      own,
      project,
    ),
    fix: bugFix(own),
  };
}

export async function bugVersion(
  db: Database,
  { project, number }: { project: string; number: number },
  requested?: number,
): Promise<BugVersionScope | undefined> {
  const [[state], [issue], requests] = await Promise.all([
    db
      .select({
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
      ),
  ]);
  if (state === undefined || issue === undefined) return undefined;
  return versionScope(issue, requests, state, requested);
}

export function versionDetail(
  detail: IssueDetail | null,
  { version, requests, outcome }: BugVersionScope,
): IssueDetail | null {
  if (detail === null) return null;
  const start = Date.parse(version.startedAt);
  const end = version.endedAt === null ? Infinity : Date.parse(version.endedAt);
  return {
    ...detail,
    requests: detail.requests.filter((request) =>
      requests.includes(request.number),
    ),
    outcome,
    milestones: detail.milestones.filter((milestone) => {
      if (milestone.kind === 'report') {
        return requests.includes(milestone.request.number);
      }
      const at = Date.parse(milestone.at);
      return at >= start && at <= end;
    }),
  };
}

export function versionWindow({ startedAt, endedAt }: BugVersionSpan): {
  startAt: string;
  endAt: string | null;
} {
  return {
    startAt: startedAt,
    endAt: endedAt === null ? null : isoOf(Date.parse(endedAt) + 1),
  };
}

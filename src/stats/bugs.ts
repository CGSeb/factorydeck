import type { Database } from '../db/client.ts';
import { type IssueKind, kindOf } from '../git-host/kind.ts';
import {
  type IssueRow,
  type RequestRow,
  outcomeOf,
} from '../git-host/query.ts';
import {
  type AutonomyQuery,
  type FactoryFilter,
  MERGED_STAGES,
  type ProjectState,
  type Window,
  factoryProjects,
  inside,
  loadIssues,
  mergeTime,
} from './autonomy.ts';
import { type StatsBounds, earliestMerge, statsBounds } from './bounds.ts';
import type { BugBucket, BugCounts, BugStats, BugStripIssue } from './types.ts';

export type BugQuery = Omit<AutonomyQuery, 'kind'>;

export interface BugFacts {
  project: string;
  number: number;
  title: string;
  kind: IssueKind;
  mergedAt: number | null;
  leadMs: number;
  reopened: boolean;
}

export function bugFacts(
  issue: IssueRow,
  requests: RequestRow[],
  state: ProjectState,
): BugFacts {
  const { stage } = outcomeOf(issue, requests, state);
  const mergedAt = MERGED_STAGES.has(stage) ? mergeTime(requests) : null;
  return {
    project: issue.project,
    number: issue.number,
    title: issue.title,
    kind: kindOf(issue, state.bugLabel),
    mergedAt,
    leadMs:
      mergedAt === null ? 0 : Math.max(0, mergedAt - issue.createdAt.getTime()),
    reopened: issue.reopened,
  };
}

type Merged = BugFacts & { mergedAt: number };

function mergedIn(issues: readonly BugFacts[], window: Window): Merged[] {
  return issues
    .filter(
      (issue): issue is Merged =>
        issue.mergedAt !== null && inside(issue.mergedAt, window),
    )
    .sort((a, b) => a.mergedAt - b.mergedAt);
}

export function bugCounts(
  issues: readonly BugFacts[],
  window: Window,
): BugCounts {
  const merged = mergedIn(issues, window);
  const bugs = merged.filter((issue) => issue.kind === 'bug');
  return {
    merged: merged.length,
    bugs: bugs.length,
    reopened: bugs.filter((issue) => issue.reopened).length,
    fixMs: bugs.map((issue) => issue.leadMs).sort((a, b) => a - b),
  };
}

export function bugBuckets(
  issues: readonly BugFacts[],
  buckets: StatsBounds['buckets'],
): BugBucket[] {
  return buckets.map((bucket, index) => {
    const merged = mergedIn(issues, {
      from: bucket.start,
      to: buckets[index + 1]?.start ?? null,
    });
    return {
      start: bucket.key,
      merged: merged.length,
      bugs: merged.filter((issue) => issue.kind === 'bug').length,
    };
  });
}

function stripIssue(issue: Merged): BugStripIssue {
  return {
    project: issue.project,
    number: issue.number,
    title: issue.title,
    fixMs: issue.leadMs,
  };
}

export function summarizeBugs(
  issues: readonly BugFacts[],
  bounds: StatsBounds,
  bugTickets: boolean,
): BugStats {
  const window = { from: bounds.start, to: null };
  const current = bugCounts(issues, window);
  return {
    current,
    ...(bounds.start === null || bounds.previousStart === null
      ? {}
      : {
          previous: bugCounts(issues, {
            from: bounds.previousStart,
            to: bounds.start,
          }),
        }),
    issues: mergedIn(issues, window)
      .filter((issue) => issue.kind === 'bug')
      .map(stripIssue),
    unit: bounds.unit,
    buckets: bugBuckets(issues, bounds.buckets),
    bugTickets,
    kinds: { feature: current.merged - current.bugs, bug: current.bugs },
  };
}

export async function bugStats(
  db: Database,
  query: BugQuery,
  hasFactory: FactoryFilter,
): Promise<BugStats> {
  const [issues, projects] = await Promise.all([
    loadIssues(db, query.project, hasFactory, bugFacts),
    factoryProjects(db, query.project, hasFactory),
  ]);
  const bounds = await statsBounds(db, {
    ...query,
    earliestMerge: earliestMerge(issues),
  });
  return summarizeBugs(
    issues,
    bounds,
    projects.some((project) => project.bugLabel !== null),
  );
}

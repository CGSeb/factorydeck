import type { Database } from '../db/client.ts';
import type { Allocation, IssueAccumulator } from '../features/allocate.ts';
import { type UsageWindow, allocationIn } from '../features/usage.ts';
import { issueKey } from '../features/values.ts';
import type { IssueRow } from '../git-host/query.ts';
import type { WorkflowConfig } from '../roles/config.ts';
import {
  type AutonomyQuery,
  type FactoryFilter,
  type Window,
  type IssueFacts,
  inside,
  issueFacts,
  loadIssues,
  bucketCounts,
} from './autonomy.ts';
import { type StatsBounds, earliestMerge, statsBounds } from './bounds.ts';
import type {
  FlowIssue,
  FlowPeriod,
  FlowStats,
  FlowStripIssue,
  FlowTokens,
} from './types.ts';

export type FlowQuery = AutonomyQuery;

export interface LoadedIssue {
  issue: IssueRow;
  facts: IssueFacts;
}

export interface FlowUsage {
  lifetime: Allocation;
  current: Allocation;
  previous?: Allocation;
}

function firstCall(usage: IssueAccumulator | undefined): number | null {
  let first: number | null = null;
  for (const thread of usage?.threads.values() ?? []) {
    if (thread.firstAt === null) continue;
    const at = Date.parse(thread.firstAt);
    if (first === null || at < first) first = at;
  }
  return first;
}

export function flowIssue(
  { issue, facts }: LoadedIssue,
  lifetime: Allocation,
): FlowStripIssue | null {
  const mergedAt = facts.mergedAt;
  if (mergedAt === null) return null;
  const usage = lifetime.issues.get(issueKey(issue.project, issue.number));
  const first = firstCall(usage);
  return {
    project: issue.project,
    number: issue.number,
    title: issue.title,
    leadMs: Math.max(0, mergedAt - issue.createdAt.getTime()),
    cycleMs: first === null ? null : Math.max(0, mergedAt - first),
    tokens: first === null ? null : (usage?.tokens ?? 0),
  };
}

export function periodTokens(
  allocation: Allocation,
  dropped: ReadonlySet<string>,
): FlowTokens {
  const { tokens, tokenCounts, apiCalls } = allocation.totals;
  let droppedWork = 0;
  for (const [key, issue] of allocation.issues) {
    if (dropped.has(key)) droppedWork += issue.tokens;
  }
  return {
    total: tokens,
    droppedWork,
    noWorkItem: allocation.noWorkItem?.tokens ?? 0,
    inputSide:
      tokenCounts.input + tokenCounts.cacheWrite + tokenCounts.cacheRead,
    cacheRead: tokenCounts.cacheRead,
    apiCalls,
  };
}

function withoutKey({ leadMs, cycleMs, tokens }: FlowStripIssue): FlowIssue {
  return { leadMs, cycleMs, tokens };
}

export function summarizeFlow(
  issues: readonly LoadedIssue[],
  bounds: StatsBounds,
  usage: FlowUsage,
): FlowStats {
  const dropped = new Set(
    issues
      .filter(({ facts }) => facts.stage === 'closed')
      .map(({ issue }) => issueKey(issue.project, issue.number)),
  );
  const merged = issues.flatMap((loaded) => {
    const flow = flowIssue(loaded, usage.lifetime);
    const mergedAt = loaded.facts.mergedAt;
    return flow === null || mergedAt === null ? [] : [{ flow, mergedAt }];
  });
  const mergedIn = (window: Window): FlowStripIssue[] =>
    merged
      .filter(({ mergedAt }) => inside(mergedAt, window))
      .sort((a, b) => a.mergedAt - b.mergedAt)
      .map(({ flow }) => flow);
  const current: FlowPeriod<FlowStripIssue> = {
    issues: mergedIn({ from: bounds.start, to: null }),
    tokens: periodTokens(usage.current, dropped),
  };
  const previous: FlowPeriod | undefined =
    bounds.start === null ||
    bounds.previousStart === null ||
    usage.previous === undefined
      ? undefined
      : {
          issues: mergedIn({
            from: bounds.previousStart,
            to: bounds.start,
          }).map(withoutKey),
          tokens: periodTokens(usage.previous, dropped),
        };
  return {
    current,
    ...(previous === undefined ? {} : { previous }),
    unit: bounds.unit,
    buckets: bucketCounts(
      issues.map(({ facts }) => facts),
      bounds.buckets,
    ).map(({ start, merged: count }) => ({ start, merged: count })),
  };
}

function iso(at: number | null): string | null {
  return at === null ? null : new Date(at).toISOString();
}

export async function flowStats(
  db: Database,
  query: FlowQuery,
  config: WorkflowConfig,
  hasFactory: FactoryFilter,
): Promise<FlowStats> {
  const { project } = query;
  const issues = await loadIssues(
    db,
    project,
    hasFactory,
    (issue, requests, state) => ({
      issue,
      facts: issueFacts(issue, requests, state),
    }),
  );
  const bounds = await statsBounds(db, {
    ...query,
    earliestMerge: earliestMerge(issues.map(({ facts }) => facts)),
  });
  const window = (
    startAt: number | null,
    endAt: number | null,
  ): UsageWindow => ({
    project,
    startAt: iso(startAt),
    endAt: iso(endAt),
  });
  const [lifetime, current, previous] = await Promise.all([
    allocationIn(db, config, window(null, null)),
    allocationIn(db, config, window(bounds.start, null)),
    bounds.start === null || bounds.previousStart === null
      ? Promise.resolve(undefined)
      : allocationIn(db, config, window(bounds.previousStart, bounds.start)),
  ]);
  return summarizeFlow(issues, bounds, {
    lifetime,
    current,
    ...(previous === undefined ? {} : { previous }),
  });
}

import type { Database } from '../db/client.ts';
import type { Allocation, IssueAccumulator } from '../features/allocate.ts';
import {
  type UsageWindow,
  allocationIn,
  tokensSince,
} from '../features/usage.ts';
import { issueKey } from '../features/values.ts';
import type { IssueRow, RequestRow } from '../git-host/query.ts';
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
import { kinded, ofKind, valuesOf } from './kinded.ts';
import { earliestReport, refusing, storedReports } from './stops.ts';
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
  refusedAt: number | null;
}

export interface FlowUsage {
  lifetime: Allocation;
  current: Allocation;
  previous?: Allocation;
  rework: { current: number; previous?: number };
}

export function firstRefusal(
  requests: readonly Pick<RequestRow, 'reports'>[],
): number | null {
  const first = earliestReport(storedReports(requests).filter(refusing));
  return first === null ? null : Date.parse(first.at);
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

function scopedTotals(
  allocation: Allocation,
  scope: ReadonlySet<string>,
): { tokens: number; apiCalls: number } {
  let tokens = 0;
  let apiCalls = 0;
  for (const [key, issue] of allocation.issues) {
    if (!scope.has(key)) continue;
    tokens += issue.tokens;
    apiCalls += issue.apiCalls;
  }
  return { tokens, apiCalls };
}

export function periodTokens(
  allocation: Allocation,
  dropped: ReadonlySet<string>,
  rework: number,
  scope?: ReadonlySet<string>,
): FlowTokens {
  const { tokens, apiCalls } =
    scope === undefined ? allocation.totals : scopedTotals(allocation, scope);
  let droppedWork = 0;
  for (const [key, issue] of allocation.issues) {
    if (dropped.has(key)) droppedWork += issue.tokens;
  }
  return {
    total: tokens,
    droppedWork,
    noWorkItem: scope === undefined ? (allocation.noWorkItem?.tokens ?? 0) : 0,
    rework,
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
  scope?: ReadonlySet<string>,
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
    tokens: periodTokens(usage.current, dropped, usage.rework.current, scope),
  };
  const previous: FlowPeriod | undefined =
    bounds.start === null ||
    bounds.previousStart === null ||
    usage.previous === undefined ||
    usage.rework.previous === undefined
      ? undefined
      : {
          issues: mergedIn({
            from: bounds.previousStart,
            to: bounds.start,
          }).map(withoutKey),
          tokens: periodTokens(
            usage.previous,
            dropped,
            usage.rework.previous,
            scope,
          ),
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

interface ReworkWindows {
  current: UsageWindow;
  previous: UsageWindow | null;
}

async function reworkTokens(
  db: Database,
  config: WorkflowConfig,
  issues: readonly LoadedIssue[],
  { current, previous }: ReworkWindows,
): Promise<FlowUsage['rework']> {
  const refusals = new Map(
    issues.flatMap(({ issue, refusedAt }) =>
      refusedAt === null
        ? []
        : [[issueKey(issue.project, issue.number), refusedAt] as const],
    ),
  );
  const [now, before] = await Promise.all([
    tokensSince(db, config, current, refusals),
    previous === null
      ? Promise.resolve(undefined)
      : tokensSince(db, config, previous, refusals),
  ]);
  return {
    current: now,
    ...(before === undefined ? {} : { previous: before }),
  };
}

interface FlowIssues {
  issues: LoadedIssue[];
  bounds: StatsBounds;
  scope: ReadonlySet<string> | undefined;
}

async function flowIssues(
  db: Database,
  query: FlowQuery,
  hasFactory: FactoryFilter,
): Promise<FlowIssues> {
  const loaded = await loadIssues(
    db,
    query.project,
    hasFactory,
    kinded((issue, requests, state): LoadedIssue => ({
      issue,
      facts: issueFacts(issue, requests, state),
      refusedAt: firstRefusal(requests),
    })),
  );
  const bounds = await statsBounds(db, {
    ...query,
    earliestMerge: earliestMerge(valuesOf(loaded).map(({ facts }) => facts)),
  });
  const issues = ofKind(loaded, query.kind);
  const keys = issues.map(({ issue }) => issueKey(issue.project, issue.number));
  return {
    issues,
    bounds,
    scope: query.kind === undefined ? undefined : new Set(keys),
  };
}

export async function flowStats(
  db: Database,
  query: FlowQuery,
  config: WorkflowConfig,
  hasFactory: FactoryFilter,
): Promise<FlowStats> {
  const { project } = query;
  const { issues, bounds, scope } = await flowIssues(db, query, hasFactory);
  const window = (
    startAt: number | null,
    endAt: number | null,
  ): UsageWindow => ({
    project,
    startAt: iso(startAt),
    endAt: iso(endAt),
  });
  const previousWindow =
    bounds.start === null || bounds.previousStart === null
      ? null
      : window(bounds.previousStart, bounds.start);
  const currentWindow = window(bounds.start, null);
  const [lifetime, current, previous, rework] = await Promise.all([
    allocationIn(db, config, window(null, null)),
    allocationIn(db, config, currentWindow),
    previousWindow === null
      ? Promise.resolve(undefined)
      : allocationIn(db, config, previousWindow),
    reworkTokens(db, config, issues, {
      current: currentWindow,
      previous: previousWindow,
    }),
  ]);
  return summarizeFlow(
    issues,
    bounds,
    {
      lifetime,
      current,
      ...(previous === undefined ? {} : { previous }),
      rework,
    },
    scope,
  );
}

import { and, eq, isNotNull } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { gitHostProject } from '../db/schema.ts';
import { lookupOutcomes } from '../git-host/query.ts';
import { byCostDescending } from '../overview/query.ts';
import { withTokenCounts } from '../overview/tokens.ts';
import { projectNames } from '../projects/names.ts';
import type { WorkflowConfig } from '../roles/config.ts';
import { loadMarkers } from '../roles/markers.ts';
import {
  type Allocation,
  type IssueAccumulator,
  allocate,
} from './allocate.ts';
import type { RoleAccumulator } from './shares.ts';
import { usageRows } from './usage.ts';
import { issueKey } from './values.ts';
import type {
  FeatureList,
  FeatureQuery,
  FeatureRoleShare,
  FeatureRow,
  FeatureUsage,
  KindCounts,
  MergedSummary,
} from './types.ts';

const MERGED_STAGES: ReadonlySet<string> = new Set([
  'merged',
  'merged-by-person',
  'merged-after-person',
]);

function usageOf(issue: IssueAccumulator): FeatureUsage {
  return withTokenCounts(
    {
      sessions: issue.sessions.size,
      apiCalls: issue.apiCalls,
      tokens: issue.tokens,
      costUsd: issue.costUsd,
      orchestrationCostUsd: issue.orchestrationCostUsd,
    },
    issue.tokenCounts,
  );
}

function shareOf({
  role,
  tokens,
  tokenCounts,
  costUsd,
}: RoleAccumulator): FeatureRoleShare {
  return withTokenCounts({ role, tokens, costUsd }, tokenCounts);
}

function roleShares(issue: IssueAccumulator): FeatureRoleShare[] {
  const roles = [...issue.roles.values()]
    .map(shareOf)
    .sort(
      (left, right) =>
        right.tokens - left.tokens || left.role.localeCompare(right.role),
    );
  return issue.orchestration === null
    ? roles
    : [...roles, shareOf(issue.orchestration)];
}

function mergedUnknownPriceCalls(
  keys: Set<string>,
  allocation: Allocation,
): number {
  let calls = 0;
  for (const key of keys) {
    calls += allocation.issues.get(key)?.unknownPriceCalls ?? 0;
  }
  for (const pool of allocation.pools) {
    if (pool.keys.some((key) => keys.has(key))) calls += pool.unknownPriceCalls;
  }
  return calls;
}

function mergedSummary(
  rows: FeatureRow[],
  allocation: Allocation,
): MergedSummary {
  const merged = rows.filter(
    (row) => row.outcome !== null && MERGED_STAGES.has(row.outcome.stage),
  );
  const keys = new Set(merged.map((row) => issueKey(row.project, row.number)));
  const unknownPriceCalls = mergedUnknownPriceCalls(keys, allocation);
  if (merged.length === 0) {
    return {
      issues: 0,
      costPerIssueUsd: null,
      tokensPerIssue: null,
      withoutPerson: null,
      unknownPriceCalls,
    };
  }
  const cost = merged.reduce((sum, row) => sum + (row.costUsd ?? 0), 0);
  const tokens = merged.reduce((sum, row) => sum + row.tokens, 0);
  const withoutPerson = merged.filter(
    (row) => row.outcome?.stage === 'merged',
  ).length;
  return {
    issues: merged.length,
    costPerIssueUsd: cost / merged.length,
    tokensPerIssue: Math.round(tokens / merged.length),
    withoutPerson: withoutPerson / merged.length,
    unknownPriceCalls,
  };
}

async function hasBugTickets(
  db: Database,
  project: string | undefined,
): Promise<boolean> {
  const rows = await db
    .select({ project: gitHostProject.project })
    .from(gitHostProject)
    .where(
      and(
        isNotNull(gitHostProject.bugLabel),
        project === undefined ? undefined : eq(gitHostProject.project, project),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

function kindCounts(rows: readonly FeatureRow[]): KindCounts {
  return {
    feature: rows.filter((row) => row.kind === 'feature').length,
    bug: rows.filter((row) => row.kind === 'bug').length,
  };
}

export async function listFeatures(
  db: Database,
  query: FeatureQuery,
  config: WorkflowConfig,
): Promise<FeatureList> {
  const markers = await loadMarkers(db, config, { project: query.project });
  const [rows, names, bugTickets] = await Promise.all([
    usageRows(db, query, markers),
    projectNames(db),
    hasBugTickets(db, query.project),
  ]);
  const allocation = allocate(config, rows, markers);
  const issues = [...allocation.issues.values()];
  const outcomeOf = await lookupOutcomes(db, issues);
  const all: FeatureRow[] = issues
    .map((issue) => ({
      project: issue.project,
      projectName: names.label(issue.project),
      number: issue.number,
      ...outcomeOf(issue),
      ...usageOf(issue),
      lastAt: issue.lastAt,
      roles: roleShares(issue),
    }))
    .sort(
      byCostDescending(
        (row) => `${row.project} ${String(row.number).padStart(12, '0')}`,
      ),
    );
  const features =
    query.kind === undefined
      ? all
      : all.filter((row) => row.kind === query.kind);
  return {
    rows: features,
    noWorkItem:
      allocation.noWorkItem === null ? null : usageOf(allocation.noWorkItem),
    totals: allocation.totals,
    merged: mergedSummary(features, allocation),
    projects: names.options(),
    bugTickets,
    kinds: kindCounts(all),
  };
}

export {
  type DetailContext,
  featureDetail,
  versionDetailOf,
} from './detail.ts';

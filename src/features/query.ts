import { and, eq, isNotNull, sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { gitHostProject } from '../db/schema.ts';
import { bugFixOf } from '../bugs/fix.ts';
import { issueFrictionCount } from '../frictions/query.ts';
import { issueDetail, lookupOutcomes } from '../git-host/query.ts';
import { detailInPeriod } from '../git-host/milestones.ts';
import { byCostDescending, periodStart, select } from '../overview/query.ts';
import { emptyCounts, withTokenCounts } from '../overview/tokens.ts';
import { projectNames } from '../projects/names.ts';
import type { WorkflowConfig } from '../roles/config.ts';
import { loadMarkers } from '../roles/markers.ts';
import { type StateOptions, statedSessions } from '../sessions/query.ts';
import { isSessionState } from '../sessions/types.ts';
import {
  type Allocation,
  type IssueAccumulator,
  type Row,
  type SessionUsage,
  allocate,
} from './allocate.ts';
import type { RoleAccumulator, ThreadAccumulator } from './shares.ts';
import { usageRows } from './usage.ts';
import { issueKey, text, timestamp } from './values.ts';
import type {
  FeatureDetail,
  FeatureList,
  FeatureQuery,
  FeatureRole,
  FeatureRoleShare,
  FeatureRow,
  FeatureSession,
  FeatureThread,
  FeatureUsage,
  KindCounts,
  MergedSummary,
} from './types.ts';

export interface DetailContext {
  config: WorkflowConfig;
  state: StateOptions;
}

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

function threadOf({
  tokenCounts,
  ...thread
}: ThreadAccumulator): FeatureThread {
  return withTokenCounts(thread, tokenCounts);
}

function byFirstCall(left: FeatureThread, right: FeatureThread): number {
  const first = (left.firstAt ?? '').localeCompare(right.firstAt ?? '');
  return first === 0 ? left.threadId.localeCompare(right.threadId) : first;
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

function roleOfAccumulator({
  role,
  threads,
  apiCalls,
  tokens,
  tokenCounts,
  costUsd,
}: RoleAccumulator): FeatureRole {
  return withTokenCounts(
    { role, threads: threads.size, apiCalls, tokens, costUsd },
    tokenCounts,
  );
}

async function featureSessions(
  db: Database,
  usage: Map<string, SessionUsage>,
  options: StateOptions,
): Promise<FeatureSession[]> {
  if (usage.size === 0) return [];
  const rows = await select(
    db,
    sql`select t.id, t.title, t.state, t.last_at from ${statedSessions(options)} t
      where t.id in (${sql.join(
        [...usage.keys()].map((id) => sql`${id}`),
        sql`, `,
      )})
      order by t.last_at desc nulls last, t.id`,
  );
  return rows.map((row) => {
    const id = text(row['id']);
    const state = row['state'];
    const session = usage.get(id);
    return withTokenCounts(
      {
        id,
        title: text(row['title']),
        state: isSessionState(state) ? state : 'inactive',
        lastAt: timestamp(row['last_at']),
        tokens: session?.tokens ?? 0,
        costUsd: session?.costUsd ?? null,
      },
      session?.tokenCounts ?? emptyCounts(),
    );
  });
}

export async function featureDetail(
  db: Database,
  key: { project: string; number: number },
  query: FeatureQuery,
  { config, state }: DetailContext,
): Promise<FeatureDetail | undefined> {
  const scoped = { ...query, project: key.project };
  const markers = await loadMarkers(db, config, { project: key.project });
  const [rows, outcomeOf, detail, names, startAt] = await Promise.all([
    usageRows(db, scoped, markers),
    lookupOutcomes(db, [key]),
    issueDetail(db, key.project, key.number),
    projectNames(db),
    periodStart(db, scoped),
  ]);
  const frictions = await issueFrictionCount(db, config, key, startAt);
  const issueOf = (found: Row[]): IssueAccumulator | undefined =>
    allocate(config, found, markers).issues.get(
      issueKey(key.project, key.number),
    );
  const issue = issueOf(rows);
  const { issue: status, kind } = outcomeOf(key);
  if (
    issue === undefined &&
    status.status !== 'found' &&
    issueOf(await usageRows(db, { ...scoped, period: 'all' }, markers)) ===
      undefined
  ) {
    return undefined;
  }
  return {
    ...key,
    projectName: names.label(key.project),
    issue: status,
    kind,
    fix: await bugFixOf(db, key, kind),
    detail: detailInPeriod(detail, startAt),
    roles: [...(issue?.roles.values() ?? [])]
      .map(roleOfAccumulator)
      .sort(byCostDescending((row) => row.role)),
    orchestration:
      issue?.orchestration == null
        ? null
        : roleOfAccumulator(issue.orchestration),
    sessions: await featureSessions(
      db,
      issue?.sessions ?? new Map<string, SessionUsage>(),
      state,
    ),
    threads: [...(issue?.threads.values() ?? [])]
      .map(threadOf)
      .sort(byFirstCall),
    frictions,
  };
}

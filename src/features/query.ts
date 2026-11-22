import { sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { issueDetail, lookupOutcomes } from '../git-host/query.ts';
import { byCostDescending, periodStart, select } from '../overview/query.ts';
import { projectNames } from '../projects/names.ts';
import type { WorkflowConfig } from '../roles/config.ts';
import { type StateOptions, statedSessions } from '../sessions/query.ts';
import { isSessionState } from '../sessions/types.ts';
import {
  type Allocation,
  type IssueAccumulator,
  type RoleAccumulator,
  type Row,
  type SessionUsage,
  allocate,
  issueKey,
  text,
} from './allocate.ts';
import type {
  FeatureDetail,
  FeatureList,
  FeatureQuery,
  FeatureRole,
  FeatureRow,
  FeatureSession,
  FeatureUsage,
  MergedSummary,
} from './types.ts';

export interface DetailContext {
  config: WorkflowConfig;
  state: StateOptions;
}

const MERGED_STAGES: ReadonlySet<string> = new Set([
  'merged',
  'merged-by-person',
]);

function usageOf(issue: IssueAccumulator): FeatureUsage {
  return {
    sessions: issue.sessions.size,
    apiCalls: issue.apiCalls,
    tokens: issue.tokens,
    costUsd: issue.costUsd,
    orchestrationCostUsd: issue.orchestrationCostUsd,
  };
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
      withoutPerson: null,
      unknownPriceCalls,
    };
  }
  const cost = merged.reduce((sum, row) => sum + (row.costUsd ?? 0), 0);
  const withoutPerson = merged.filter(
    (row) => row.outcome?.stage === 'merged',
  ).length;
  return {
    issues: merged.length,
    costPerIssueUsd: cost / merged.length,
    withoutPerson: withoutPerson / merged.length,
    unknownPriceCalls,
  };
}

async function usageRows(db: Database, query: FeatureQuery): Promise<Row[]> {
  const startAt = await periodStart(db, query);
  const project = query.project ?? null;
  return select(
    db,
    sql`select a.session_id, s.project, s.title, s.git_branch as session_branch,
        coalesce(a.sub_agent_id, '') as sub_agent,
        sa.agent_type, sa.description, sa.git_branch as agent_branch, a.model,
        count(*) as calls,
        sum(a.input_tokens) as input,
        sum(a.cache_write_tokens) as cache_write,
        sum(a.cache_read_tokens) as cache_read,
        sum(a.output_tokens) as output
      from api_call a
      join session s on s.id = a.session_id
      left join sub_agent sa on sa.session_id = a.session_id and sa.id = a.sub_agent_id
      where (${project}::text is null or s.project = ${project}::text)
        and (${startAt}::timestamptz is null or a.at >= ${startAt}::timestamptz)
      group by a.session_id, s.project, s.title, s.git_branch, a.sub_agent_id,
        sa.agent_type, sa.description, sa.git_branch, a.model`,
  );
}

export async function listFeatures(
  db: Database,
  query: FeatureQuery,
  config: WorkflowConfig,
): Promise<FeatureList> {
  const [rows, names] = await Promise.all([
    usageRows(db, query),
    projectNames(db),
  ]);
  const allocation = allocate(config, rows);
  const issues = [...allocation.issues.values()];
  const outcomeOf = await lookupOutcomes(db, issues);
  const features: FeatureRow[] = issues
    .map((issue) => ({
      project: issue.project,
      projectName: names.label(issue.project),
      number: issue.number,
      ...outcomeOf(issue),
      ...usageOf(issue),
    }))
    .sort(
      byCostDescending(
        (row) => `${row.project} ${String(row.number).padStart(12, '0')}`,
      ),
    );
  return {
    rows: features,
    noWorkItem:
      allocation.noWorkItem === null ? null : usageOf(allocation.noWorkItem),
    totals: allocation.totals,
    merged: mergedSummary(features, allocation),
    projects: names.options(),
  };
}

function roleOfAccumulator({
  role,
  threads,
  apiCalls,
  tokens,
  costUsd,
}: RoleAccumulator): FeatureRole {
  return { role, threads: threads.size, apiCalls, tokens, costUsd };
}

function timestamp(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return new Date(value).toISOString();
  return null;
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
    return {
      id,
      title: text(row['title']),
      state: isSessionState(state) ? state : 'inactive',
      lastAt: timestamp(row['last_at']),
      tokens: usage.get(id)?.tokens ?? 0,
      costUsd: usage.get(id)?.costUsd ?? null,
    };
  });
}

export async function featureDetail(
  db: Database,
  key: { project: string; number: number },
  query: FeatureQuery,
  { config, state }: DetailContext,
): Promise<FeatureDetail | undefined> {
  const scoped = { ...query, project: key.project };
  const [rows, outcomeOf, detail, names] = await Promise.all([
    usageRows(db, scoped),
    lookupOutcomes(db, [key]),
    issueDetail(db, key.project, key.number),
    projectNames(db),
  ]);
  const issueOf = (found: Row[]): IssueAccumulator | undefined =>
    allocate(config, found).issues.get(issueKey(key.project, key.number));
  const issue = issueOf(rows);
  const { issue: status } = outcomeOf(key);
  if (
    issue === undefined &&
    status.status !== 'found' &&
    issueOf(await usageRows(db, { ...scoped, period: 'all' })) === undefined
  ) {
    return undefined;
  }
  return {
    ...key,
    projectName: names.label(key.project),
    issue: status,
    detail,
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
  };
}

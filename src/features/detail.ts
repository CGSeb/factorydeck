import { sql } from 'drizzle-orm';
import {
  type BugVersionScope,
  bugVersion,
  versionDetail,
  versionWindow,
} from '../bugs/detail.ts';
import type { Database } from '../db/client.ts';
import { issueFrictionCount } from '../frictions/query.ts';
import { detailInPeriod } from '../git-host/milestones.ts';
import { issueDetail, lookupOutcomes } from '../git-host/query.ts';
import { byCostDescending, periodStart, select } from '../overview/query.ts';
import { emptyCounts, withTokenCounts } from '../overview/tokens.ts';
import { projectNames } from '../projects/names.ts';
import type { WorkflowConfig } from '../roles/config.ts';
import { type SessionMarkers, loadMarkers } from '../roles/markers.ts';
import { type StateOptions, statedSessions } from '../sessions/query.ts';
import { isSessionState } from '../sessions/types.ts';
import {
  type IssueAccumulator,
  type Row,
  type SessionUsage,
  allocate,
} from './allocate.ts';
import type { RoleAccumulator, ThreadAccumulator } from './shares.ts';
import {
  type FeatureDetail,
  type FeatureQuery,
  type FeatureRole,
  type FeatureSession,
  type FeatureThread,
  INVALID_VERSION,
} from './types.ts';
import { usageRows, windowRows } from './usage.ts';
import { issueKey, text, timestamp } from './values.ts';

export interface DetailContext {
  config: WorkflowConfig;
  state: StateOptions;
}

type IssueKey = { project: string; number: number };

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

async function issueUsage(
  db: Database,
  key: IssueKey,
  { query, bug }: { query: FeatureQuery; bug: BugVersionScope | undefined },
  { config, markers }: { config: WorkflowConfig; markers: SessionMarkers },
): Promise<{
  issue: IssueAccumulator | undefined;
  known: () => Promise<boolean>;
}> {
  const issueOf = (found: Row[]): IssueAccumulator | undefined =>
    allocate(config, found, markers).issues.get(
      issueKey(key.project, key.number),
    );
  const rows = await (bug === undefined
    ? usageRows(db, query, markers)
    : windowRows(
        db,
        { project: key.project, ...versionWindow(bug.version) },
        markers,
      ));
  const issue = issueOf(rows);
  return {
    issue,
    known: async () =>
      issue !== undefined ||
      issueOf(await usageRows(db, { ...query, period: 'all' }, markers)) !==
        undefined,
  };
}

async function usageDetail(
  db: Database,
  issue: IssueAccumulator | undefined,
  state: StateOptions,
): Promise<
  Pick<FeatureDetail, 'roles' | 'orchestration' | 'sessions' | 'threads'>
> {
  return {
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
  };
}

export async function versionDetailOf(
  db: Database,
  key: IssueKey,
  query: FeatureQuery & { version?: number | undefined },
  { config, state }: DetailContext,
): Promise<FeatureDetail | typeof INVALID_VERSION | undefined> {
  const { version, ...period } = query;
  const scoped = { ...period, project: key.project };
  const [markers, outcomeOf, detail, names, startAt] = await Promise.all([
    loadMarkers(db, config, { project: key.project }),
    lookupOutcomes(db, [key]),
    issueDetail(db, key.project, key.number),
    projectNames(db),
    periodStart(db, scoped),
  ]);
  const { issue: status, kind } = outcomeOf(key);
  const bug = kind === 'bug' ? await bugVersion(db, key, version) : undefined;
  if (version !== undefined && bug === undefined) return INVALID_VERSION;
  const [{ issue, known }, frictions] = await Promise.all([
    issueUsage(db, key, { query: scoped, bug }, { config, markers }),
    issueFrictionCount(db, config, key, startAt),
  ]);
  if (status.status !== 'found' && !(await known())) return undefined;
  return {
    ...key,
    projectName: names.label(key.project),
    issue: status,
    kind,
    fix: bug?.fix ?? null,
    version: bug?.version ?? null,
    detail:
      bug === undefined
        ? detailInPeriod(detail, startAt)
        : versionDetail(detail, bug),
    ...(await usageDetail(db, issue, state)),
    frictions,
  };
}

export async function featureDetail(
  db: Database,
  key: IssueKey,
  query: FeatureQuery,
  context: DetailContext,
): Promise<FeatureDetail | undefined> {
  const found = await versionDetailOf(db, key, query, context);
  return found === INVALID_VERSION ? undefined : found;
}

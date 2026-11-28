import { type SQL, sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { sessionFrictionCount } from '../frictions/load.ts';
import { issueDetail } from '../git-host/query.ts';
import { withIssues } from '../git-host/work-items.ts';
import { periodStart, select } from '../overview/query.ts';
import { totalTokens } from '../overview/tokens.ts';
import { type ProjectNames, projectNames } from '../projects/names.ts';
import {
  DEFAULT_CONFIG,
  type WorkflowConfig,
  rulesFor,
  workItemOf,
} from '../roles/config.ts';
import {
  type SessionMarkers,
  lastMarker,
  loadMarkers,
} from '../roles/markers.ts';
import { sessionSkills } from '../skills/query.ts';
import { subAgentRows, subAgentsOf } from './sub-agents.ts';
import { USAGE_SUMS, type Usage, emptyUsage, usageBy } from './usage.ts';
import {
  type SentBy,
  type SessionDetail,
  type SessionList,
  type SessionListQuery,
  type SessionState,
  type SessionSummary,
  type StateCounts,
  isSessionState,
} from './types.ts';

export interface StateOptions {
  inactiveAfterMinutes: number;
  now?: Date;
}

type Row = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function texts(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function timestamp(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return new Date(value).toISOString();
  return null;
}

function stateOf(value: unknown): SessionState {
  return isSessionState(value) ? value : 'inactive';
}

export function statedSessions({
  inactiveAfterMinutes,
  now = new Date(),
}: StateOptions): SQL {
  return sql`(
    select s.id, s.agent, s.title, s.project, s.root, s.cwd, s.git_branch, s.git_branches,
      least(s.first_at, sa.first_at) as first_at,
      greatest(s.last_at, sa.last_at) as last_at,
      case
        when greatest(s.last_at, sa.last_at)
          > ${now.toISOString()}::timestamptz - make_interval(mins => ${inactiveAfterMinutes}::int)
        then case when s.turn_ended then 'waiting' else 'working' end
        else 'inactive'
      end as state
    from project_session s
    left join (
      select session_id, min(first_at) as first_at, max(last_at) as last_at
      from sub_agent group by session_id
    ) sa on sa.session_id = s.id
  )`;
}

interface Rules {
  config: WorkflowConfig;
  markers: SessionMarkers;
}

function summaryOf(
  row: Row,
  usage: Usage,
  { config, markers }: Rules,
  names: ProjectNames,
): Omit<SessionSummary, 'tokens' | 'tokenCounts' | 'issue' | 'kind'> & {
  usage: Usage;
} {
  const project = text(row['project']);
  const title = text(row['title']);
  const gitBranch = text(row['git_branch']);
  const id = text(row['id']);
  return {
    id,
    agent: text(row['agent']),
    title,
    project,
    projectName: names.label(project),
    gitBranches: texts(row['git_branches']),
    workItem:
      lastMarker(markers, id)?.workItem ??
      workItemOf(rulesFor(config, text(row['root'])), {
        branch: gitBranch,
        title,
      }),
    state: stateOf(row['state']),
    firstAt: timestamp(row['first_at']),
    lastAt: timestamp(row['last_at']),
    costUsd: usage.costUsd,
    usage,
  };
}

async function usageOfSessions(db: Database, ids: string[]): Promise<Row[]> {
  if (ids.length === 0) return [];
  return select(
    db,
    sql`select a.session_id, ${USAGE_SUMS} from api_call a
      where a.session_id in (${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `,
      )})
      group by a.session_id, a.model`,
  );
}

async function pageSummaries(
  db: Database,
  rows: Row[],
  config: WorkflowConfig,
  names: ProjectNames,
): Promise<SessionSummary[]> {
  const ids = rows.map((row) => text(row['id']));
  const [usageRows, markers] = await Promise.all([
    usageOfSessions(db, ids),
    loadMarkers(db, config, { sessionIds: ids }),
  ]);
  const usages = usageBy(usageRows, 'session_id');
  const summaries = await withIssues(
    db,
    rows.map((row) =>
      summaryOf(
        row,
        usages.get(text(row['id'])) ?? emptyUsage(0),
        { config, markers },
        names,
      ),
    ),
    (row) => row.project,
  );
  return summaries.map(({ usage, ...summary }) => ({
    ...summary,
    tokens: totalTokens(usage.tokens),
    tokenCounts: usage.tokens,
  }));
}

export async function listSessions(
  db: Database,
  query: SessionListQuery,
  options: StateOptions,
  config: WorkflowConfig = DEFAULT_CONFIG,
): Promise<SessionList> {
  const startAt = await periodStart(db, {
    ...query,
    now: options.now ?? new Date(),
  });
  const project = query.project ?? null;
  const filtered = sql`select * from ${statedSessions(options)} t
    where (${project}::text is null or t.project = ${project}::text)
      and (${startAt}::timestamptz is null or t.last_at >= ${startAt}::timestamptz)`;
  const state = query.state ?? null;
  const [countRows, totalRows, pageRows, agentRows, names] = await Promise.all([
    select(
      db,
      sql`select f.state, count(*) as sessions from (${filtered}) f group by f.state`,
    ),
    select(
      db,
      sql`select count(*) as sessions from (${filtered}) f
        where ${state}::text is null or f.state = ${state}::text`,
    ),
    select(
      db,
      sql`select * from (${filtered}) f
        where ${state}::text is null or f.state = ${state}::text
        order by f.last_at desc nulls last, f.id
        limit ${query.limit}`,
    ),
    select(
      db,
      sql`select distinct f.agent from (${filtered}) f order by f.agent`,
    ),
    projectNames(db),
  ]);
  const counts: StateCounts = { working: 0, waiting: 0, inactive: 0 };
  for (const row of countRows)
    counts[stateOf(row['state'])] = Number(row['sessions']);
  return {
    sessions: await pageSummaries(db, pageRows, config, names),
    total: Number(totalRows[0]?.['sessions'] ?? 0),
    counts,
    agents: agentRows.map((row) => text(row['agent'])),
    projects: names.options(),
  };
}

async function sentByOf(db: Database, id: string): Promise<SentBy | null> {
  const [row] = await select(
    db,
    sql`select s.sent_by_machine as machine, a.name from session s
      left join account a on a.id = s.sent_by_account_id where s.id = ${id}`,
  );
  const machine = row?.['machine'];
  if (typeof machine !== 'string') return null;
  const name = row?.['name'];
  return { name: typeof name === 'string' ? name : null, machine };
}

export async function sessionDetail(
  db: Database,
  id: string,
  options: StateOptions,
  config: WorkflowConfig = DEFAULT_CONFIG,
): Promise<SessionDetail | undefined> {
  const [detail, sentBy] = await Promise.all([
    storedSessionDetail(db, id, options, config),
    sentByOf(db, id),
  ]);
  return detail === undefined ? undefined : { ...detail, sentBy };
}

async function storedSessionDetail(
  db: Database,
  id: string,
  options: StateOptions,
  config: WorkflowConfig,
): Promise<Omit<SessionDetail, 'sentBy'> | undefined> {
  const [sessionRows, agentRows, usageRows, skills, names, markers, frictions] =
    await Promise.all([
      select(
        db,
        sql`select * from ${statedSessions(options)} t where t.id = ${id}`,
      ),
      subAgentRows(db, id),
      select(
        db,
        sql`select coalesce(a.sub_agent_id, '') as sub_agent, ${USAGE_SUMS}
        from api_call a where a.session_id = ${id}
        group by a.sub_agent_id, a.model`,
      ),
      sessionSkills(db, id),
      projectNames(db),
      loadMarkers(db, config, { sessionIds: [id] }),
      sessionFrictionCount(db, id),
    ]);
  const [row] = sessionRows;
  if (row === undefined) return undefined;
  const total =
    usageBy(
      usageRows.map((usage) => ({ ...usage, sub_agent: '' })),
      'sub_agent',
    ).get('') ?? emptyUsage(0);
  const { usage, ...summary } = summaryOf(
    row,
    total,
    { config, markers },
    names,
  );
  const agents = subAgentsOf(agentRows, usageRows, summary, {
    rules: rulesFor(config, text(row['root']), text(row['project'])),
    markers,
  });
  const { project, workItem } = summary;
  const [[main], subAgents, detail] = await Promise.all([
    withIssues(db, [summary], () => project),
    withIssues(db, agents, () => project),
    workItem === null ? null : issueDetail(db, project, workItem),
  ]);
  return {
    ...(main ?? { ...summary, issue: null, kind: null }),
    issueDetail: detail,
    cwd: typeof row['cwd'] === 'string' ? row['cwd'] : null,
    tokens: usage.tokens,
    subAgents,
    skills,
    frictions,
    projects: names.options(),
  };
}

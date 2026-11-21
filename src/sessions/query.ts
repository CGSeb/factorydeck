import { type SQL, sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { periodStart, select } from '../overview/query.ts';
import type { TokenCounts } from '../overview/types.ts';
import { costOf } from '../pricing.ts';
import {
  DEFAULT_CONFIG,
  type WorkflowConfig,
  roleOf,
  rulesFor,
  workItemOf,
} from '../roles/config.ts';
import { sessionSkills } from '../skills/query.ts';
import {
  type SessionDetail,
  type SessionList,
  type SessionListQuery,
  type SessionState,
  type SessionSummary,
  type StateCounts,
  type SubAgentSummary,
  isSessionState,
} from './types.ts';

export interface StateOptions {
  inactiveAfterMinutes: number;
  now?: Date;
}

type Row = Record<string, unknown>;

interface Usage {
  tokens: TokenCounts;
  costUsd: number | null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function timestamp(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return new Date(value).toISOString();
  return null;
}

function stateOf(value: unknown): SessionState {
  return isSessionState(value) ? value : 'inactive';
}

function statedSessions({
  inactiveAfterMinutes,
  now = new Date(),
}: StateOptions): SQL {
  return sql`(
    select s.id, s.title, s.project, s.cwd, s.git_branch,
      least(s.first_at, sa.first_at) as first_at,
      greatest(s.last_at, sa.last_at) as last_at,
      case
        when greatest(s.last_at, sa.last_at)
          > ${now.toISOString()}::timestamptz - make_interval(mins => ${inactiveAfterMinutes}::int)
        then case when s.turn_ended then 'waiting' else 'working' end
        else 'inactive'
      end as state
    from session s
    left join (
      select session_id, min(first_at) as first_at, max(last_at) as last_at
      from sub_agent group by session_id
    ) sa on sa.session_id = s.id
  )`;
}

function emptyUsage(costUsd: number | null): Usage {
  return {
    tokens: { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 },
    costUsd,
  };
}

function usageBy(rows: Row[], key: string): Map<string, Usage> {
  const usages = new Map<string, Usage>();
  for (const row of rows) {
    const id = text(row[key]);
    const usage = usages.get(id) ?? emptyUsage(null);
    const counts: TokenCounts = {
      input: Number(row['input']),
      cacheWrite: Number(row['cache_write']),
      cacheRead: Number(row['cache_read']),
      output: Number(row['output']),
    };
    usage.tokens.input += counts.input;
    usage.tokens.cacheWrite += counts.cacheWrite;
    usage.tokens.cacheRead += counts.cacheRead;
    usage.tokens.output += counts.output;
    const cost = costOf(text(row['model']), counts);
    if (cost !== undefined) usage.costUsd = (usage.costUsd ?? 0) + cost;
    usages.set(id, usage);
  }
  return usages;
}

function totalTokens({
  input,
  cacheWrite,
  cacheRead,
  output,
}: TokenCounts): number {
  return input + cacheWrite + cacheRead + output;
}

const USAGE_SUMS = sql`a.model,
  sum(a.input_tokens) as input,
  sum(a.cache_write_tokens) as cache_write,
  sum(a.cache_read_tokens) as cache_read,
  sum(a.output_tokens) as output`;

function summaryOf(
  row: Row,
  usage: Usage,
  config: WorkflowConfig,
): Omit<SessionSummary, 'tokens'> & { usage: Usage } {
  const project = text(row['project']);
  const title = text(row['title']);
  const gitBranch = text(row['git_branch']);
  return {
    id: text(row['id']),
    title,
    project,
    gitBranch,
    workItem: workItemOf(rulesFor(config, project), {
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
  const [countRows, totalRows, pageRows, projectRows] = await Promise.all([
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
      sql`select project from session group by project order by project collate "C"`,
    ),
  ]);
  const usageRows = await usageOfSessions(
    db,
    pageRows.map((row) => text(row['id'])),
  );
  const usages = usageBy(usageRows, 'session_id');
  const counts: StateCounts = { working: 0, waiting: 0, inactive: 0 };
  for (const row of countRows)
    counts[stateOf(row['state'])] = Number(row['sessions']);
  return {
    sessions: pageRows.map((row) => {
      const { usage, ...summary } = summaryOf(
        row,
        usages.get(text(row['id'])) ?? emptyUsage(0),
        config,
      );
      return { ...summary, tokens: totalTokens(usage.tokens) };
    }),
    total: Number(totalRows[0]?.['sessions'] ?? 0),
    counts,
    projects: projectRows.map((row) => text(row['project'])),
  };
}

function subAgentsOf(
  agentRows: Row[],
  usageRows: Row[],
  config: WorkflowConfig,
  summary: Pick<SessionSummary, 'project' | 'title' | 'workItem'>,
): SubAgentSummary[] {
  const byAgent = usageBy(usageRows, 'sub_agent');
  const rules = rulesFor(config, summary.project);
  return agentRows.map((agent) => {
    const agentUsage = byAgent.get(text(agent['id'])) ?? emptyUsage(0);
    const agentType = text(agent['agent_type']);
    const description = text(agent['description']);
    return {
      id: text(agent['id']),
      agentType,
      role: roleOf(rules, { agentType, description }),
      workItem:
        workItemOf(rules, {
          description,
          branch: text(agent['git_branch']),
          title: summary.title,
        }) ?? summary.workItem,
      description,
      model: text(agent['model']),
      firstAt: timestamp(agent['first_at']),
      lastAt: timestamp(agent['last_at']),
      tokens: totalTokens(agentUsage.tokens),
      costUsd: agentUsage.costUsd,
    };
  });
}

export async function sessionDetail(
  db: Database,
  id: string,
  options: StateOptions,
  config: WorkflowConfig = DEFAULT_CONFIG,
): Promise<SessionDetail | undefined> {
  const [sessionRows, agentRows, usageRows, skills] = await Promise.all([
    select(
      db,
      sql`select * from ${statedSessions(options)} t where t.id = ${id}`,
    ),
    select(
      db,
      sql`select id, agent_type, description, model, git_branch, first_at, last_at
        from sub_agent where session_id = ${id}
        order by first_at asc nulls last, id`,
    ),
    select(
      db,
      sql`select coalesce(a.sub_agent_id, '') as sub_agent, ${USAGE_SUMS}
        from api_call a where a.session_id = ${id}
        group by a.sub_agent_id, a.model`,
    ),
    sessionSkills(db, id),
  ]);
  const [row] = sessionRows;
  if (row === undefined) return undefined;
  const total =
    usageBy(
      usageRows.map((usage) => ({ ...usage, sub_agent: '' })),
      'sub_agent',
    ).get('') ?? emptyUsage(0);
  const { usage, ...summary } = summaryOf(row, total, config);
  const subAgents = subAgentsOf(agentRows, usageRows, config, summary);
  return {
    ...summary,
    cwd: typeof row['cwd'] === 'string' ? row['cwd'] : null,
    tokens: usage.tokens,
    subAgents,
    skills,
  };
}

import { sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { byCostDescending, periodStart, select } from '../overview/query.ts';
import type { TokenCounts } from '../overview/types.ts';
import { costOf } from '../pricing.ts';
import { projectNames } from '../projects/names.ts';
import { MAIN_ROLE, type WorkflowConfig, roleOf, rulesFor } from './config.ts';
import type { RoleList, RoleQuery, RoleUsage } from './types.ts';

type Row = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

interface Accumulator extends RoleUsage {
  threadIds: Set<string>;
}

function roleOfRow(config: WorkflowConfig, row: Row): string {
  const subAgent = text(row['sub_agent']);
  if (subAgent === '') return MAIN_ROLE;
  return roleOf(rulesFor(config, text(row['project'])), {
    agentType: text(row['agent_type']),
    description: text(row['description']),
  });
}

function threadOf(role: string, row: Row): string {
  const session = text(row['session_id']);
  return role === MAIN_ROLE ? session : `${session}/${text(row['sub_agent'])}`;
}

export function summarizeRoles(
  config: WorkflowConfig,
  rows: Row[],
): RoleUsage[] {
  const roles = new Map<string, Accumulator>();
  const sessions = new Set<string>();
  for (const row of rows) {
    sessions.add(text(row['session_id']));
    const role = roleOfRow(config, row);
    const usage = roles.get(role) ?? {
      role,
      threads: 0,
      apiCalls: 0,
      tokens: 0,
      costUsd: null,
      threadIds: new Set<string>(),
    };
    const counts: TokenCounts = {
      input: Number(row['input']),
      cacheWrite: Number(row['cache_write']),
      cacheRead: Number(row['cache_read']),
      output: Number(row['output']),
    };
    usage.apiCalls += Number(row['calls']);
    usage.tokens +=
      counts.input + counts.cacheWrite + counts.cacheRead + counts.output;
    const cost = costOf(text(row['model']), counts);
    if (cost !== undefined) usage.costUsd = (usage.costUsd ?? 0) + cost;
    usage.threadIds.add(threadOf(role, row));
    roles.set(role, usage);
  }
  if (sessions.size > 0) {
    roles.set(MAIN_ROLE, {
      role: MAIN_ROLE,
      threads: 0,
      apiCalls: 0,
      tokens: 0,
      costUsd: 0,
      ...roles.get(MAIN_ROLE),
      threadIds: sessions,
    });
  }
  return [...roles.values()]
    .map(({ threadIds, ...usage }) => ({ ...usage, threads: threadIds.size }))
    .sort(byCostDescending((row) => row.role));
}

export async function listRoles(
  db: Database,
  query: RoleQuery,
  config: WorkflowConfig,
): Promise<RoleList> {
  const startAt = await periodStart(db, query);
  const project = query.project ?? null;
  const [usageRows, names] = await Promise.all([
    select(
      db,
      sql`select a.session_id, s.project, coalesce(a.sub_agent_id, '') as sub_agent,
          sa.agent_type, sa.description, a.model,
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
        group by a.session_id, s.project, a.sub_agent_id, sa.agent_type, sa.description, a.model`,
    ),
    projectNames(db),
  ]);
  const roles = summarizeRoles(config, usageRows);
  return {
    roles,
    apiCalls: roles.reduce((sum, row) => sum + row.apiCalls, 0),
    projects: names.options(),
  };
}

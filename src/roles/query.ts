import { sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { byCostDescending, periodStart, select } from '../overview/query.ts';
import { addCounts, countsOf, emptyCounts } from '../overview/tokens.ts';
import { costOf } from '../pricing.ts';
import { projectNames } from '../projects/names.ts';
import {
  MAIN_ROLE,
  type WorkflowConfig,
  configuredRoles,
  roleOf,
  rulesFor,
} from './config.ts';
import {
  type SessionMarkers,
  loadMarkers,
  markerOfRow,
  markerSegments,
} from './markers.ts';
import type { RoleList, RoleQuery, RoleUsage } from './types.ts';

type Row = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

interface Accumulator extends RoleUsage {
  threadIds: Set<string>;
}

function roleOfRow(
  config: WorkflowConfig,
  markers: SessionMarkers,
  row: Row,
): string {
  const subAgent = text(row['sub_agent']);
  if (subAgent === '') return markerOfRow(markers, row)?.role ?? MAIN_ROLE;
  return roleOf(rulesFor(config, text(row['project'])), {
    agentType: text(row['agent_type']),
    description: text(row['description']),
  });
}

function threadOf(row: Row): string {
  return `${text(row['session_id'])}/${text(row['sub_agent'])}`;
}

function withMainThreads(
  roles: Map<string, Accumulator>,
  sessions: Set<string>,
  elsewhere: Set<string>,
): void {
  const main = roles.get(MAIN_ROLE);
  const threadIds = new Set(
    [...sessions].filter(
      (id) => !elsewhere.has(id) || main?.threadIds.has(`${id}/`) === true,
    ),
  );
  if (threadIds.size === 0) return;
  roles.set(MAIN_ROLE, {
    role: MAIN_ROLE,
    threads: 0,
    apiCalls: 0,
    tokens: 0,
    tokenCounts: emptyCounts(),
    costUsd: 0,
    ...main,
    threadIds,
  });
}

export function summarizeRoles(
  config: WorkflowConfig,
  rows: Row[],
  markers: SessionMarkers = new Map(),
): RoleUsage[] {
  const roles = new Map<string, Accumulator>();
  const sessions = new Set<string>();
  const elsewhere = new Set<string>();
  for (const row of rows) {
    const sessionId = text(row['session_id']);
    sessions.add(sessionId);
    const role = roleOfRow(config, markers, row);
    if (text(row['sub_agent']) === '' && role !== MAIN_ROLE) {
      elsewhere.add(sessionId);
    }
    const usage = roles.get(role) ?? {
      role,
      threads: 0,
      apiCalls: 0,
      tokens: 0,
      tokenCounts: emptyCounts(),
      costUsd: null,
      threadIds: new Set<string>(),
    };
    const counts = countsOf(row);
    addCounts(usage.tokenCounts, counts);
    usage.apiCalls += Number(row['calls']);
    usage.tokens +=
      counts.input + counts.cacheWrite + counts.cacheRead + counts.output;
    const cost = costOf(text(row['model']), counts);
    if (cost !== undefined) usage.costUsd = (usage.costUsd ?? 0) + cost;
    usage.threadIds.add(threadOf(row));
    roles.set(role, usage);
  }
  withMainThreads(roles, sessions, elsewhere);
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
  const markers = await loadMarkers(db, config, { project: query.project });
  const [usageRows, names] = await Promise.all([
    select(
      db,
      sql`select a.session_id, s.project, coalesce(a.sub_agent_id, '') as sub_agent,
          sa.agent_type, sa.description, marker.idx as marker, a.model,
          count(*) as calls,
          sum(a.input_tokens) as input,
          sum(a.cache_write_tokens) as cache_write,
          sum(a.cache_read_tokens) as cache_read,
          sum(a.output_tokens) as output
        from api_call a
        join session s on s.id = a.session_id
        left join sub_agent sa on sa.session_id = a.session_id and sa.id = a.sub_agent_id
        ${markerSegments(markers)}
        where (${project}::text is null or s.project = ${project}::text)
          and (${startAt}::timestamptz is null or a.at >= ${startAt}::timestamptz)
        group by a.session_id, s.project, a.sub_agent_id, sa.agent_type, sa.description,
          marker.idx, a.model`,
    ),
    projectNames(db),
  ]);
  const roles = summarizeRoles(config, usageRows, markers);
  return {
    roles,
    order: configuredRoles(config, query.project),
    apiCalls: roles.reduce((sum, row) => sum + row.apiCalls, 0),
    projects: names.options(),
  };
}

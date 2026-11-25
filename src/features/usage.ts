import { type SQL, sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { periodStart, select } from '../overview/query.ts';
import type { WorkflowConfig } from '../roles/config.ts';
import {
  type SessionMarkers,
  loadMarkers,
  markerSegments,
} from '../roles/markers.ts';
import {
  type Allocation,
  type IssueAccumulator,
  type Row,
  allocate,
  groupOf,
} from './allocate.ts';
import { issueKey } from './values.ts';
import type { FeatureQuery } from './types.ts';

export interface UsageWindow {
  project?: string | undefined;
  startAt: string | null;
  endAt?: string | null;
}

export async function usageRows(
  db: Database,
  query: FeatureQuery,
  markers: SessionMarkers,
): Promise<Row[]> {
  return windowRows(
    db,
    { project: query.project, startAt: await periodStart(db, query) },
    markers,
  );
}

export async function allocationIn(
  db: Database,
  config: WorkflowConfig,
  window: UsageWindow,
): Promise<Allocation> {
  const markers = await loadMarkers(db, config, { project: window.project });
  return allocate(config, await windowRows(db, window, markers), markers);
}

export async function tokensSince(
  db: Database,
  config: WorkflowConfig,
  window: UsageWindow,
  since: ReadonlyMap<string, number>,
): Promise<number> {
  const times = [...new Set(since.values())].sort((a, b) => a - b);
  if (times.length === 0) return 0;
  const markers = await loadMarkers(db, config, { project: window.project });
  const rows = await windowRows(db, window, markers, times);
  let tokens = 0;
  for (const row of rows) {
    const group = groupOf(config, markers, row);
    if (group.workItem === null) continue;
    const from = since.get(issueKey(group.project, group.workItem));
    const reached = times[Number(row['split']) - 1];
    if (from !== undefined && reached !== undefined && reached >= from) {
      tokens += group.tokens;
    }
  }
  return tokens;
}

function splitOf(times: readonly number[]): SQL {
  if (times.length === 0) return sql`0`;
  const list = times.map((at) => new Date(at).toISOString()).join(',');
  return sql`(select count(*) from unnest(string_to_array(${list}::text, ',')::timestamptz[]) t where t <= a.at)`;
}

async function windowRows(
  db: Database,
  { project: scope, startAt, endAt = null }: UsageWindow,
  markers: SessionMarkers,
  splits: readonly number[] = [],
): Promise<Row[]> {
  const project = scope ?? null;
  const split = splitOf(splits);
  return select(
    db,
    sql`select a.session_id, s.project, s.title, s.agent, s.git_branch as session_branch,
        coalesce(a.sub_agent_id, '') as sub_agent,
        sa.agent_type, sa.description, sa.git_branch as agent_branch,
        coalesce(sa.first_at, fc.first_call_at) as agent_first_at, marker.idx as marker, a.model,
        count(*) as calls,
        min(a.at) as first_at,
        max(a.at) as last_at,
        sum(a.input_tokens) as input,
        sum(a.cache_write_tokens) as cache_write,
        sum(a.cache_read_tokens) as cache_read,
        sum(a.output_tokens) as output,
        ${split} as split
      from api_call a
      join session s on s.id = a.session_id
      left join sub_agent sa on sa.session_id = a.session_id and sa.id = a.sub_agent_id
      left join (
        select session_id, sub_agent_id, min(at) as first_call_at from api_call
        where sub_agent_id is not null group by session_id, sub_agent_id
      ) fc on fc.session_id = a.session_id and fc.sub_agent_id = a.sub_agent_id
      ${markerSegments(markers)}
      where (${project}::text is null or s.project = ${project}::text)
        and (${startAt}::timestamptz is null or a.at >= ${startAt}::timestamptz)
        and (${endAt}::timestamptz is null or a.at < ${endAt}::timestamptz)
      group by a.session_id, s.project, s.title, s.agent, s.git_branch, a.sub_agent_id,
        sa.agent_type, sa.description, sa.git_branch, sa.first_at, fc.first_call_at, marker.idx, a.model, split`,
  );
}

export interface IssueWindow {
  key: string;
  startAt: number;
  endAt: number | null;
}

function reached(times: readonly number[], at: number): number {
  return times.filter((time) => time <= at).length;
}

export async function usageInWindows(
  db: Database,
  config: WorkflowConfig,
  scope: UsageWindow,
  windows: readonly IssueWindow[],
): Promise<Map<string, IssueAccumulator>> {
  const found = new Map<string, IssueAccumulator>();
  if (windows.length === 0) return found;
  const bounds = windows.map((window) => ({
    ...window,
    endAt: window.endAt === null ? null : window.endAt + 1,
  }));
  const times = [
    ...new Set(
      bounds.flatMap((window) =>
        window.endAt === null
          ? [window.startAt]
          : [window.startAt, window.endAt],
      ),
    ),
  ].sort((a, b) => a - b);
  const markers = await loadMarkers(db, config, { project: scope.project });
  const rows = await windowRows(db, scope, markers, times);
  const ranges = new Map<
    string,
    { from: number; to: number; keys: string[] }
  >();
  for (const window of bounds) {
    const from = reached(times, window.startAt);
    const to = window.endAt === null ? Infinity : reached(times, window.endAt);
    const range = ranges.get(`${String(from)}:${String(to)}`) ?? {
      from,
      to,
      keys: [],
    };
    range.keys.push(window.key);
    ranges.set(`${String(from)}:${String(to)}`, range);
  }
  for (const { from, to, keys } of ranges.values()) {
    const inRange = rows.filter((row) => {
      const split = Number(row['split']);
      return split >= from && split < to;
    });
    const { issues } = allocate(config, inRange, markers);
    for (const key of keys) {
      const issue = issues.get(key);
      if (issue !== undefined) found.set(key, issue);
    }
  }
  return found;
}

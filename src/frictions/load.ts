import { sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { text } from '../features/values.ts';
import { lookupIssues } from '../git-host/query.ts';
import { periodStart, select } from '../overview/query.ts';
import type { Period } from '../overview/types.ts';
import { type ProjectNames, projectNames } from '../projects/names.ts';
import type { WorkflowConfig } from '../roles/config.ts';
import {
  type SessionMarkers,
  loadMarkers,
  markerSegments,
} from '../roles/markers.ts';
import { type StatsBounds, statsBounds } from '../stats/bounds.ts';
import { latestFirst } from './summarize.ts';
import {
  type CallGroup,
  type LoadedRow,
  type Row,
  callGroupOf,
  frictionOf,
  onIssue,
} from './threads.ts';
import {
  FRICTION_KINDS,
  type FrictionFilter,
  type FrictionKind,
  type FrictionSubject,
  parseKind,
} from './types.ts';

export interface FrictionQuery {
  period: Period;
  timeZone: string;
  project?: string | undefined;
  kind?: FrictionKind | undefined;
  role?: string | undefined;
  filter?: FrictionFilter | undefined;
  now?: Date;
}

interface Scope {
  project: string | null;
  sessionId: string | null;
  windowStart: string | null;
}

interface CallWindow {
  startAt: string | null;
  previousStart: string | null;
  unit: 'hour' | 'day';
  timeZone: string;
}

export interface FrictionWindow {
  startMs: number | null;
  bounds: StatsBounds;
  markers: SessionMarkers;
  frictions: LoadedRow[];
  calls: CallGroup[];
  names: ProjectNames;
  subject: FrictionSubject | null;
}

const FIRST_CALLS = sql`left join (
    select session_id, sub_agent_id, min(at) as first_call_at from api_call
    where sub_agent_id is not null group by session_id, sub_agent_id
  ) fc on fc.session_id = sa.session_id and fc.sub_agent_id = sa.id`;

function inScope({ project, sessionId }: Scope) {
  return sql`(${project}::text is null or s.project = ${project}::text)
    and (${sessionId}::text is null or s.id = ${sessionId}::text)`;
}

async function windowFrictions(db: Database, scope: Scope): Promise<Row[]> {
  return select(
    db,
    sql`select f.at, f.kind, f.session_id, coalesce(f.sub_agent_id, '') as sub_agent,
        s.project, s.title, s.git_branch as session_branch,
        sa.agent_type, sa.description, sa.git_branch as agent_branch,
        coalesce(sa.first_at, fc.first_call_at) as agent_first_at,
        f.tool, f.category, f.program, f.exit_code, f.command_hash,
        f.hook_command, f.trigger, f.pre_tokens
      from friction f
      join session s on s.id = f.session_id
      left join sub_agent sa on sa.session_id = f.session_id and sa.id = f.sub_agent_id
      ${FIRST_CALLS}
      where ${inScope(scope)}
        and (${scope.windowStart}::timestamptz is null or f.at >= ${scope.windowStart}::timestamptz)`,
  );
}

function slotOf(unit: 'hour' | 'day', timeZone: string) {
  if (unit === 'hour') {
    return sql`date_trunc('minute', a.at)
      - extract(minute from a.at at time zone ${timeZone}) * interval '1 minute'`;
  }
  return sql`date_trunc('day', a.at at time zone ${timeZone}) at time zone ${timeZone}`;
}

async function windowCalls(
  db: Database,
  scope: Scope,
  window: CallWindow,
  markers: SessionMarkers,
): Promise<Row[]> {
  const { startAt, previousStart } = window;
  return select(
    db,
    sql`select a.session_id, coalesce(a.sub_agent_id, '') as sub_agent, s.project,
        s.title, s.agent, s.git_branch as session_branch,
        sa.agent_type, sa.description, sa.git_branch as agent_branch,
        coalesce(sa.first_at, fc.first_call_at) as agent_first_at, marker.idx as marker,
        (${startAt}::timestamptz is null or a.at >= ${startAt}::timestamptz) as in_period,
        coalesce(${previousStart}::timestamptz is not null
          and a.at >= ${previousStart}::timestamptz
          and a.at < ${startAt}::timestamptz, false) as in_previous,
        ${slotOf(window.unit, window.timeZone)} as slot,
        count(*) as calls,
        max(a.input_tokens + a.cache_write_tokens + a.cache_read_tokens) as peak
      from api_call a
      join session s on s.id = a.session_id
      left join sub_agent sa on sa.session_id = a.session_id and sa.id = a.sub_agent_id
      ${FIRST_CALLS}
      ${markerSegments(markers)}
      where ${inScope(scope)}
        and (${scope.windowStart}::timestamptz is null or a.at >= ${scope.windowStart}::timestamptz)
      group by a.session_id, a.sub_agent_id, s.project, s.title, s.agent, s.git_branch,
        sa.agent_type, sa.description, sa.git_branch, sa.first_at, fc.first_call_at,
        marker.idx, in_period, in_previous, slot`,
  );
}

function earliest(values: readonly (number | null)[]): string | null {
  const numbers: number[] = [];
  for (const value of values) {
    if (value === null) return null;
    numbers.push(value);
  }
  return new Date(Math.min(...numbers)).toISOString();
}

async function subjectOf(
  db: Database,
  filter: FrictionFilter | undefined,
  project: string | null,
): Promise<FrictionSubject | null> {
  if (filter === undefined) return null;
  if (filter.session !== undefined) {
    const [row] = await select(
      db,
      sql`select title, agent from session where id = ${filter.session}`,
    );
    return {
      kind: 'session',
      id: filter.session,
      title: row === undefined ? null : text(row['title']),
      agent: row === undefined ? '' : text(row['agent']),
    };
  }
  const root = project ?? '';
  const key = { project: root, number: filter.issue };
  const issueOf = await lookupIssues(db, [key]);
  return {
    kind: 'issue',
    project: root,
    number: filter.issue,
    issue: issueOf(key) ?? { status: 'not-found' },
  };
}

function callWindow(
  startAt: string | null,
  bounds: StatsBounds,
  query: FrictionQuery,
): CallWindow {
  return {
    startAt,
    previousStart:
      bounds.previousStart === null
        ? null
        : new Date(bounds.previousStart).toISOString(),
    unit: query.period === 'today' ? 'hour' : 'day',
    timeZone: query.timeZone,
  };
}

export async function loadWindow(
  db: Database,
  query: FrictionQuery,
  config: WorkflowConfig,
): Promise<FrictionWindow> {
  const project = query.project ?? null;
  const { filter } = query;
  const sessionId = filter?.session ?? null;
  const [startAt, bounds] = await Promise.all([
    periodStart(db, query),
    statsBounds(db, query),
  ]);
  const startMs = startAt === null ? null : Date.parse(startAt);
  const scope: Scope = {
    project,
    sessionId,
    windowStart:
      startMs === null ? null : earliest([startMs, bounds.previousStart]),
  };
  const markers = await loadMarkers(db, config, {
    project: query.project,
    sessionIds: sessionId === null ? undefined : [sessionId],
  });
  const [frictionSource, callSource, names, subject] = await Promise.all([
    windowFrictions(db, scope),
    windowCalls(db, scope, callWindow(startAt, bounds, query), markers),
    projectNames(db),
    subjectOf(db, filter, project),
  ]);
  const keep = onIssue(filter, project);
  return {
    startMs,
    bounds,
    markers,
    frictions: latestFirst(
      frictionSource
        .map((row) => frictionOf(config, markers, row))
        .filter((row) => keep(row.thread)),
    ),
    calls: callSource
      .map((row) => callGroupOf(config, markers, row))
      .filter(keep),
    names,
    subject,
  };
}

export async function issueFrictionCount(
  db: Database,
  config: WorkflowConfig,
  key: { project: string; number: number },
  startAt: string | null,
): Promise<number> {
  const markers = await loadMarkers(db, config, { project: key.project });
  const rows = await windowFrictions(db, {
    project: key.project,
    sessionId: null,
    windowStart: startAt,
  });
  const keep = onIssue({ issue: key.number }, key.project);
  return rows.filter(
    (row) =>
      parseKind(row['kind']) !== undefined &&
      keep(frictionOf(config, markers, row).thread),
  ).length;
}

export async function sessionFrictionCount(
  db: Database,
  id: string,
): Promise<number> {
  const [row] = await select(
    db,
    sql`select count(*) as frictions from friction
      where session_id = ${id} and kind in (${sql.join(
        FRICTION_KINDS.map((kind) => sql`${kind}`),
        sql`, `,
      )})`,
  );
  return Number(row?.['frictions'] ?? 0);
}

import { sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { subAgentWorkItem } from '../features/allocate.ts';
import { text, timestamp } from '../features/values.ts';
import { periodStart, select } from '../overview/query.ts';
import type { Period } from '../overview/types.ts';
import {
  MAIN_ROLE,
  type WorkflowConfig,
  roleOf,
  rulesFor,
  workItemOf,
} from '../roles/config.ts';
import {
  type SessionMarkers,
  loadMarkers,
  markerAt,
} from '../roles/markers.ts';
import { type StatsBounds, statsBounds } from '../stats/bounds.ts';
import {
  type FrictionRow,
  type ThreadInfo,
  categoryRows,
  commandRows,
  compactionRows,
  hookRows,
  kindCounts,
  latestFirst,
  repeatedRows,
  toolRows,
} from './summarize.ts';
import type { FrictionKind, FrictionStats, FrictionWeek } from './types.ts';

export interface FrictionQuery {
  period: Period;
  timeZone: string;
  project?: string | undefined;
  kind?: FrictionKind | undefined;
  now?: Date;
}

type Row = Record<string, unknown>;

interface LoadedRow extends FrictionRow {
  source: Row;
}

function numberOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function frictionOf(row: Row): LoadedRow {
  return {
    at: timestamp(row['at']) ?? '',
    kind: text(row['kind']),
    sessionId: text(row['session_id']),
    subAgentId: text(row['sub_agent']),
    sessionTitle: text(row['title']),
    tool: textOrNull(row['tool']),
    category: textOrNull(row['category']),
    program: textOrNull(row['program']),
    exitCode: numberOrNull(row['exit_code']),
    commandHash: textOrNull(row['command_hash']),
    hookCommand: textOrNull(row['hook_command']),
    trigger: textOrNull(row['trigger']),
    preTokens: numberOrNull(row['pre_tokens']),
    source: row,
  };
}

async function periodFrictions(
  db: Database,
  startAt: string | null,
  project: string | null,
): Promise<LoadedRow[]> {
  const rows = await select(
    db,
    sql`select f.at, f.kind, f.session_id, coalesce(f.sub_agent_id, '') as sub_agent,
        s.project, s.title, s.git_branch as session_branch,
        sa.agent_type, sa.description, sa.git_branch as agent_branch,
        sa.first_at as agent_first_at,
        f.tool, f.category, f.program, f.exit_code, f.command_hash,
        f.hook_command, f.trigger, f.pre_tokens
      from friction f
      join session s on s.id = f.session_id
      left join sub_agent sa on sa.session_id = f.session_id and sa.id = f.sub_agent_id
      where (${project}::text is null or s.project = ${project}::text)
        and (${startAt}::timestamptz is null or f.at >= ${startAt}::timestamptz)`,
  );
  return latestFirst(rows.map(frictionOf));
}

async function periodCalls(
  db: Database,
  startAt: string | null,
  project: string | null,
): Promise<number> {
  const [row] = await select(
    db,
    sql`select count(*) as calls
      from api_call a join session s on s.id = a.session_id
      where (${project}::text is null or s.project = ${project}::text)
        and (${startAt}::timestamptz is null or a.at >= ${startAt}::timestamptz)`,
  );
  return Number(row?.['calls'] ?? 0);
}

async function weekCounts(
  db: Database,
  bounds: StatsBounds,
  { project, kind }: { project: string | null; kind: string | null },
): Promise<FrictionWeek[]> {
  const weeks = bounds.weeks.map((week, index) => ({
    idx: index,
    start: new Date(week.start).toISOString(),
    until:
      index === bounds.weeks.length - 1
        ? null
        : new Date(bounds.weeks[index + 1]?.start ?? 0).toISOString(),
  }));
  const rows = await select(
    db,
    sql`select w.idx,
        (select count(*) from api_call a join session s on s.id = a.session_id
          where a.at >= w.start and (w.until is null or a.at < w.until)
            and (${project}::text is null or s.project = ${project}::text)) as calls,
        (select count(*) from friction f join session s on s.id = f.session_id
          where f.at >= w.start and (w.until is null or f.at < w.until)
            and (${project}::text is null or s.project = ${project}::text)
            and (${kind}::text is null or f.kind = ${kind}::text)) as frictions
      from jsonb_to_recordset(${JSON.stringify(weeks)}::jsonb)
        as w(idx int, start timestamptz, until timestamptz)
      order by w.idx`,
  );
  return bounds.weeks.map((week, index) => {
    const row = rows.find((candidate) => Number(candidate['idx']) === index);
    return {
      start: week.day,
      frictions: Number(row?.['frictions'] ?? 0),
      apiCalls: Number(row?.['calls'] ?? 0),
    };
  });
}

export function threadOf(
  config: WorkflowConfig,
  markers: SessionMarkers,
  row: LoadedRow,
): ThreadInfo {
  const project = text(row.source['project']);
  const rules = rulesFor(config, project);
  if (row.subAgentId !== '') {
    return {
      project,
      role: roleOf(rules, {
        agentType: text(row.source['agent_type']),
        description: text(row.source['description']),
      }),
      workItem: subAgentWorkItem(rules, row.source, markers.get(row.sessionId)),
    };
  }
  const marker = markerAt(markers.get(row.sessionId), row.at);
  return {
    project,
    role: marker?.role ?? MAIN_ROLE,
    workItem:
      marker?.workItem ??
      workItemOf(rules, {
        branch: text(row.source['session_branch']),
        title: row.sessionTitle,
      }),
  };
}

function ofKind(
  rows: readonly LoadedRow[],
  kind: FrictionKind | undefined,
  wanted: FrictionKind,
): LoadedRow[] {
  if (kind !== undefined && kind !== wanted) return [];
  return rows.filter((row) => row.kind === wanted);
}

export async function frictionStats(
  db: Database,
  query: FrictionQuery,
  config: WorkflowConfig,
): Promise<FrictionStats> {
  const project = query.project ?? null;
  const kind = query.kind ?? null;
  const [startAt, bounds] = await Promise.all([
    periodStart(db, query),
    statsBounds(db, query),
  ]);
  const [rows, apiCalls, weeks] = await Promise.all([
    periodFrictions(db, startAt, project),
    periodCalls(db, startAt, project),
    weekCounts(db, bounds, { project, kind }),
  ]);
  const errors = ofKind(rows, query.kind, 'tool-error');
  const failed = errors.filter((row) => row.category === 'command-failed');
  const markers = await loadMarkers(db, config, {
    sessionIds: [...new Set(failed.map((row) => row.sessionId))],
  });
  const counts = kindCounts(rows);
  return {
    kind,
    frictions: kind === null ? rows.length : counts[kind],
    apiCalls,
    counts,
    weeks,
    categories: categoryRows(errors),
    tools: toolRows(errors),
    commands: commandRows(failed),
    repeated: repeatedRows(failed, (row) => threadOf(config, markers, row)),
    hooks: hookRows(ofKind(rows, query.kind, 'stop-blocked')),
    compactions: compactionRows(ofKind(rows, query.kind, 'compaction')),
  };
}

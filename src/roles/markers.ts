import { type SQL, sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { select } from '../overview/query.ts';
import {
  MAIN_ROLE,
  UNASSIGNED_ROLE,
  type WorkflowConfig,
  type WorkflowRules,
  issueNumber,
  rulesFor,
} from './config.ts';
import { MARKER_ROLE_GROUP } from './work-item-pattern.ts';

export interface Marker {
  at: number;
  workItem: number;
  role: string;
}

export interface MarkerMatch {
  workItem: number;
  role: string;
}

export function markerOf(
  rules: WorkflowRules,
  line: string,
): MarkerMatch | null {
  for (const { from, pattern, capture } of rules.workItems) {
    if (from !== 'marker') continue;
    const match = pattern.exec(line);
    const workItem = issueNumber(match?.[capture ?? 1]);
    if (match === null || workItem === null) continue;
    const role = match.groups?.[MARKER_ROLE_GROUP]?.toLowerCase() ?? '';
    return {
      workItem,
      role: role === '' || role === UNASSIGNED_ROLE ? MAIN_ROLE : role,
    };
  }
  return null;
}

export type SessionMarkers = Map<string, Marker[]>;

export interface MarkerScope {
  project?: string | undefined;
  sessionIds?: readonly string[] | undefined;
}

function time(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') return new Date(value).getTime();
  return null;
}

export function markersOf(
  config: WorkflowConfig,
  rows: readonly Record<string, unknown>[],
): SessionMarkers {
  const markers: SessionMarkers = new Map();
  for (const row of rows) {
    const sessionId = String(row['session_id']);
    const at = time(row['at']);
    const match = markerOf(
      rulesFor(config, String(row['root'])),
      String(row['line']),
    );
    if (at === null || match === null) continue;
    const list = markers.get(sessionId) ?? [];
    if (list.at(-1)?.at === at) list.pop();
    list.push({ at, ...match });
    markers.set(sessionId, list);
  }
  return markers;
}

export async function loadMarkers(
  db: Database,
  config: WorkflowConfig,
  { project, sessionIds }: MarkerScope = {},
): Promise<SessionMarkers> {
  if (sessionIds?.length === 0) return new Map();
  const sessions =
    sessionIds === undefined
      ? sql`true`
      : sql`c.session_id in (${sql.join(
          sessionIds.map((id) => sql`${id}`),
          sql`, `,
        )})`;
  const rows = await select(
    db,
    sql`select c.session_id, s.project, s.root, c.at, c.line
      from closing_line c
      join project_session s on s.id = c.session_id
      where c.line ~ '[0-9]'
        and (${project ?? null}::text is null or s.project = ${project ?? null}::text)
        and ${sessions}
      order by c.session_id, c.at, c.position`,
  );
  return markersOf(config, rows);
}

export function markerAt(
  markers: readonly Marker[] | undefined,
  at: unknown,
): Marker | undefined {
  if (markers === undefined) return undefined;
  const moment = time(at);
  return (
    (moment === null
      ? undefined
      : markers.find((marker) => marker.at >= moment)) ?? markers.at(-1)
  );
}

export function lastMarker(
  markers: SessionMarkers,
  sessionId: string,
): Marker | undefined {
  return markers.get(sessionId)?.at(-1);
}

export function markerSegments(markers: SessionMarkers): SQL {
  const segments = [...markers].flatMap(([sessionId, list]) =>
    list.map((marker, index) => ({
      session_id: sessionId,
      idx: index,
      after:
        index === 0 ? null : new Date(list[index - 1]?.at ?? 0).toISOString(),
      until:
        index === list.length - 1 ? null : new Date(marker.at).toISOString(),
    })),
  );
  return sql`left join jsonb_to_recordset(${JSON.stringify(segments)}::jsonb)
      as marker(session_id text, idx int, after timestamptz, until timestamptz)
    on a.sub_agent_id is null
      and marker.session_id = a.session_id
      and (marker.after is null or a.at > marker.after)
      and (marker.until is null or a.at <= marker.until)`;
}

export function markerOfRow(
  markers: SessionMarkers,
  row: Record<string, unknown>,
): Marker | undefined {
  const index = row['marker'];
  if (index === null || index === undefined) return undefined;
  return markers.get(String(row['session_id']))?.[Number(index)];
}

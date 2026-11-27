import type { Database } from '../db/client.ts';
import { lookupOutcomes } from '../git-host/query.ts';
import type { WorkflowConfig } from '../roles/config.ts';
import type { SessionMarkers } from '../roles/markers.ts';
import { UNASSIGNED_ROLE } from '../roles/config.ts';
import { summarizeRoles } from '../roles/query.ts';
import { type StatsBounds, statsBounds } from '../stats/bounds.ts';
import {
  type IssueTally,
  compactedThreads,
  distinctThreads,
  issueTallies,
  medianPeak,
  roleRows,
  threadPeaks,
} from './breakdown.ts';
import { type FrictionQuery, type FrictionWindow, loadWindow } from './load.ts';
import {
  type FrictionRow,
  type ThreadInfo,
  categoryRows,
  commandRows,
  hookRows,
  kindCounts,
  repeatedRows,
  toolRows,
} from './summarize.ts';
import { inPeriodOf, roleFrictionsOf, tableSources } from './selection.ts';
import { lastReportAt } from './reported.ts';
import type { CallGroup, LoadedRow } from './threads.ts';
import {
  type ContextPeaks,
  type FrictionBucket,
  type FrictionKind,
  type FrictionStats,
  type IssueFrictionRow,
  type RoleOption,
  parseKind,
} from './types.ts';

export type { FrictionQuery } from './load.ts';
export { issueFrictionCount } from './load.ts';

function bucketIndex(
  buckets: StatsBounds['buckets'],
  moment: number,
): number | null {
  const index = buckets.findLastIndex((bucket) => bucket.start <= moment);
  return index === -1 ? null : index;
}

function bucketCounts(
  bounds: StatsBounds,
  frictions: readonly LoadedRow[],
  calls: readonly CallGroup[],
): FrictionBucket[] {
  const counts = bounds.buckets.map((bucket) => ({
    start: bucket.key,
    frictions: 0,
    apiCalls: 0,
  }));
  for (const row of frictions) {
    const index = bucketIndex(bounds.buckets, Date.parse(row.at));
    const bucket = index === null ? undefined : counts[index];
    if (bucket !== undefined) bucket.frictions += 1;
  }
  for (const group of calls) {
    const index =
      group.slot === null ? null : bucketIndex(bounds.buckets, group.slot);
    const bucket = index === null ? undefined : counts[index];
    if (bucket !== undefined) bucket.apiCalls += group.calls;
  }
  return counts;
}

function earliestSlot(calls: readonly CallGroup[]): number | null {
  let found: number | null = null;
  for (const { slot } of calls) {
    if (slot !== null && (found === null || slot < found)) found = slot;
  }
  return found;
}

async function trendBounds(
  db: Database,
  query: FrictionQuery,
  loaded: FrictionWindow,
  calls: readonly CallGroup[],
): Promise<StatsBounds> {
  if (query.period !== 'all') return loaded.bounds;
  return statsBounds(db, { ...query, earliestMerge: earliestSlot(calls) });
}

export function roleOptions(
  calls: readonly CallGroup[],
  frictions: readonly LoadedRow[],
  selected: string | undefined,
): RoleOption[] {
  const counts = new Map<string, number>();
  for (const group of calls) counts.set(group.role, 0);
  if (selected !== undefined && !counts.has(selected)) counts.set(selected, 0);
  for (const row of frictions) {
    const count = counts.get(row.thread.role);
    if (count !== undefined) counts.set(row.thread.role, count + 1);
  }
  const last = (role: string): number => (role === UNASSIGNED_ROLE ? 1 : 0);
  return [...counts]
    .map(([role, count]) => ({ role, frictions: count }))
    .sort(
      (left, right) =>
        last(left.role) - last(right.role) ||
        right.frictions - left.frictions ||
        left.role.localeCompare(right.role),
    );
}

function roleThreads(
  config: WorkflowConfig,
  markers: SessionMarkers,
  groups: readonly CallGroup[],
  byIssue: boolean,
): Map<string, number> {
  if (byIssue) return distinctThreads(groups);
  const rows = groups.map((group) => ({
    ...group.source,
    model: '',
    calls: group.calls,
    input: 0,
    cache_write: 0,
    cache_read: 0,
    output: 0,
  }));
  return new Map(
    summarizeRoles(config, rows, markers).map((row) => [row.role, row.threads]),
  );
}

function contextOf(
  period: readonly CallGroup[],
  previous: readonly CallGroup[] | undefined,
  compactions: readonly FrictionRow[],
): ContextPeaks {
  const threads = threadPeaks(period);
  const context: ContextPeaks = {
    threads,
    compacted: compactedThreads(period, compactions),
    medianPeak: medianPeak(threads),
  };
  if (previous === undefined) return context;
  const before = threadPeaks(previous);
  return {
    ...context,
    previous: { medianPeak: medianPeak(before), threads: before.length },
  };
}

async function issueRows(
  db: Database,
  tallies: IssueTally[],
  label: (project: string) => string,
): Promise<IssueFrictionRow[]> {
  if (tallies.length === 0) return [];
  const outcomeOf = await lookupOutcomes(db, tallies);
  return tallies.map((tally) => {
    const { issue, outcome } = outcomeOf(tally);
    return {
      ...tally,
      projectName: label(tally.project),
      issue,
      stage: outcome?.stage ?? null,
    };
  });
}

const threadOf = (row: LoadedRow): ThreadInfo => row.thread;

function tables(
  rows: readonly LoadedRow[],
  kind: FrictionKind | undefined,
): Pick<
  FrictionStats,
  'categories' | 'tools' | 'commands' | 'repeated' | 'hooks'
> {
  const { errors, failed, blocks } = tableSources(rows, kind);
  return {
    categories: categoryRows(errors),
    tools: toolRows(errors),
    commands: commandRows(failed),
    repeated: repeatedRows(failed, threadOf),
    hooks: hookRows(blocks),
  };
}

interface Selection {
  calls: CallGroup[];
  rows: LoadedRow[];
  compactions: LoadedRow[];
}

async function breakdown(
  db: Database,
  {
    query,
    config,
    loaded,
  }: { query: FrictionQuery; config: WorkflowConfig; loaded: FrictionWindow },
  { calls, rows, compactions }: Selection,
): Promise<Pick<FrictionStats, 'roles' | 'issues' | 'context'>> {
  const kind = query.kind ?? null;
  const selected =
    kind === null ? rows : rows.filter((row) => row.kind === kind);
  const byIssue = query.filter?.issue !== undefined;
  const periodCalls = calls.filter((group) => group.inPeriod);
  const repeated = repeatedRows(
    rows.filter((row) => row.category === 'command-failed'),
    threadOf,
  );
  return {
    roles:
      query.role === undefined
        ? roleRows(
            selected,
            roleThreads(config, loaded.markers, periodCalls, byIssue),
          )
        : [],
    issues: byIssue
      ? []
      : await issueRows(db, issueTallies(selected, repeated), (root) =>
          loaded.names.label(root),
        ),
    context: contextOf(
      periodCalls,
      loaded.startMs === null
        ? undefined
        : calls.filter((group) => group.inPrevious),
      compactions,
    ),
  };
}

const COMPACTION = 'compaction';

export async function frictionStats(
  db: Database,
  query: FrictionQuery,
  config: WorkflowConfig,
): Promise<FrictionStats> {
  return statsOfWindow(db, query, config, await loadWindow(db, query, config));
}

export async function statsOfWindow(
  db: Database,
  query: FrictionQuery,
  config: WorkflowConfig,
  loaded: FrictionWindow,
): Promise<FrictionStats> {
  const kind = query.kind ?? null;
  const { role } = query;
  const inPeriod = inPeriodOf(loaded);
  const ofSelected = (list: readonly LoadedRow[]): LoadedRow[] =>
    kind === null ? [...list] : list.filter((row) => row.kind === kind);
  const ofRole = <T>(list: readonly T[], roleOf: (item: T) => string): T[] =>
    role === undefined
      ? [...list]
      : list.filter((item) => roleOf(item) === role);
  const frictions = loaded.frictions.filter(
    (row) => parseKind(row.kind) !== undefined,
  );
  const periodCalls = loaded.calls.filter((group) => group.inPeriod);
  const calls = ofRole(loaded.calls, (group) => group.role);
  const roleFrictions = roleFrictionsOf(loaded, role);
  const rows = roleFrictions.filter(inPeriod);
  const compactions = ofRole(
    loaded.frictions.filter((row) => row.kind === COMPACTION && inPeriod(row)),
    (row) => row.thread.role,
  );
  const bounds = await trendBounds(db, query, loaded, calls);
  return {
    kind,
    role: role ?? null,
    frictions: ofSelected(rows).length,
    apiCalls: calls
      .filter((group) => group.inPeriod)
      .reduce((sum, group) => sum + group.calls, 0),
    counts: kindCounts(rows),
    roleOptions: roleOptions(
      periodCalls,
      ofSelected(frictions.filter(inPeriod)),
      role,
    ),
    unit: bounds.unit,
    buckets: bucketCounts(bounds, ofSelected(roleFrictions), calls),
    ...tables(rows, query.kind),
    subject: loaded.subject,
    ...(await breakdown(
      db,
      { query, config, loaded },
      { calls, rows, compactions },
    )),
    projects: loaded.names.options(),
    lastReportAt: await lastReportAt(db, query.project),
  };
}

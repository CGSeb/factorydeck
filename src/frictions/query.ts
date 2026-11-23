import type { Database } from '../db/client.ts';
import { lookupOutcomes } from '../git-host/query.ts';
import type { WorkflowConfig } from '../roles/config.ts';
import type { SessionMarkers } from '../roles/markers.ts';
import { summarizeRoles } from '../roles/query.ts';
import type { StatsBounds } from '../stats/bounds.ts';
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
  compactionRows,
  hookRows,
  kindCounts,
  repeatedRows,
  toolRows,
} from './summarize.ts';
import type { CallGroup, LoadedRow } from './threads.ts';
import type {
  ContextPeaks,
  FrictionKind,
  FrictionStats,
  FrictionWeek,
  IssueFrictionRow,
} from './types.ts';

export type { FrictionQuery } from './load.ts';
export { issueFrictionCount } from './load.ts';

function weekIndex(bounds: StatsBounds, at: string): number | null {
  const moment = Date.parse(at);
  let found: number | null = null;
  bounds.weeks.forEach((week, index) => {
    if (week.start <= moment) found = index;
  });
  return found;
}

function weekCounts(
  bounds: StatsBounds,
  frictions: readonly LoadedRow[],
  calls: readonly CallGroup[],
): FrictionWeek[] {
  const weeks = frictions.map((row) => weekIndex(bounds, row.at));
  return bounds.weeks.map((week, index) => ({
    start: week.day,
    frictions: weeks.filter((value) => value === index).length,
    apiCalls: calls
      .filter((group) => group.week === index)
      .reduce((sum, group) => sum + group.calls, 0),
  }));
}

function ofKind<R extends FrictionRow>(
  rows: readonly R[],
  kind: FrictionKind | undefined,
  wanted: FrictionKind,
): R[] {
  if (kind !== undefined && kind !== wanted) return [];
  return rows.filter((row) => row.kind === wanted);
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
  frictions: readonly FrictionRow[],
): ContextPeaks {
  const threads = threadPeaks(period);
  const context: ContextPeaks = {
    threads,
    compacted: compactedThreads(period, frictions),
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
  'categories' | 'tools' | 'commands' | 'repeated' | 'hooks' | 'compactions'
> {
  const errors = ofKind(rows, kind, 'tool-error');
  const failed = errors.filter((row) => row.category === 'command-failed');
  return {
    categories: categoryRows(errors),
    tools: toolRows(errors),
    commands: commandRows(failed),
    repeated: repeatedRows(failed, threadOf),
    hooks: hookRows(ofKind(rows, kind, 'stop-blocked')),
    compactions: compactionRows(ofKind(rows, kind, 'compaction')),
  };
}

async function breakdown(
  db: Database,
  {
    query,
    config,
    loaded,
  }: { query: FrictionQuery; config: WorkflowConfig; loaded: FrictionWindow },
  rows: readonly LoadedRow[],
): Promise<Pick<FrictionStats, 'roles' | 'issues' | 'context'>> {
  const kind = query.kind ?? null;
  const selected =
    kind === null ? rows : rows.filter((row) => row.kind === kind);
  const byIssue = query.filter?.issue !== undefined;
  const periodCalls = loaded.calls.filter((group) => group.inPeriod);
  const repeated = repeatedRows(
    rows.filter((row) => row.category === 'command-failed'),
    threadOf,
  );
  return {
    roles: roleRows(
      selected,
      roleThreads(config, loaded.markers, periodCalls, byIssue),
    ),
    issues: byIssue
      ? []
      : await issueRows(db, issueTallies(selected, rows, repeated), (root) =>
          loaded.names.label(root),
        ),
    context: contextOf(
      periodCalls,
      loaded.startMs === null
        ? undefined
        : loaded.calls.filter((group) => group.inPrevious),
      rows,
    ),
  };
}

export async function frictionStats(
  db: Database,
  query: FrictionQuery,
  config: WorkflowConfig,
): Promise<FrictionStats> {
  const kind = query.kind ?? null;
  const loaded = await loadWindow(db, query, config);
  const { startMs, frictions } = loaded;
  const rows =
    startMs === null
      ? frictions
      : frictions.filter((row) => Date.parse(row.at) >= startMs);
  const ofSelected = (list: readonly LoadedRow[]): LoadedRow[] =>
    kind === null ? [...list] : list.filter((row) => row.kind === kind);
  return {
    kind,
    frictions: ofSelected(rows).length,
    apiCalls: loaded.calls
      .filter((group) => group.inPeriod)
      .reduce((sum, group) => sum + group.calls, 0),
    counts: kindCounts(rows),
    weeks: weekCounts(loaded.bounds, ofSelected(frictions), loaded.calls),
    ...tables(rows, query.kind),
    subject: loaded.subject,
    ...(await breakdown(db, { query, config, loaded }, rows)),
    projects: loaded.names.options(),
  };
}

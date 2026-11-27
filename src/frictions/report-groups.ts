import { text } from '../features/values.ts';
import { isShellTool } from './occurrences.ts';
import type { LoadedRow } from './threads.ts';
import {
  type FrictionCategory,
  type FrictionKind,
  REPEATED_FAILURES,
  categoryOf,
  parseKind,
} from './types.ts';

export const MAX_ISSUES = 10;
export const UNASSIGNED_ISSUE = 'unassigned';

export interface ReportGroup {
  key: string;
  kind: FrictionKind;
  category: FrictionCategory | null;
  tool: string | null;
  program: string | null;
  hook: string | null;
  shell: boolean;
  rows: LoadedRow[];
  threads: number;
  firstAt: string;
  lastAt: string;
}

export interface Tally<K> {
  key: K;
  frictions: number;
}

function programOf(row: LoadedRow): string | null {
  return row.program === null || row.program === '' ? null : row.program;
}

export function groupKey(row: LoadedRow): string {
  if (row.kind === 'stop-blocked') {
    return `stop-blocked/${row.hookCommand ?? ''}`;
  }
  return `tool-error/${categoryOf(row.category)}/${row.tool ?? ''}/${programOf(row) ?? '-'}`;
}

function storedOrder(row: LoadedRow): number {
  return Number(row.source['id'] ?? 0);
}

export function latestRowsFirst(rows: readonly LoadedRow[]): LoadedRow[] {
  return [...rows].sort(
    (left, right) =>
      Date.parse(right.at) - Date.parse(left.at) ||
      storedOrder(right) - storedOrder(left),
  );
}

function threadKey(row: LoadedRow): string {
  return `${row.sessionId}/${row.subAgentId}`;
}

export function agentOf(row: LoadedRow): string {
  return text(row.source['agent']);
}

function groupOf(key: string, rows: LoadedRow[]): ReportGroup | undefined {
  const ordered = latestRowsFirst(rows);
  const [last] = ordered;
  const first = ordered.at(-1);
  const kind = parseKind(last?.kind);
  if (last === undefined || first === undefined || kind === undefined) {
    return undefined;
  }
  const stop = kind === 'stop-blocked';
  return {
    key,
    kind,
    category: stop ? null : categoryOf(last.category),
    tool: stop ? null : (last.tool ?? ''),
    program: stop ? null : programOf(last),
    hook: stop ? (last.hookCommand ?? '') : null,
    shell: !stop && isShellTool(agentOf(last), last.tool),
    rows: ordered,
    threads: new Set(ordered.map(threadKey)).size,
    firstAt: first.at,
    lastAt: last.at,
  };
}

export function reportGroups(rows: readonly LoadedRow[]): ReportGroup[] {
  const byKey = new Map<string, LoadedRow[]>();
  for (const row of rows) {
    if (parseKind(row.kind) === undefined) continue;
    const key = groupKey(row);
    byKey.set(key, [...(byKey.get(key) ?? []), row]);
  }
  return [...byKey]
    .flatMap(([key, grouped]) => {
      const group = groupOf(key, grouped);
      return group === undefined ? [] : [group];
    })
    .sort(
      (left, right) =>
        right.rows.length - left.rows.length ||
        left.key.localeCompare(right.key),
    );
}

export function roleTallies(group: ReportGroup): Tally<string>[] {
  const counts = new Map<string, number>();
  for (const row of group.rows) {
    counts.set(row.thread.role, (counts.get(row.thread.role) ?? 0) + 1);
  }
  return [...counts]
    .map(([key, frictions]) => ({ key, frictions }))
    .sort(
      (left, right) =>
        right.frictions - left.frictions || left.key.localeCompare(right.key),
    );
}

export function issueTallies(group: ReportGroup): Tally<number | null>[] {
  const counts = new Map<number | null, number>();
  for (const row of group.rows) {
    const { workItem } = row.thread;
    counts.set(workItem, (counts.get(workItem) ?? 0) + 1);
  }
  return [...counts]
    .map(([key, frictions]) => ({ key, frictions }))
    .sort(
      (left, right) =>
        right.frictions - left.frictions ||
        (left.key ?? Number.POSITIVE_INFINITY) -
          (right.key ?? Number.POSITIVE_INFINITY),
    );
}

export function exitCodes(group: ReportGroup): number[] {
  return [
    ...new Set(
      group.rows.flatMap((row) =>
        row.exitCode === null ? [] : [row.exitCode],
      ),
    ),
  ].sort((left, right) => left - right);
}

export function distinctCommands(group: ReportGroup): number {
  return new Set(
    group.rows.flatMap((row) =>
      row.commandHash === null ? [] : [row.commandHash],
    ),
  ).size;
}

export function repeatedThreads(group: ReportGroup): number {
  const counts = new Map<string, number>();
  for (const row of group.rows) {
    if (row.commandHash === null) continue;
    const key = `${threadKey(row)}\n${row.commandHash}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const threads = new Set<string>();
  for (const [key, count] of counts) {
    if (count >= REPEATED_FAILURES) threads.add(key.split('\n')[0] ?? key);
  }
  return threads.size;
}

export function pickDistinct<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  count: number,
): T[] {
  const picked = new Set<number>();
  const keys = new Set<string>();
  items.forEach((item, index) => {
    if (picked.size >= count) return;
    const key = keyOf(item);
    if (keys.has(key)) return;
    keys.add(key);
    picked.add(index);
  });
  items.forEach((_, index) => {
    if (picked.size < count) picked.add(index);
  });
  return items.filter((_, index) => picked.has(index));
}

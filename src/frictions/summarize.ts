import {
  type CategoryRow,
  type CommandRow,
  FRICTION_CATEGORIES,
  FRICTION_KINDS,
  type FrictionCategory,
  type HookRow,
  type KindCounts,
  REPEATED_FAILURES,
  type RepeatedRow,
  type ToolRow,
  categoryOf,
} from './types.ts';

export interface FrictionRow {
  at: string;
  kind: string;
  sessionId: string;
  subAgentId: string;
  sessionTitle: string;
  tool: string | null;
  category: string | null;
  program: string | null;
  exitCode: number | null;
  commandHash: string | null;
  hookCommand: string | null;
  trigger: string | null;
  preTokens: number | null;
}

export interface ThreadInfo {
  role: string;
  project: string;
  workItem: number | null;
}

function threadKey(row: FrictionRow): string {
  return `${row.sessionId}/${row.subAgentId}`;
}

function groupBy<K, R extends FrictionRow>(
  rows: readonly R[],
  key: (row: R) => K,
): Map<K, R[]> {
  const groups = new Map<K, R[]>();
  for (const row of rows) {
    const value = key(row);
    groups.set(value, [...(groups.get(value) ?? []), row]);
  }
  return groups;
}

function distinct(
  rows: readonly FrictionRow[],
  key: (row: FrictionRow) => string | null,
): number {
  return new Set(rows.map(key).filter((value) => value !== null)).size;
}

export function latestFirst<R extends FrictionRow>(rows: readonly R[]): R[] {
  return [...rows].sort((left, right) => right.at.localeCompare(left.at));
}

export function kindCounts(rows: readonly FrictionRow[]): KindCounts {
  const counts: KindCounts = {
    'tool-error': 0,
    'stop-blocked': 0,
  };
  for (const row of rows) {
    const kind = FRICTION_KINDS.find((candidate) => candidate === row.kind);
    if (kind !== undefined) counts[kind] += 1;
  }
  return counts;
}

function categoryRank(category: FrictionCategory): number {
  return FRICTION_CATEGORIES.indexOf(category);
}

export function categoryRows(errors: readonly FrictionRow[]): CategoryRow[] {
  const groups = groupBy(errors, (row) => categoryOf(row.category));
  return [...groups]
    .map(([category, rows]) => ({ category, errors: rows.length }))
    .sort(
      (left, right) =>
        right.errors - left.errors ||
        categoryRank(left.category) - categoryRank(right.category),
    );
}

function mainCategory(rows: readonly FrictionRow[]): FrictionCategory {
  return categoryRows(rows)[0]?.category ?? 'other';
}

export function toolRows(errors: readonly FrictionRow[]): ToolRow[] {
  const groups = groupBy(errors, (row) => row.tool ?? '');
  return [...groups]
    .map(([tool, rows]) => ({
      tool,
      errors: rows.length,
      mainCategory: mainCategory(rows),
      threads: distinct(rows, threadKey),
    }))
    .sort(
      (left, right) =>
        right.errors - left.errors || left.tool.localeCompare(right.tool),
    );
}

function compareProgram(left: string | null, right: string | null): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left.localeCompare(right);
}

export function commandRows(failed: readonly FrictionRow[]): CommandRow[] {
  const groups = groupBy(failed, (row) => row.program);
  return [...groups]
    .map(([program, rows]) => ({
      program,
      failures: rows.length,
      exitCodes: [
        ...new Set(
          rows.flatMap((row) => (row.exitCode === null ? [] : [row.exitCode])),
        ),
      ].sort((left, right) => left - right),
      distinctCommands: distinct(rows, (row) => row.commandHash),
    }))
    .sort(
      (left, right) =>
        right.failures - left.failures ||
        compareProgram(left.program, right.program),
    );
}

export function repeatedRows<R extends FrictionRow>(
  failed: readonly R[],
  threadOf: (row: R) => ThreadInfo,
): RepeatedRow[] {
  const groups = groupBy(
    failed.filter((row) => row.commandHash !== null),
    (row) => `${threadKey(row)} ${row.commandHash ?? ''}`,
  );
  return [...groups.values()]
    .filter((rows) => rows.length >= REPEATED_FAILURES)
    .flatMap((rows) => {
      const [last] = latestFirst(rows);
      if (last === undefined) return [];
      const thread = threadOf(last);
      return [
        {
          program: last.program,
          failures: rows.length,
          role: thread.role,
          project: thread.project,
          workItem: thread.workItem,
          sessionId: last.sessionId,
          sessionTitle: last.sessionTitle,
          lastAt: last.at,
        },
      ];
    })
    .sort(
      (left, right) =>
        right.failures - left.failures ||
        right.lastAt.localeCompare(left.lastAt),
    );
}

function lastAt(rows: readonly FrictionRow[]): string {
  return latestFirst(rows)[0]?.at ?? '';
}

export function hookRows(blocks: readonly FrictionRow[]): HookRow[] {
  const groups = groupBy(blocks, (row) => row.hookCommand ?? '');
  return [...groups]
    .map(([command, rows]) => ({
      command,
      blocks: rows.length,
      sessions: distinct(rows, (row) => row.sessionId),
      lastAt: lastAt(rows),
    }))
    .sort(
      (left, right) =>
        right.blocks - left.blocks || right.lastAt.localeCompare(left.lastAt),
    );
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  const upper = ordered[middle] ?? 0;
  if (ordered.length % 2 === 1) return upper;
  return Math.round(((ordered[middle - 1] ?? 0) + upper) / 2);
}

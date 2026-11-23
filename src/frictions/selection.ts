import type { FrictionWindow } from './load.ts';
import type { FrictionRow } from './summarize.ts';
import type { LoadedRow } from './threads.ts';
import { type FrictionKind, parseKind } from './types.ts';

export function ofKind<R extends FrictionRow>(
  rows: readonly R[],
  kind: FrictionKind | undefined,
  wanted: FrictionKind,
): R[] {
  if (kind !== undefined && kind !== wanted) return [];
  return rows.filter((row) => row.kind === wanted);
}

export interface TableSources {
  errors: LoadedRow[];
  failed: LoadedRow[];
  blocks: LoadedRow[];
}

export function tableSources(
  rows: readonly LoadedRow[],
  kind: FrictionKind | undefined,
): TableSources {
  const errors = ofKind(rows, kind, 'tool-error');
  return {
    errors,
    failed: errors.filter((row) => row.category === 'command-failed'),
    blocks: ofKind(rows, kind, 'stop-blocked'),
  };
}

export function inPeriodOf(
  loaded: FrictionWindow,
): (row: LoadedRow) => boolean {
  const { startMs } = loaded;
  return (row) => startMs === null || Date.parse(row.at) >= startMs;
}

export function roleFrictionsOf(
  loaded: FrictionWindow,
  role: string | undefined,
): LoadedRow[] {
  return loaded.frictions.filter(
    (row) =>
      parseKind(row.kind) !== undefined &&
      (role === undefined || row.thread.role === role),
  );
}

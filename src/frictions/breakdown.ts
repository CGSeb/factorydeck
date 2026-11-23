import {
  FRICTION_KINDS,
  type FrictionKind,
  type RepeatedRow,
  type RoleFrictionRow,
  type ThreadPeak,
} from './types.ts';
import { type FrictionRow, type ThreadInfo, median } from './summarize.ts';

export interface AttributedFriction extends FrictionRow {
  thread: ThreadInfo;
}

export interface ThreadCalls {
  key: string;
  sessionId: string;
  sessionTitle: string;
  sessionAgent: string;
  description: string | null;
  role: string;
  calls: number;
  peak: number;
}

export function threadKeyOf(sessionId: string, subAgentId: string): string {
  return `${sessionId}/${subAgentId}`;
}

export function mainKind(rows: readonly FrictionRow[]): FrictionKind | null {
  let best: FrictionKind | null = null;
  let bestCount = 0;
  for (const kind of FRICTION_KINDS) {
    const count = rows.filter((row) => row.kind === kind).length;
    if (count > bestCount) {
      best = kind;
      bestCount = count;
    }
  }
  return best;
}

export function perThread(frictions: number, threads: number): number {
  return threads === 0 ? 0 : Math.round((frictions / threads) * 10) / 10;
}

export function roleRows(
  frictions: readonly AttributedFriction[],
  threads: ReadonlyMap<string, number>,
): RoleFrictionRow[] {
  return [...threads]
    .filter(([, count]) => count > 0)
    .map(([role, count]) => {
      const rows = frictions.filter((row) => row.thread.role === role);
      return {
        role,
        threads: count,
        frictions: rows.length,
        perThread: perThread(rows.length, count),
        mainKind: mainKind(rows),
      };
    })
    .sort(
      (left, right) =>
        right.perThread - left.perThread ||
        right.frictions - left.frictions ||
        left.role.localeCompare(right.role),
    );
}

export function distinctThreads(
  threads: readonly { key: string; role: string }[],
): Map<string, number> {
  const keys = new Map<string, Set<string>>();
  for (const thread of threads) {
    const set = keys.get(thread.role) ?? new Set<string>();
    set.add(thread.key);
    keys.set(thread.role, set);
  }
  return new Map([...keys].map(([role, set]) => [role, set.size]));
}

export interface IssueTally {
  project: string;
  number: number;
  frictions: number;
  repeated: number;
  compactions: number;
}

function issueKey(project: string, number: number): string {
  return `${String(number)} ${project}`;
}

export function issueTallies(
  ofKind: readonly AttributedFriction[],
  all: readonly AttributedFriction[],
  repeated: readonly RepeatedRow[],
): IssueTally[] {
  const tallies = new Map<string, IssueTally>();
  for (const row of ofKind) {
    const { project, workItem } = row.thread;
    if (workItem === null) continue;
    const key = issueKey(project, workItem);
    const tally = tallies.get(key) ?? {
      project,
      number: workItem,
      frictions: 0,
      repeated: 0,
      compactions: 0,
    };
    tally.frictions += 1;
    tallies.set(key, tally);
  }
  for (const row of all) {
    const { project, workItem } = row.thread;
    if (row.kind !== 'compaction' || workItem === null) continue;
    const tally = tallies.get(issueKey(project, workItem));
    if (tally !== undefined) tally.compactions += 1;
  }
  for (const row of repeated) {
    if (row.workItem === null) continue;
    const tally = tallies.get(issueKey(row.project, row.workItem));
    if (tally !== undefined) tally.repeated += 1;
  }
  return [...tallies.values()].sort(
    (left, right) =>
      right.frictions - left.frictions ||
      right.number - left.number ||
      left.project.localeCompare(right.project),
  );
}

export function threadPeaks(groups: readonly ThreadCalls[]): ThreadPeak[] {
  const threads = new Map<string, ThreadPeak>();
  for (const group of groups) {
    const thread = threads.get(group.key);
    if (thread === undefined) {
      threads.set(group.key, {
        sessionId: group.sessionId,
        sessionTitle: group.sessionTitle,
        sessionAgent: group.sessionAgent,
        description: group.description,
        peak: group.peak,
      });
    } else {
      thread.peak = Math.max(thread.peak, group.peak);
    }
  }
  return [...threads.values()];
}

export function medianPeak(peaks: readonly ThreadPeak[]): number | null {
  return median(peaks.map((thread) => thread.peak));
}

export function compactedThreads(
  groups: readonly ThreadCalls[],
  frictions: readonly FrictionRow[],
): number {
  const compacted = new Set(
    frictions
      .filter((row) => row.kind === 'compaction')
      .map((row) => threadKeyOf(row.sessionId, row.subAgentId)),
  );
  return new Set(
    groups.map((group) => group.key).filter((key) => compacted.has(key)),
  ).size;
}

import { homedir } from 'node:os';
import type { Database } from '../db/client.ts';
import { CODEX } from '../ingest/codex-files.ts';
import type { WorkflowConfig } from '../roles/config.ts';
import { text } from '../features/values.ts';
import { readClaudeLine } from './claude-occurrences.ts';
import { codexCalls, readCodexLine } from './codex-occurrences.ts';
import { type FrictionQuery, loadWindow } from './load.ts';
import { logLines } from './log-lines.ts';
import { type FileReading, type LogTarget, allSettled } from './log-reading.ts';
import {
  type FrictionOccurrence,
  MAX_OCCURRENCES,
  type OccurrenceRow,
  type OccurrenceTexts,
} from './occurrence-types.ts';
import { inPeriodOf, roleFrictionsOf, tableSources } from './selection.ts';
import type { LoadedRow } from './threads.ts';
import { REPEATED_FAILURES, categoryOf } from './types.ts';

export interface OccurrenceQuery extends FrictionQuery {
  row: OccurrenceRow;
}

function rowFrictions(
  rows: readonly LoadedRow[],
  query: OccurrenceQuery,
): LoadedRow[] {
  const { errors, failed, blocks } = tableSources(rows, query.kind);
  const { row } = query;
  switch (row.table) {
    case 'category':
      return errors.filter(
        (item) => categoryOf(item.category) === row.category,
      );
    case 'tool':
      return errors.filter((item) => (item.tool ?? '') === row.tool);
    case 'command':
      return failed.filter((item) => item.program === row.program);
    case 'hook':
      return blocks.filter((item) => (item.hookCommand ?? '') === row.command);
    case 'repeated': {
      const thread = failed.filter(
        (item) =>
          item.sessionId === row.sessionId &&
          item.subAgentId === row.subAgentId &&
          item.commandHash === row.commandHash,
      );
      return thread.length >= REPEATED_FAILURES ? thread : [];
    }
  }
}

function storedOrder(row: LoadedRow): number {
  return Number(row.source['id'] ?? 0);
}

export function latestOccurrences(rows: readonly LoadedRow[]): LoadedRow[] {
  return [...rows]
    .sort(
      (left, right) =>
        Date.parse(right.at) - Date.parse(left.at) ||
        storedOrder(right) - storedOrder(left),
    )
    .slice(0, MAX_OCCURRENCES);
}

export interface LogLocation {
  target: LogTarget;
  agent: string;
  path: string;
}

interface Located extends LogLocation {
  row: LoadedRow;
}

function locate(row: LoadedRow, index: number): Located {
  const { source } = row;
  return {
    row,
    agent: text(source['agent']),
    path: text(source['source_path']),
    target: {
      key: String(index),
      recordUuid: text(source['record_uuid']),
      position: Number(source['position'] ?? 0),
      kind: row.kind,
    },
  };
}

async function readFile(
  path: string,
  agent: string,
  reading: FileReading,
): Promise<void> {
  const claudeCalls = new Map<string, string>();
  const known = codexCalls();
  try {
    for await (const line of logLines(path)) {
      if (agent === CODEX) readCodexLine(reading, known, line);
      else readClaudeLine(reading, claudeCalls, line);
      if (allSettled(reading)) return;
    }
  } catch {
    return;
  }
}

export async function readOccurrenceTexts(
  located: readonly LogLocation[],
  home: string,
): Promise<Map<string, OccurrenceTexts | null>> {
  const files = new Map<string, LogLocation[]>();
  for (const item of located) {
    const fileKey = `${item.agent}\n${item.path}`;
    files.set(fileKey, [...(files.get(fileKey) ?? []), item]);
  }
  const found = new Map<string, OccurrenceTexts | null>();
  await Promise.all(
    [...files.values()].map(async (items) => {
      const [first] = items;
      if (first === undefined || first.path === '') return;
      const reading: FileReading = {
        targets: items.map((item) => item.target),
        home,
        found: new Map(),
      };
      await readFile(first.path, first.agent, reading);
      for (const [key, texts] of reading.found) found.set(key, texts);
    }),
  );
  return found;
}

export async function frictionOccurrences(
  db: Database,
  query: OccurrenceQuery,
  config: WorkflowConfig,
  home: string = homedir(),
): Promise<FrictionOccurrence[]> {
  const loaded = await loadWindow(db, query, config);
  const rows = roleFrictionsOf(loaded, query.role).filter(inPeriodOf(loaded));
  const located = latestOccurrences(rowFrictions(rows, query)).map(locate);
  const texts = await readOccurrenceTexts(located, home);
  return located.map(({ row, target }) => ({
    at: row.at,
    role: row.thread.role,
    project: row.thread.project,
    workItem: row.thread.workItem,
    sessionId: row.sessionId,
    sessionTitle: row.sessionTitle,
    texts: texts.get(target.key) ?? null,
  }));
}

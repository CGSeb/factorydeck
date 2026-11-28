import { homedir } from 'node:os';
import { sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { text } from '../features/values.ts';
import { CODEX, CODEX_SHELL_TOOLS } from '../ingest/codex-files.ts';
import { SHELL_TOOLS } from '../ingest/frictions.ts';
import { select } from '../overview/query.ts';
import type { WorkflowConfig } from '../roles/config.ts';
import { readClaudeLine } from './claude-occurrences.ts';
import { codexCalls, readCodexLine } from './codex-occurrences.ts';
import { type FrictionQuery, loadWindow } from './load.ts';
import { logLines } from './log-lines.ts';
import { type FileReading, type LogTarget, allSettled } from './log-reading.ts';
import {
  fullOutput,
  hasMoreThan,
  headExcerpt,
  shortInput,
  tailExcerpt,
} from './log-texts.ts';
import {
  type FrictionOccurrence,
  type FullOutput,
  type LogTexts,
  MAX_OCCURRENCES,
  type OccurrenceDetails,
  type OccurrenceRow,
  type OccurrenceTexts,
} from './occurrence-types.ts';
import { inPeriodOf, roleFrictionsOf, tableSources } from './selection.ts';
import type { LoadedRow, Row } from './threads.ts';
import { FRICTION_KINDS, REPEATED_FAILURES, categoryOf } from './types.ts';

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

export function locationOf(source: Row, key: string): LogLocation {
  return {
    agent: text(source['agent']),
    path: text(source['source_path']),
    target: {
      key,
      recordUuid: text(source['record_uuid']),
      position: Number(source['position'] ?? 0),
      kind: text(source['kind']),
    },
  };
}

function locate(row: LoadedRow, index: number): Located {
  return { row, ...locationOf(row.source, String(index)) };
}

export function isShellTool(agent: string, tool: string | null): boolean {
  if (tool === null) return false;
  return agent === CODEX ? CODEX_SHELL_TOOLS.has(tool) : SHELL_TOOLS.has(tool);
}

export function excerptOf(
  texts: LogTexts,
  shell: boolean,
): { texts: OccurrenceTexts; hasMore: boolean } {
  if (texts.kind === 'stop-blocked') {
    const message = headExcerpt(texts.message);
    return {
      texts: { kind: 'stop-blocked', message },
      hasMore: hasMoreThan(texts.message, message),
    };
  }
  const error = shell ? tailExcerpt(texts.output) : headExcerpt(texts.output);
  return {
    texts: {
      kind: 'tool-error',
      input: shortInput(texts.input),
      error,
      shell,
    },
    hasMore: hasMoreThan(texts.output, error),
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

export async function readLogTexts(
  located: readonly LogLocation[],
  home: string,
): Promise<Map<string, LogTexts | null>> {
  const files = new Map<string, LogLocation[]>();
  for (const item of located) {
    const fileKey = `${item.agent}\n${item.path}`;
    files.set(fileKey, [...(files.get(fileKey) ?? []), item]);
  }
  const found = new Map<string, LogTexts | null>();
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

export async function sentFileKeys(
  db: Database,
  paths: readonly string[],
): Promise<Set<string>> {
  const keys = [...new Set(paths)].filter((path) => path !== '');
  if (keys.length === 0) return new Set();
  const rows = await select(
    db,
    sql`select file_key from ingest_file where file_key in (${sql.join(
      keys.map((key) => sql`${key}`),
      sql`, `,
    )})`,
  );
  return new Set(rows.map((row) => text(row['file_key'])));
}

export async function detailsOf(
  db: Database,
  located: readonly LogLocation[],
  found: ReadonlyMap<string, LogTexts | null>,
): Promise<Map<string, OccurrenceDetails>> {
  const read = (item: LogLocation): boolean =>
    (found.get(item.target.key) ?? null) !== null;
  const sent = await sentFileKeys(
    db,
    located.filter((item) => !read(item)).map((item) => item.path),
  );
  return new Map(
    located.map((item): [string, OccurrenceDetails] => {
      if (read(item)) return [item.target.key, 'local'];
      return [item.target.key, sent.has(item.path) ? 'remote' : 'gone'];
    }),
  );
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
  const found = await readLogTexts(located, home);
  const details = await detailsOf(db, located, found);
  return located.map(({ row, agent, target }) => {
    const texts = found.get(target.key) ?? null;
    const excerpt =
      texts === null ? null : excerptOf(texts, isShellTool(agent, row.tool));
    return {
      id: Number(row.source['id']),
      at: row.at,
      role: row.thread.role,
      project: row.thread.project,
      workItem: row.thread.workItem,
      sessionId: row.sessionId,
      sessionTitle: row.sessionTitle,
      exitCode: row.exitCode,
      hasMore: excerpt?.hasMore ?? false,
      details: details.get(target.key) ?? 'gone',
      texts: excerpt?.texts ?? null,
    };
  });
}

const OUTPUT_KEY = 'output';

export async function frictionOutput(
  db: Database,
  id: number,
  home: string = homedir(),
): Promise<FullOutput | undefined> {
  const [source] = await select(
    db,
    sql`select id, kind, agent, source_path, record_uuid, position from friction
      where id = ${id} and kind in (${sql.join(
        FRICTION_KINDS.map((kind) => sql`${kind}`),
        sql`, `,
      )})`,
  );
  if (source === undefined) return undefined;
  const location = locationOf(source, OUTPUT_KEY);
  const found = await readLogTexts([location], home);
  const texts = found.get(OUTPUT_KEY) ?? null;
  if (texts === null) {
    const details = await detailsOf(db, [location], found);
    return details.get(OUTPUT_KEY) === 'remote'
      ? { gone: true, remote: true }
      : { gone: true };
  }
  return {
    gone: false,
    text: fullOutput(
      texts.kind === 'tool-error' ? texts.output : texts.message,
    ),
  };
}

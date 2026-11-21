import { readFile, stat } from 'node:fs/promises';
import { sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { type LogFile, findLogFiles, readRange } from './files.ts';
import { isObject, parseLines } from './records.ts';
import {
  type Run,
  forgetFileRows,
  insertThreadRows,
  loadSession,
  loadSubAgent,
  resetSession,
  saveOffset,
  saveSessions,
  saveSubAgents,
  startRun,
} from './store.ts';
import { readThread } from './thread.ts';

/** What one ingestion stored, as its summary line shows it. */
export interface IngestCounts {
  files: number;
  sessions: number;
  subAgents: number;
  apiCalls: number;
  skillLaunches: number;
  linesSkipped: number;
}

export type IngestResult =
  ({ status: 'done' } & IngestCounts) | { status: 'already-running' };

export class SessionsFolderNotFoundError extends Error {
  readonly folder: string;

  constructor(folder: string) {
    super(`Sessions folder not found: ${folder}`);
    this.name = 'SessionsFolderNotFoundError';
    this.folder = folder;
  }
}

/** Key of the PostgreSQL advisory lock that keeps two ingestions from running together. */
export const LOCK_KEY = 0x46_44_49_4e_47;

type FileCounts = Pick<
  IngestCounts,
  'files' | 'apiCalls' | 'skillLaunches' | 'linesSkipped'
>;

/**
 * Reads what is new in the Claude Code session logs of `sessionsFolder` into the database, in
 * one transaction. Returns `already-running`, without waiting, while another ingestion runs.
 */
export async function ingest(
  db: Database,
  sessionsFolder: string,
): Promise<IngestResult> {
  const folder = await stat(sessionsFolder).catch(() => undefined);
  if (folder?.isDirectory() !== true) {
    throw new SessionsFolderNotFoundError(sessionsFolder);
  }
  const files = await findLogFiles(sessionsFolder);
  return db.transaction(async (tx): Promise<IngestResult> => {
    const lock = await tx.execute(
      sql`select pg_try_advisory_xact_lock(${LOCK_KEY}) as locked`,
    );
    if (!lockTaken(lock)) {
      return { status: 'already-running' };
    }
    const run = await startRun(tx);
    const counts: FileCounts = {
      files: 0,
      apiCalls: 0,
      skillLaunches: 0,
      linesSkipped: 0,
    };
    for (const file of files) {
      await ingestFile(run, file, counts);
      await ingestMeta(run, file, counts);
    }
    await saveSubAgents(run);
    await saveSessions(run);
    return {
      status: 'done',
      ...counts,
      sessions: run.sessions.size,
      subAgents: run.subAgents.size,
    };
  });
}

/** The line the command prints at the end of a run. */
export function summaryLine(result: IngestResult): string {
  if (result.status === 'already-running') {
    return 'Ingestion already running.';
  }
  if (result.files === 0) {
    return 'Nothing new.';
  }
  return `Ingested ${result.files} files: ${result.sessions} sessions, ${result.subAgents} sub-agents, ${result.apiCalls} API calls, ${result.skillLaunches} skill launches, ${result.linesSkipped} lines skipped.`;
}

function lockTaken(result: unknown): boolean {
  const rows: unknown = isObject(result) ? result['rows'] : result;
  const row: unknown = Array.isArray(rows) ? rows.at(0) : undefined;
  return isObject(row) && row['locked'] === true;
}

/** The part of a file not read yet: from the stored offset, or from the start if it shrank. */
async function unreadRange(
  run: Run,
  path: string,
): Promise<{ start: number; size: number; reset: boolean } | undefined> {
  const size = await stat(path).then(
    (stats) => stats.size,
    () => undefined,
  );
  if (size === undefined) {
    return undefined;
  }
  const stored = run.storedFiles.get(path);
  if (stored === undefined) {
    return { start: 0, size, reset: false };
  }
  if (stored.sizeBytes === size) {
    return undefined;
  }
  const reset = size < stored.readOffset;
  return { start: reset ? 0 : stored.readOffset, size, reset };
}

async function ingestFile(
  run: Run,
  file: LogFile,
  counts: FileCounts,
): Promise<void> {
  const range = await unreadRange(run, file.path);
  const chunk =
    range === undefined
      ? undefined
      : await readRange(file.path, range.start, range.size).catch(
          () => undefined,
        );
  if (range === undefined || chunk === undefined) {
    return;
  }
  counts.files += 1;
  const sessionRow = await loadSession(run, file.sessionId);
  const agentRow =
    file.subAgent === undefined
      ? undefined
      : await loadSubAgent(run, file.sessionId, file.subAgent.id);
  if (range.reset) {
    await forgetFileRows(run, file.path);
    if (agentRow === undefined) {
      resetSession(sessionRow);
    } else {
      Object.assign(agentRow, {
        firstAt: null,
        lastAt: null,
        cwd: null,
        gitBranch: '',
      });
    }
  }
  const { records, skipped, consumed } = parseLines(chunk);
  const rows = readThread(
    records,
    {
      sourcePath: file.path,
      sessionId: file.sessionId,
      subAgentId: agentRow?.id ?? null,
      startOffset: range.start,
    },
    agentRow ?? sessionRow,
    agentRow === undefined ? sessionRow : undefined,
  );
  keepCwd(agentRow, rows);
  const inserted = await insertThreadRows(run, file.sessionId, rows);
  Object.assign(counts, {
    linesSkipped: counts.linesSkipped + skipped + rows.skipped,
    apiCalls: counts.apiCalls + inserted.apiCalls,
    skillLaunches: counts.skillLaunches + inserted.skillLaunches,
  });
  await saveOffset(run, file.path, {
    sizeBytes: range.size,
    readOffset: range.start + consumed,
  });
}

/** Keeps a sub-agent's first working directory and the branch of its last one. */
function keepCwd(
  agent: { cwd: string | null; gitBranch: string } | undefined,
  rows: { cwd: string | null; gitBranch: string | null },
): void {
  if (agent === undefined) {
    return;
  }
  agent.cwd ??= rows.cwd;
  agent.gitBranch = rows.gitBranch ?? agent.gitBranch;
}

/** Reads the meta file of a sub-agent when it is new or changed. */
async function ingestMeta(
  run: Run,
  file: LogFile,
  counts: FileCounts,
): Promise<void> {
  if (file.subAgent === undefined) {
    return;
  }
  const { metaPath, id } = file.subAgent;
  const size = await stat(metaPath).then(
    (stats) => stats.size,
    () => undefined,
  );
  if (size === undefined || run.storedFiles.get(metaPath)?.sizeBytes === size) {
    return;
  }
  const content = await readFile(metaPath, 'utf8').catch(() => undefined);
  if (content === undefined) {
    return;
  }
  counts.files += 1;
  const row = await loadSubAgent(run, file.sessionId, id);
  const meta = parseJson(content);
  if (meta === undefined) {
    counts.linesSkipped += 1;
  } else {
    const text = (key: string): string => {
      const value = meta[key];
      return typeof value === 'string' ? value : '';
    };
    row.toolUseId = text('toolUseId');
    row.agentType = text('agentType');
    row.description = text('description');
    row.model = text('model');
  }
  await saveOffset(run, metaPath, { sizeBytes: size, readOffset: size });
}

function parseJson(text: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(text);
    return isObject(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

import { readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { forgetProjectsWithoutFactoryOnce } from '../projects/remove.ts';
import {
  type FactoryCheck,
  cachedFactoryCheck,
  hasFactory,
} from './factory.ts';
import { findCodexFiles } from './codex-files.ts';
import { ingestCodexFile } from './codex.ts';
import { type LogFile, findLogFiles, logFileKey, readRange } from './files.ts';
import {
  readFrictionsAgainOnce,
  storeChunkFrictions,
} from './ingest-frictions.ts';
import { LOCK_KEY } from './lock.ts';
import {
  type RemoteReader,
  readOriginRemote,
  storeRootRemotes,
} from './remote.ts';
import { isObject, parseLines } from './records.ts';
import {
  type Run,
  forgetFileRows,
  readMainLogsAgainOnce,
  insertThreadRows,
  loadSession,
  loadSubAgent,
  resetSession,
  saveOffset,
  saveSessions,
  saveSubAgents,
  startRun,
} from './store.ts';
import { selectFactorySessions } from './select.ts';
import { readThread } from './thread.ts';
import { type FileCounts, type IngestCounts, unreadRange } from './range.ts';
import { runsUnderWsl } from './wsl.ts';

export type { IngestCounts } from './range.ts';

export interface IngestOptions {
  hasFactory?: FactoryCheck;
  home?: string;
  codexFolder?: string;
  wsl?: boolean;
  readRemote?: RemoteReader;
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

export { LOCK_KEY } from './lock.ts';

/**
 * Reads what is new in the Claude Code session logs of `sessionsFolder`, and in the Codex rollouts
 * of `options.codexFolder`, into the database, in
 * one transaction. Returns `already-running`, without waiting, while another ingestion runs.
 */
export async function ingest(
  db: Database,
  sessionsFolder: string,
  options: IngestOptions = {},
): Promise<IngestResult> {
  const check = cachedFactoryCheck(options.hasFactory ?? hasFactory);
  const folder = await stat(sessionsFolder).catch(() => undefined);
  if (folder?.isDirectory() !== true) {
    throw new SessionsFolderNotFoundError(sessionsFolder);
  }
  const files = await findFiles(sessionsFolder, options);
  return db.transaction(async (tx): Promise<IngestResult> => {
    const lock = await tx.execute(
      sql`select pg_try_advisory_xact_lock(${LOCK_KEY}) as locked`,
    );
    if (!lockTaken(lock)) {
      return { status: 'already-running' };
    }
    await forgetProjectsWithoutFactoryOnce(tx, check);
    await readMainLogsAgainOnce(tx);
    const run = await startRun(tx);
    const selection = await selectFactorySessions(run, files, check);
    run.projects = selection.projects;
    const home = options.home ?? homedir();
    const counts: FileCounts = {
      files: 0,
      apiCalls: 0,
      skillLaunches: 0,
      frictions: await readFrictionsAgainOnce(
        run,
        selection.files.filter((file) => file.codex === undefined),
        home,
      ),
      linesSkipped: 0,
    };
    for (const file of selection.files) {
      if (file.codex === undefined) {
        await ingestFile(run, file, home, counts);
        await ingestMeta(run, file, counts);
      } else {
        await ingestCodexFile(run, file, counts);
      }
    }
    await saveSubAgents(run);
    await saveSessions(run);
    await storeRootRemotes(tx, options.readRemote ?? readOriginRemote);
    return {
      status: 'done',
      ...counts,
      sessions: run.sessions.size,
      subAgents: run.subAgents.size,
      sessionsSkipped: selection.skippedSessions,
    };
  });
}

async function findFiles(
  sessionsFolder: string,
  { codexFolder, wsl }: IngestOptions,
): Promise<LogFile[]> {
  return [
    ...(await findLogFiles(sessionsFolder)),
    ...(codexFolder === undefined
      ? []
      : await findCodexFiles(codexFolder, { wsl: wsl ?? runsUnderWsl() })),
  ];
}

/** The line the command prints at the end of a run. */
export function summaryLine(result: IngestResult): string {
  if (result.status === 'already-running') {
    return 'Ingestion already running.';
  }
  if (
    result.files === 0 &&
    result.sessionsSkipped === 0 &&
    result.frictions === 0
  ) {
    return 'Nothing new.';
  }
  return `Ingested ${result.files} files: ${result.sessions} sessions, ${result.subAgents} sub-agents, ${result.apiCalls} API calls, ${result.skillLaunches} skill launches, ${result.frictions} frictions, ${result.linesSkipped} lines skipped, ${result.sessionsSkipped} sessions skipped (no factory).`;
}

function lockTaken(result: unknown): boolean {
  const rows: unknown = isObject(result) ? result['rows'] : result;
  const row: unknown = Array.isArray(rows) ? rows.at(0) : undefined;
  return isObject(row) && row['locked'] === true;
}

async function forgetFile(
  run: Run,
  file: LogFile,
  sessionRow: Parameters<typeof resetSession>[0],
  agentRow: { firstAt: Date | null; lastAt: Date | null } | undefined,
): Promise<void> {
  await forgetFileRows(run, logFileKey(file), file.path);
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

async function ingestFile(
  run: Run,
  file: LogFile,
  home: string,
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
    await forgetFile(run, file, sessionRow, agentRow);
  }
  const { records, skipped, consumed } = parseLines(chunk);
  const rows = readThread(
    records,
    {
      sourcePath: logFileKey(file),
      sessionId: file.sessionId,
      subAgentId: agentRow?.id ?? null,
      startOffset: range.start,
    },
    agentRow ?? sessionRow,
    agentRow === undefined ? sessionRow : undefined,
  );
  keepCwd(agentRow, rows);
  const inserted = await insertThreadRows(run, file.sessionId, rows);
  const frictions = await storeChunkFrictions(
    run,
    { file, subAgentId: agentRow?.id ?? null, home },
    records,
    range.start,
  );
  Object.assign(counts, {
    linesSkipped:
      counts.linesSkipped + skipped + rows.skipped + frictions.untimed,
    apiCalls: counts.apiCalls + inserted.apiCalls,
    skillLaunches: counts.skillLaunches + inserted.skillLaunches,
    frictions: counts.frictions + frictions.stored,
  });
  await saveOffset(run, file.path, {
    sizeBytes: range.size,
    readOffset: range.start + consumed,
  });
}

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

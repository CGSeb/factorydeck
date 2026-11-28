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
import { type LogFile, findLogFiles } from './files.ts';
import { readFrictionsAgainOnce } from './ingest-frictions.ts';
import { localLogOf, readLocalLog, storeLocalRead } from './local-read.ts';
import { saveSessions } from './local-store.ts';
import { LOCK_KEY } from './lock.ts';
import {
  type RemoteReader,
  readOriginRemote,
  storeRootRemotes,
} from './remote.ts';
import {
  type SubAgentMeta,
  parseSubAgentMeta,
  readClaudeCodeLog,
} from './readers/claude-code.ts';
import { decodeClaudeCodeState } from './readers/claude-code-state.ts';
import { isObject } from './records.ts';
import {
  type Run,
  readMainLogsAgainOnce,
  saveOffset,
  startRun,
} from './store.ts';
import { selectFactorySessions } from './select.ts';
import type { FileCounts, IngestCounts } from './range.ts';
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
        await ingestClaudeCodeFile(run, file, home, counts);
      } else {
        await ingestCodexFile(run, file, home, counts);
      }
    }
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

interface MetaRead {
  meta: SubAgentMeta | undefined;
  changed: boolean;
}

async function readMeta(
  run: Run,
  file: LogFile,
  counts: FileCounts,
): Promise<MetaRead | undefined> {
  if (file.subAgent === undefined) return undefined;
  const { metaPath } = file.subAgent;
  const size = await stat(metaPath).then(
    (stats) => stats.size,
    () => undefined,
  );
  const content =
    size === undefined
      ? undefined
      : await readFile(metaPath, 'utf8').catch(() => undefined);
  if (size === undefined || content === undefined) return undefined;
  const meta = parseSubAgentMeta(content);
  const changed = run.storedFiles.get(metaPath)?.sizeBytes !== size;
  if (changed) {
    counts.files += 1;
    if (meta === undefined) counts.linesSkipped += 1;
    await saveOffset(run, metaPath, { sizeBytes: size, readOffset: size });
  }
  return { meta, changed };
}

async function ingestClaudeCodeFile(
  run: Run,
  file: LogFile,
  home: string,
  counts: FileCounts,
): Promise<void> {
  const metaRead = await readMeta(run, file, counts);
  const log = localLogOf(file);
  const found = await readLocalLog(
    run,
    log,
    {
      current: (state) => decodeClaudeCodeState(state) !== undefined,
      read: (from, bytes, readerState) =>
        readClaudeCodeLog({
          bytes,
          from,
          readerState,
          home,
          log: { sessionId: file.sessionId, subAgentId: log.subAgentId },
          meta: metaRead?.meta,
        }),
    },
    metaRead?.changed === true,
  );
  if (found !== undefined) await storeLocalRead(run, log, found, counts);
}

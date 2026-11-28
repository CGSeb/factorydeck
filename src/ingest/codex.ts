import { and, eq, inArray, like, ne } from 'drizzle-orm';
import { UNASSIGNED_PROJECT, apiCall, friction } from '../db/schema.ts';
import { CODEX, type CodexFile, parseCodexRecord } from './codex-files.ts';
import {
  type CodexRows,
  TOKEN_COUNT_KEY,
  codexFrictionRows,
  codexState,
  codexToolCalls,
  readCodexChunk,
  unresolvedOutputs,
} from './codex-records.ts';
import { type LogFile, logFileKey, readRange } from './files.ts';
import type { FrictionRow } from './friction-rows.ts';
import { type FileCounts, unreadRange } from './range.ts';
import { parseLines } from './records.ts';
import {
  type Run,
  type SessionRow,
  type SubAgentRow,
  forgetFileRows,
  insertChunks,
  insertThreadRows,
  loadSession,
  loadSubAgent,
  resetSession,
  saveOffset,
} from './store.ts';
import type { ApiCallRow } from './thread.ts';

const KEY_CHUNK = 500;

function applyRootMeta(row: SessionRow, codex: CodexFile): void {
  if (row.cwd !== codex.cwd) row.project = UNASSIGNED_PROJECT;
  const branch = codex.meta.gitBranch;
  Object.assign(row, {
    cwd: codex.cwd,
    cwdFromMain: codex.cwd !== null,
    gitBranch: branch,
    gitBranches:
      branch === '' || row.gitBranches.includes(branch)
        ? row.gitBranches
        : [...row.gitBranches, branch],
    title: '',
  });
}

function applySubAgentMeta(row: SubAgentRow, codex: CodexFile): void {
  Object.assign(row, {
    agentType: codex.meta.agentRole,
    description: codex.meta.agentPath,
    cwd: codex.cwd,
    gitBranch: codex.meta.gitBranch,
  });
}

async function newCalls(
  run: Run,
  file: LogFile,
  calls: ApiCallRow[],
): Promise<ApiCallRow[]> {
  const keys = calls
    .map((call) => call.requestKey)
    .filter((key) => !key.startsWith(TOKEN_COUNT_KEY));
  const stored = new Set<string>();
  for (let index = 0; index < keys.length; index += KEY_CHUNK) {
    const rows = await run.tx
      .select({ key: apiCall.requestKey })
      .from(apiCall)
      .where(
        and(
          eq(apiCall.sessionId, file.sessionId),
          ne(apiCall.sourcePath, logFileKey(file)),
          inArray(apiCall.requestKey, keys.slice(index, index + KEY_CHUNK)),
        ),
      );
    for (const row of rows) stored.add(row.key);
  }
  return calls.filter((call) => !stored.has(call.requestKey));
}

async function frictionsOf(
  file: LogFile,
  rows: CodexRows,
  start: number,
): Promise<FrictionRow[]> {
  const earlier =
    start > 0 && unresolvedOutputs(rows)
      ? await readRange(file.path, 0, start).then(
          (prefix) =>
            codexToolCalls(parseLines(prefix, parseCodexRecord).records),
          () => undefined,
        )
      : undefined;
  return codexFrictionRows(rows, earlier);
}

async function storeRows(
  run: Run,
  file: LogFile,
  rows: CodexRows,
  start: number,
): Promise<{ apiCalls: number; frictions: number }> {
  if (rows.dropTokenCountCalls) {
    await run.tx
      .delete(apiCall)
      .where(
        and(
          eq(apiCall.sourcePath, logFileKey(file)),
          like(apiCall.requestKey, `${TOKEN_COUNT_KEY}%`),
        ),
      );
  }
  const inserted = await insertThreadRows(run, file.sessionId, {
    calls: await newCalls(run, file, rows.calls),
    launches: [],
    prompts: rows.prompts,
    closingLines: rows.closingLines,
    earlierSkillPrompts: [],
    skipped: 0,
    cwd: null,
    gitBranch: null,
  });
  const frictions = await insertChunks(
    await frictionsOf(file, rows, start),
    (chunk) =>
      run.tx
        .insert(friction)
        .values(chunk)
        .onConflictDoNothing()
        .returning({ id: friction.id }),
  );
  return { apiCalls: inserted.apiCalls, frictions };
}

interface Threads {
  sessionRow: SessionRow;
  agentRow: SubAgentRow | undefined;
}

async function loadThreads(
  run: Run,
  file: LogFile,
  codex: CodexFile,
  range: { start: number; reset: boolean },
): Promise<Threads> {
  const sessionRow = await loadSession(run, file.sessionId, CODEX);
  const agentRow =
    codex.subAgentId === undefined
      ? undefined
      : await loadSubAgent(run, file.sessionId, codex.subAgentId, CODEX);
  if (range.reset) {
    await forgetFileRows(run, logFileKey(file), file.path);
    if (agentRow === undefined) resetSession(sessionRow);
    else Object.assign(agentRow, { firstAt: null, lastAt: null, model: '' });
  }
  if (range.start === 0) {
    if (agentRow === undefined) applyRootMeta(sessionRow, codex);
    else applySubAgentMeta(agentRow, codex);
  }
  return { sessionRow, agentRow };
}

async function unreadChunk(
  run: Run,
  path: string,
): Promise<
  { start: number; size: number; reset: boolean; chunk: Buffer } | undefined
> {
  const range = await unreadRange(run, path);
  if (range === undefined) return undefined;
  const chunk = await readRange(path, range.start, range.size).catch(
    () => undefined,
  );
  return chunk === undefined ? undefined : { ...range, chunk };
}

export async function ingestCodexFile(
  run: Run,
  file: LogFile,
  counts: FileCounts,
): Promise<void> {
  const { codex } = file;
  const range = codex && (await unreadChunk(run, file.path));
  if (codex === undefined || range === undefined) return;
  counts.files += 1;
  const { sessionRow, agentRow } = await loadThreads(run, file, codex, range);
  const state = codexState(
    range.start === 0 ? undefined : run.storedFiles.get(file.path)?.readerState,
  );
  const parsed = parseLines(range.chunk, parseCodexRecord);
  const rows = readCodexChunk(parsed.records, {
    source: {
      sourcePath: logFileKey(file),
      logPath: file.path,
      sessionId: file.sessionId,
      subAgentId: codex.subAgentId ?? null,
      startOffset: range.start,
      historyStart: codex.meta.historyStart,
    },
    state,
    span: agentRow ?? sessionRow,
    main: agentRow === undefined ? sessionRow : undefined,
  });
  state.lines += parsed.lines;
  if (agentRow?.model === '') agentRow.model = rows.firstModel;
  const stored = await storeRows(run, file, rows, range.start);
  Object.assign(counts, {
    linesSkipped: counts.linesSkipped + parsed.skipped + rows.skipped,
    apiCalls: counts.apiCalls + stored.apiCalls,
    frictions: counts.frictions + stored.frictions,
  });
  await saveOffset(run, file.path, {
    sizeBytes: range.size,
    readOffset: range.start + parsed.consumed,
    readerState: { ...state, sessionId: file.sessionId },
  });
}

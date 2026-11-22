import { stat } from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import { friction, ingestState } from '../db/schema.ts';
import { STATE_ID } from '../projects/remove.ts';
import { type LogFile, readRange } from './files.ts';
import {
  type FrictionRow,
  type FrictionSource,
  frictionRows,
  readFrictions,
  toolCallsOfRecords,
  unresolvedToolCalls,
} from './friction-rows.ts';
import { type LogRecord, parseLines } from './records.ts';
import { type Run, type Transaction, insertChunks } from './store.ts';

type Records = readonly { record: LogRecord; offset: number }[];

export interface FrictionThread {
  file: LogFile;
  subAgentId: string | null;
  home: string;
}

function frictionSource({
  file,
  subAgentId,
  home,
}: FrictionThread): FrictionSource {
  return { sourcePath: file.path, sessionId: file.sessionId, subAgentId, home };
}

async function insertFrictions(run: Run, rows: FrictionRow[]): Promise<number> {
  return insertChunks(rows, (chunk) =>
    run.tx
      .insert(friction)
      .values(chunk)
      .onConflictDoNothing()
      .returning({ id: friction.id }),
  );
}

async function frictionsOfChunk(
  records: Records,
  source: FrictionSource,
  start: number,
): Promise<{ rows: FrictionRow[]; untimed: number }> {
  const collector = readFrictions(records, source, start);
  const earlier =
    start > 0 && unresolvedToolCalls(collector)
      ? await readRange(source.sourcePath, 0, start).then(
          (prefix) => toolCallsOfRecords(parseLines(prefix).records),
          () => undefined,
        )
      : undefined;
  return { rows: frictionRows(collector, earlier), untimed: collector.untimed };
}

export async function storeChunkFrictions(
  run: Run,
  thread: FrictionThread,
  records: Records,
  start: number,
): Promise<{ stored: number; untimed: number }> {
  const { rows, untimed } = await frictionsOfChunk(
    records,
    frictionSource(thread),
    start,
  );
  return { stored: await insertFrictions(run, rows), untimed };
}

async function frictionsReadDone(tx: Transaction): Promise<boolean> {
  const [state] = await tx
    .select({ done: ingestState.frictionsReadDone })
    .from(ingestState)
    .where(eq(ingestState.id, STATE_ID));
  return state?.done === true;
}

async function markFrictionsRead(tx: Transaction): Promise<void> {
  await tx
    .insert(ingestState)
    .values({ id: STATE_ID, frictionsReadDone: true })
    .onConflictDoUpdate({
      target: ingestState.id,
      set: { frictionsReadDone: true },
    });
}

export async function readFrictionsAgainOnce(
  run: Run,
  files: readonly LogFile[],
  home: string,
): Promise<number> {
  if (await frictionsReadDone(run.tx)) return 0;
  let stored = 0;
  for (const file of files) {
    const end = run.storedFiles.get(file.path)?.readOffset ?? 0;
    const size = await stat(file.path).then(
      (stats) => stats.size,
      () => undefined,
    );
    if (end === 0 || size === undefined || size < end) continue;
    const chunk = await readRange(file.path, 0, end).catch(() => undefined);
    if (chunk === undefined) continue;
    const thread = { file, subAgentId: file.subAgent?.id ?? null, home };
    stored += (
      await storeChunkFrictions(run, thread, parseLines(chunk).records, 0)
    ).stored;
  }
  await markFrictionsRead(run.tx);
  return stored;
}

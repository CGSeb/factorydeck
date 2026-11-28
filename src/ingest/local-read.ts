import { type LogFile, logFileKey, readRange } from './files.ts';
import { type ThreadRead, storeRead } from './local-store.ts';
import { type FileCounts, unreadRange } from './range.ts';
import type { ReadResult } from './readers/reader.ts';
import { isObject } from './records.ts';
import {
  type Run,
  forgetFileRows,
  forgetStaleCalls,
  saveOffset,
} from './store.ts';

export interface LocalLog {
  path: string;
  fileKey: string;
  sessionId: string;
  subAgentId: string | null;
}

export interface LocalReader {
  current: (state: unknown) => boolean;
  read: (from: number, bytes: Buffer, readerState: unknown) => ReadResult;
}

export interface LocalRead {
  read: ThreadRead;
  size: number | undefined;
}

const EMPTY = Buffer.alloc(0);

function readOnce(
  reader: LocalReader,
  from: number,
  bytes: Buffer,
  state: unknown,
): ThreadRead | undefined {
  const result = reader.read(from, bytes, from === 0 ? null : state);
  return result.status === 'read' ? result : undefined;
}

async function readAgain(
  run: Run,
  log: LocalLog,
  reader: LocalReader,
  size: number,
): Promise<ThreadRead | undefined> {
  const whole = await readRange(log.path, 0, size).catch(() => undefined);
  const read = whole && readOnce(reader, 0, whole, null);
  if (read === undefined) return undefined;
  await forgetStaleCalls(
    run.tx,
    log.fileKey,
    read.thread.apiCalls.map((call) => call.requestKey),
  );
  return read;
}

function readUnchanged(
  reader: LocalReader,
  stored: { readOffset: number; readerState: unknown } | undefined,
): LocalRead | undefined {
  const from = stored?.readOffset ?? 0;
  const read = readOnce(reader, from, EMPTY, stored?.readerState);
  return read && { read, size: undefined };
}

export async function readLocalLog(
  run: Run,
  log: LocalLog,
  reader: LocalReader,
  force = false,
): Promise<LocalRead | undefined> {
  const stored = run.storedFiles.get(log.path);
  const range = await unreadRange(run, log.path, reader.current);
  if (range === undefined) {
    return force ? readUnchanged(reader, stored) : undefined;
  }
  const chunk = await readRange(log.path, range.start, range.size).catch(
    () => undefined,
  );
  if (chunk === undefined) return undefined;
  if (range.reset) await forgetFileRows(run, log, log.path);
  const result = reader.read(range.start, chunk, stored?.readerState);
  const read =
    result.status === 'read'
      ? result
      : await readAgain(run, log, reader, range.size);
  return read && { read, size: range.size };
}

export function localLogOf(file: LogFile): LocalLog {
  return {
    path: file.path,
    fileKey: logFileKey(file),
    sessionId: file.sessionId,
    subAgentId: file.subAgent?.id ?? file.codex?.subAgentId ?? null,
  };
}

export async function storeLocalRead(
  run: Run,
  log: LocalLog,
  { read, size }: LocalRead,
  counts: FileCounts,
): Promise<void> {
  const stored = await storeRead(run, log.path, read);
  Object.assign(counts, {
    files: counts.files + (size === undefined ? 0 : 1),
    linesSkipped: counts.linesSkipped + read.skipped + read.untimed,
    apiCalls: counts.apiCalls + stored.apiCalls,
    skillLaunches: counts.skillLaunches + stored.skillLaunches,
    frictions: counts.frictions + stored.frictions,
  });
  if (size === undefined) return;
  await saveOffset(run, log.path, {
    sizeBytes: size,
    readOffset: read.readTo,
    readerState: {
      ...(isObject(read.readerState) ? read.readerState : {}),
      sessionId: log.sessionId,
    },
  });
}

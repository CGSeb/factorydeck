import type {
  ReadResult,
  ReaderFriction,
  ReaderThread,
} from '../ingest/readers/reader.ts';

type Read = Extract<ReadResult, { status: 'read' }>;

export type PartReader = (
  bytes: Buffer,
  from: number,
  readerState: unknown,
) => ReadResult;

export function readOrThrow(result: ReadResult): Read {
  if (result.status !== 'read') throw new Error('The reader asked to restart');
  return result;
}

function byRecord(a: ReaderFriction, b: ReaderFriction): number {
  return (
    a.recordId.localeCompare(b.recordId) ||
    a.kind.localeCompare(b.kind) ||
    a.position - b.position
  );
}

function firstOfEachKey(frictions: ReaderFriction[]): ReaderFriction[] {
  const seen = new Set<string>();
  return frictions.filter((friction) => {
    const key = JSON.stringify([
      friction.recordId,
      friction.kind,
      friction.position,
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export interface Whole {
  thread: ReaderThread;
  frictions: ReaderFriction[];
  readerState: unknown;
  skipped: number;
  untimed: number;
  states: unknown[];
}

export function readInParts(
  read: PartReader,
  bytes: Buffer,
  ends: readonly number[],
): Whole {
  let from = 0;
  let state: unknown = null;
  const parts: Read[] = [];
  for (const end of [...ends, bytes.length]) {
    const result = read(bytes.subarray(from, end), from, state);
    if (result.status === 'restart') parts.length = 0;
    const part =
      result.status === 'read'
        ? result
        : readOrThrow(read(bytes.subarray(0, end), 0, null));
    parts.push(part);
    from = part.readTo;
    state = JSON.parse(JSON.stringify(part.readerState)) as unknown;
  }
  const last = parts.at(-1);
  if (last === undefined) throw new Error('No part read');
  return {
    thread: {
      ...last.thread,
      from: 0,
      apiCalls: parts.flatMap((part) => part.thread.apiCalls),
      skillLaunches: parts.flatMap((part) => part.thread.skillLaunches),
      prompts: parts.flatMap((part) => part.thread.prompts),
      closingLines: parts.flatMap((part) => part.thread.closingLines),
    },
    frictions: firstOfEachKey(parts.flatMap((part) => part.frictions)).sort(
      byRecord,
    ),
    readerState: last.readerState,
    skipped: parts.reduce((total, part) => total + part.skipped, 0),
    untimed: parts.reduce((total, part) => total + part.untimed, 0),
    states: parts.map((part) => part.readerState),
  };
}

export function lineEnds(bytes: Buffer): number[] {
  const ends: number[] = [];
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] === 0x0a) ends.push(index + 1);
  }
  return ends;
}

export function cutPairs(bytes: Buffer): number[][] {
  const ends = lineEnds(bytes);
  const pairs: number[][] = [[Math.floor(bytes.length / 2)]];
  for (let first = 0; first < ends.length; first += 1) {
    for (let second = first + 1; second < ends.length; second += 1) {
      pairs.push([ends[first] ?? 0, ends[second] ?? 0]);
    }
  }
  return pairs;
}

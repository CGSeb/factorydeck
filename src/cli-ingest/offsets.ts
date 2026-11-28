import { inArray } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { ingestFile } from '../db/schema.ts';
import type { Transaction } from '../ingest/store.ts';
import {
  type BatchThread,
  type OffsetMismatch,
  type OffsetsAnswer,
  type StoredOffset,
  isFileKey,
} from './batch-schema.ts';

const KEY_CHUNK = 500;

async function storedOffsets(
  db: Database | Transaction,
  fileKeys: readonly string[],
): Promise<Map<string, StoredOffset>> {
  const offsets = new Map<string, StoredOffset>();
  for (let index = 0; index < fileKeys.length; index += KEY_CHUNK) {
    const rows = await db
      .select({
        fileKey: ingestFile.fileKey,
        readTo: ingestFile.readTo,
        parserVersion: ingestFile.parserVersion,
        readerState: ingestFile.readerState,
      })
      .from(ingestFile)
      .where(
        inArray(ingestFile.fileKey, fileKeys.slice(index, index + KEY_CHUNK)),
      );
    for (const { fileKey, readerState, ...offset } of rows) {
      offsets.set(fileKey, { ...offset, readerState: readerState ?? null });
    }
  }
  return offsets;
}

export async function readOffsets(
  db: Database,
  fileKeys: readonly string[],
): Promise<OffsetsAnswer> {
  const stored = await storedOffsets(db, fileKeys.filter(isFileKey));
  return {
    offsets: Object.fromEntries(
      fileKeys.map((key) => [key, stored.get(key) ?? null]),
    ),
  };
}

export async function offsetMismatches(
  tx: Transaction,
  threads: readonly BatchThread[],
): Promise<OffsetMismatch[]> {
  const resumed = threads.filter((thread) => thread.from > 0);
  if (resumed.length === 0) return [];
  const stored = await storedOffsets(
    tx,
    resumed.map((thread) => thread.fileKey),
  );
  return resumed.flatMap((thread) => {
    const readTo = stored.get(thread.fileKey)?.readTo ?? 0;
    return readTo === thread.from ? [] : [{ fileKey: thread.fileKey, readTo }];
  });
}

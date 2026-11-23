import { stat } from 'node:fs/promises';
import type { Run } from './store.ts';

/** What one ingestion stored, as its summary line shows it. */
export interface IngestCounts {
  files: number;
  sessions: number;
  subAgents: number;
  apiCalls: number;
  skillLaunches: number;
  frictions: number;
  linesSkipped: number;
  sessionsSkipped: number;
}

export type FileCounts = Pick<
  IngestCounts,
  'files' | 'apiCalls' | 'skillLaunches' | 'frictions' | 'linesSkipped'
>;

/** The part of a file not read yet: from the stored offset, or from the start if it shrank. */
export async function unreadRange(
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

import { stat } from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import { ingestState } from '../db/schema.ts';
import { STATE_ID } from '../projects/remove.ts';
import { type LogFile, readRange } from './files.ts';
import { storeFrictions } from './local-store.ts';
import { readClaudeCodeLog } from './readers/claude-code.ts';
import type { Run, Transaction } from './store.ts';

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
    const read = readClaudeCodeLog({
      bytes: chunk,
      from: 0,
      readerState: null,
      home,
      log: { sessionId: file.sessionId, subAgentId: file.subAgent?.id ?? null },
    });
    if (read.status === 'read') {
      stored += await storeFrictions(run, file.path, read);
    }
  }
  await markFrictionsRead(run.tx);
  return stored;
}

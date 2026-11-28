import { friction } from '../db/schema.ts';
import { type Transaction, insertChunks } from '../ingest/store.ts';
import type { BatchThread } from './batch.ts';
import { frictionColumns } from './friction-schema.ts';

export async function storeFrictions(
  tx: Transaction,
  thread: BatchThread,
): Promise<void> {
  const rows = thread.frictions.map((item) => ({
    ...frictionColumns(item),
    sourcePath: thread.fileKey,
    sessionId: thread.sessionId,
    subAgentId: thread.subAgentId,
    agent: thread.agent,
  }));
  await insertChunks(rows, (chunk) =>
    tx
      .insert(friction)
      .values(chunk)
      .onConflictDoNothing()
      .returning({ id: friction.id }),
  );
}

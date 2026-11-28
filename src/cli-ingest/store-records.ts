import { closingLine, skillLaunch, userPrompt } from '../db/schema.ts';
import { type Transaction, insertChunks } from '../ingest/store.ts';
import type { BatchThread } from './batch-schema.ts';

export async function storeThreadRecords(
  tx: Transaction,
  thread: BatchThread,
): Promise<void> {
  const base = { sourcePath: thread.fileKey, sessionId: thread.sessionId };
  await insertChunks(
    thread.skillLaunches.map((launch) => ({
      ...base,
      subAgentId: thread.subAgentId,
      recordUuid: launch.recordId,
      at: new Date(launch.at),
      skill: launch.skill,
    })),
    (chunk) =>
      tx
        .insert(skillLaunch)
        .values(chunk)
        .onConflictDoNothing()
        .returning({ id: skillLaunch.id }),
  );
  await insertChunks(
    thread.prompts.map((prompt) => ({
      ...base,
      recordUuid: prompt.recordId,
      at: new Date(prompt.at),
      promptId: prompt.promptId,
      command: prompt.command,
    })),
    (chunk) =>
      tx
        .insert(userPrompt)
        .values(chunk)
        .onConflictDoNothing()
        .returning({ id: userPrompt.id }),
  );
  await insertChunks(
    thread.closingLines.map((closing) => ({
      ...base,
      recordUuid: closing.recordId,
      at: new Date(closing.at),
      position: closing.position,
      line: closing.line,
    })),
    (chunk) =>
      tx
        .insert(closingLine)
        .values(chunk)
        .onConflictDoNothing()
        .returning({ id: closingLine.id }),
  );
}

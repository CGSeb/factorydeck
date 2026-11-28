import type { BatchInput } from '../cli-ingest/batch-schema.ts';
import type { Database } from '../db/client.ts';
import { friction } from '../db/schema.ts';
import {
  type ThreadInput,
  mainThread,
  minutes,
  subAgentThread,
} from './cli-batch.ts';

export const HASH = 'a'.repeat(64);

export type FrictionInput = NonNullable<ThreadInput['frictions']>[number];

export function failedCommand(
  recordId = 'rec-1',
  position = 0,
): Extract<FrictionInput, { kind: 'tool-error' }> {
  return {
    kind: 'tool-error',
    recordId,
    position,
    at: minutes(3),
    tool: 'Bash',
    category: 'command-failed',
    program: 'pnpm',
    exitCode: 2,
    commandHash: HASH,
  };
}

export function everyKind(): FrictionInput[] {
  return [
    failedCommand(),
    {
      kind: 'stop-blocked',
      recordId: 'rec-2',
      position: 0,
      at: minutes(4),
      hookCommand: '~/.claude/hooks/check.sh',
    },
    {
      kind: 'compaction',
      recordId: 'offset:8192',
      position: 0,
      at: minutes(5),
      trigger: 'auto',
      preTokens: 160_000,
      postTokens: 20_000,
    },
  ];
}

export function batch(frictions: FrictionInput[] = everyKind()): BatchInput {
  return {
    parserVersion: 1,
    threads: [
      { ...mainThread('s-1'), frictions },
      {
        ...subAgentThread('s-1', 'a1'),
        frictions: [
          {
            kind: 'tool-error',
            recordId: 'sub-1',
            position: 1,
            at: minutes(7),
            tool: 'unknown',
            category: 'permission-denied',
          },
        ],
      },
    ],
  };
}

export async function storedFrictions(
  db: Database,
): Promise<(typeof friction.$inferSelect)[]> {
  return db
    .select()
    .from(friction)
    .orderBy(friction.sourcePath, friction.recordUuid);
}

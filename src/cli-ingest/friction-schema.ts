import { z } from 'zod';
import { TOOL_ERROR_CATEGORIES } from '../ingest/frictions.ts';

export const MAX_RECORD_ID_LENGTH = 200;
export const COMPACTION_TRIGGERS = ['auto', 'manual'] as const;

const COMMAND_HASH = /^[0-9a-f]{64}$/;

const whole = z.number().int().nonnegative();
const time = z.iso.datetime({
  offset: true,
  message: 'Expected an ISO 8601 time with an offset',
});

const recordId = z
  .string()
  .min(1, 'Record id is empty')
  .max(
    MAX_RECORD_ID_LENGTH,
    `Record id is over ${MAX_RECORD_ID_LENGTH} characters`,
  );

function notFor(kind: string) {
  return z.null({ message: `Field does not apply to a ${kind}` }).optional();
}

const base = {
  recordId,
  position: whole,
  at: time,
};

const toolErrorSchema = z.object({
  ...base,
  kind: z.literal('tool-error'),
  tool: z.string().min(1, 'Tool is empty'),
  category: z.enum(TOOL_ERROR_CATEGORIES),
  program: z.string().nullable().default(null),
  exitCode: z.number().int().nullable().default(null),
  commandHash: z
    .string()
    .regex(COMMAND_HASH, 'Expected a SHA-256 hash in lower-case hex')
    .nullable()
    .default(null),
  hookCommand: notFor('tool-error'),
  trigger: notFor('tool-error'),
  preTokens: notFor('tool-error'),
  postTokens: notFor('tool-error'),
});

const stopBlockedSchema = z.object({
  ...base,
  kind: z.literal('stop-blocked'),
  hookCommand: z.string().min(1, 'Hook command is empty'),
  tool: notFor('stop-blocked'),
  category: notFor('stop-blocked'),
  program: notFor('stop-blocked'),
  exitCode: notFor('stop-blocked'),
  commandHash: notFor('stop-blocked'),
  trigger: notFor('stop-blocked'),
  preTokens: notFor('stop-blocked'),
  postTokens: notFor('stop-blocked'),
});

const compactionSchema = z.object({
  ...base,
  kind: z.literal('compaction'),
  trigger: z.enum(COMPACTION_TRIGGERS).nullable().default(null),
  preTokens: whole.nullable().default(null),
  postTokens: whole.nullable().default(null),
  tool: notFor('compaction'),
  category: notFor('compaction'),
  program: notFor('compaction'),
  exitCode: notFor('compaction'),
  commandHash: notFor('compaction'),
  hookCommand: notFor('compaction'),
});

export const frictionSchema = z.discriminatedUnion('kind', [
  toolErrorSchema,
  stopBlockedSchema,
  compactionSchema,
]);

export type BatchFriction = z.infer<typeof frictionSchema>;

export interface FrictionColumns {
  recordUuid: string;
  position: number;
  at: Date;
  kind: BatchFriction['kind'];
  tool: string | null;
  category: string | null;
  program: string | null;
  exitCode: number | null;
  commandHash: string | null;
  hookCommand: string | null;
  trigger: string | null;
  preTokens: number | null;
  postTokens: number | null;
}

const NO_FIELDS = {
  tool: null,
  category: null,
  program: null,
  exitCode: null,
  commandHash: null,
  hookCommand: null,
  trigger: null,
  preTokens: null,
  postTokens: null,
};

export function frictionColumns(item: BatchFriction): FrictionColumns {
  const common = {
    ...NO_FIELDS,
    recordUuid: item.recordId,
    position: item.position,
    at: new Date(item.at),
    kind: item.kind,
  };
  switch (item.kind) {
    case 'tool-error':
      return {
        ...common,
        tool: item.tool,
        category: item.category,
        program: item.program,
        exitCode: item.exitCode,
        commandHash: item.commandHash,
      };
    case 'stop-blocked':
      return { ...common, hookCommand: item.hookCommand };
    case 'compaction':
      return {
        ...common,
        trigger: item.trigger,
        preTokens: item.preTokens,
        postTokens: item.postTokens,
      };
  }
}

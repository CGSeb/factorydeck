import { z } from 'zod';
import { CLOSING_LINE_MAX_LENGTH } from '../ingest/records.ts';

export const AGENTS = ['claude-code', 'codex'] as const;
export type Agent = (typeof AGENTS)[number];

export const MAIN_THREAD = 'main';
export const MB = 1024 * 1024;
export const MAX_BATCH_BYTES = 5 * MB;
export const MAX_DECOMPRESSED_BYTES = 20 * MB;
export const MAX_THREADS = 2000;
export const MAX_RECORDS = 20_000;
export const MAX_ID_LENGTH = 200;
export const MAX_PARSER_VERSION = 2_147_483_647;

export function fileKeyOf(
  agent: string,
  sessionId: string,
  subAgentId: string | null,
): string {
  return `${agent}/${sessionId}/${subAgentId ?? MAIN_THREAD}`;
}

const id = z
  .string()
  .min(1, 'Id is empty')
  .max(MAX_ID_LENGTH, `Id is over ${MAX_ID_LENGTH} characters`)
  .refine((value) => !value.includes('/'), 'Id contains /');

const whole = z.number().int().nonnegative();
const time = z.iso.datetime({
  offset: true,
  message: 'Expected an ISO 8601 time with an offset',
});

const apiCallSchema = z.object({
  requestKey: z.string().min(1, 'Record key is empty'),
  at: time,
  model: z.string(),
  inputTokens: whole,
  cacheWriteTokens: whole,
  cacheReadTokens: whole,
  outputTokens: whole,
});

const recordId = z
  .string()
  .min(1, 'Record id is empty')
  .max(MAX_ID_LENGTH, `Record id is over ${MAX_ID_LENGTH} characters`);

const skillLaunchSchema = z.object({
  recordId,
  at: time,
  skill: z.string().min(1, 'Skill is empty'),
  subAgentId: id.nullable().optional(),
});

const promptSchema = z.object({
  recordId,
  at: time,
  promptId: z.string().nullable().default(null),
  command: z.string().min(1, 'Command is empty').nullable().default(null),
});

const closingLineSchema = z.object({
  recordId,
  at: time,
  position: whole,
  line: z
    .string()
    .min(1, 'Line is empty')
    .max(
      CLOSING_LINE_MAX_LENGTH,
      `Line is over ${CLOSING_LINE_MAX_LENGTH} characters`,
    ),
});

const sessionFieldsSchema = z.object({
  cwd: z.string().nullable().default(null),
  gitBranch: z.string().default(''),
  gitBranches: z.array(z.string()).default([]),
  title: z.string().default(''),
  firstAt: time.nullable().default(null),
  lastAt: time.nullable().default(null),
  turnEnded: z.boolean().default(false),
});

const subAgentFieldsSchema = z.object({
  toolUseId: z.string().default(''),
  agentType: z.string().default(''),
  description: z.string().default(''),
  model: z.string().default(''),
  cwd: z.string().nullable().default(null),
  gitBranch: z.string().default(''),
  firstAt: time.nullable().default(null),
  lastAt: time.nullable().default(null),
});

const threadSchema = z
  .object({
    fileKey: z.string(),
    agent: z.enum(AGENTS),
    sessionId: id,
    subAgentId: id.nullable().default(null),
    remote: z.string().nullable().default(null),
    from: whole,
    readTo: whole,
    session: sessionFieldsSchema.optional(),
    subAgent: subAgentFieldsSchema.optional(),
    apiCalls: z.array(apiCallSchema).default([]),
    skillLaunches: z.array(skillLaunchSchema).default([]),
    prompts: z.array(promptSchema).default([]),
    closingLines: z.array(closingLineSchema).default([]),
  })
  .superRefine((thread, context) => {
    const expected = fileKeyOf(
      thread.agent,
      thread.sessionId,
      thread.subAgentId,
    );
    if (thread.fileKey !== expected) {
      context.addIssue({
        code: 'custom',
        path: ['fileKey'],
        message: `Expected fileKey ${expected}`,
      });
    }
    if (thread.readTo < thread.from) {
      context.addIssue({
        code: 'custom',
        path: ['readTo'],
        message: 'readTo is below from',
      });
    }
    if (thread.subAgentId === null && thread.session === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['session'],
        message: 'A session log needs its session fields',
      });
    }
    if (thread.subAgentId !== null && thread.subAgent === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['subAgent'],
        message: 'A sub-agent log needs its sub-agent fields',
      });
    }
    if (thread.subAgentId !== null) {
      for (const field of ['prompts', 'closingLines'] as const) {
        if (thread[field].length > 0) {
          context.addIssue({
            code: 'custom',
            path: [field],
            message: `A sub-agent log has no ${field === 'prompts' ? 'prompts' : 'closing lines'}`,
          });
        }
      }
    }
    thread.skillLaunches.forEach((launch, index) => {
      if (
        launch.subAgentId !== undefined &&
        launch.subAgentId !== thread.subAgentId
      ) {
        context.addIssue({
          code: 'custom',
          path: ['skillLaunches', index, 'subAgentId'],
          message: 'Expected the subAgentId of the thread',
        });
      }
    });
  });

export const batchSchema = z
  .object({
    parserVersion: z.number().int().positive().max(MAX_PARSER_VERSION),
    threads: z.array(threadSchema),
  })
  .superRefine(({ threads }, context) => {
    const seen = new Set<string>();
    threads.forEach((thread, index) => {
      if (seen.has(thread.fileKey)) {
        context.addIssue({
          code: 'custom',
          path: ['threads', index, 'fileKey'],
          message: `fileKey ${thread.fileKey} is sent twice`,
        });
      }
      seen.add(thread.fileKey);
    });
  });

export type Batch = z.infer<typeof batchSchema>;
export type BatchInput = z.input<typeof batchSchema>;
export type BatchThread = Batch['threads'][number];
export type BatchApiCall = BatchThread['apiCalls'][number];

function recordsOf(thread: BatchThread): number {
  return (
    thread.apiCalls.length +
    thread.skillLaunches.length +
    thread.prompts.length +
    thread.closingLines.length
  );
}

export interface BatchCounts {
  sessions: number;
  threads: number;
  apiCalls: number;
}

export type BatchLimit = 'body' | 'decompressed' | 'threads' | 'records';

export type BatchCheck =
  | { status: 'ok'; batch: Batch }
  | { status: 'invalid'; error: string; path: string }
  | { status: 'too-large'; limit: BatchLimit };

export function checkBatch(value: unknown): BatchCheck {
  const parsed = batchSchema.safeParse(value);
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    return {
      status: 'invalid',
      error: issue?.message ?? 'Invalid batch',
      path: issue?.path.map(String).join('.') ?? '',
    };
  }
  const { threads } = parsed.data;
  if (threads.length > MAX_THREADS) {
    return { status: 'too-large', limit: 'threads' };
  }
  const records = threads.reduce(
    (total, thread) => total + recordsOf(thread),
    0,
  );
  if (records > MAX_RECORDS) return { status: 'too-large', limit: 'records' };
  return { status: 'ok', batch: parsed.data };
}

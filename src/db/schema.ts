import {
  bigint,
  bigserial,
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

/** A session log already read, so the next ingestion resumes where it stopped. */
export const sourceFile = pgTable('source_file', {
  path: text().primaryKey(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  readOffset: bigint('read_offset', { mode: 'number' }).notNull(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Project of a session with no working directory in any record. */
export const UNASSIGNED_PROJECT = 'unassigned';

/** A Claude Code session: the main thread of one `<session id>.jsonl` log. */
export const session = pgTable('session', {
  id: text().primaryKey(),
  /** Root path of the project, or `unassigned`. */
  project: text().notNull().default(UNASSIGNED_PROJECT),
  cwd: text(),
  /** Whether `cwd` comes from the main log; otherwise it comes from a sub-agent log, or is unknown. */
  cwdFromMain: boolean('cwd_from_main').notNull().default(false),
  gitBranch: text('git_branch').notNull().default(''),
  title: text().notNull().default(''),
  firstAt: timestamp('first_at', { withTimezone: true }),
  lastAt: timestamp('last_at', { withTimezone: true }),
  turnEnded: boolean('turn_ended').notNull().default(false),
  /** The three columns below carry the turn state from one incremental run to the next. */
  lastStopReason: text('last_stop_reason'),
  userAfterLastAssistant: boolean('user_after_last_assistant')
    .notNull()
    .default(false),
  lastUserInterrupted: boolean('last_user_interrupted')
    .notNull()
    .default(false),
});

/** A sub-agent started by a session, from `<session id>/subagents/agent-<id>.jsonl`. */
export const subAgent = pgTable(
  'sub_agent',
  {
    sessionId: text('session_id')
      .notNull()
      .references(() => session.id, { onDelete: 'cascade' }),
    id: text().notNull(),
    toolUseId: text('tool_use_id').notNull().default(''),
    agentType: text('agent_type').notNull().default(''),
    description: text().notNull().default(''),
    model: text().notNull().default(''),
    cwd: text(),
    gitBranch: text('git_branch').notNull().default(''),
    firstAt: timestamp('first_at', { withTimezone: true }),
    lastAt: timestamp('last_at', { withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.sessionId, table.id] })],
);

/** One Claude API call, with its token usage as written in the log. */
export const apiCall = pgTable(
  'api_call',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    sourcePath: text('source_path').notNull(),
    requestKey: text('request_key').notNull(),
    sessionId: text('session_id')
      .notNull()
      .references(() => session.id, { onDelete: 'cascade' }),
    subAgentId: text('sub_agent_id'),
    at: timestamp({ withTimezone: true }).notNull(),
    model: text().notNull(),
    inputTokens: bigint('input_tokens', { mode: 'number' }).notNull(),
    cacheWriteTokens: bigint('cache_write_tokens', {
      mode: 'number',
    }).notNull(),
    cacheReadTokens: bigint('cache_read_tokens', { mode: 'number' }).notNull(),
    outputTokens: bigint('output_tokens', { mode: 'number' }).notNull(),
  },
  (table) => [
    unique().on(table.sourcePath, table.requestKey),
    index().on(table.sessionId),
    index().on(table.at),
    foreignKey({
      columns: [table.sessionId, table.subAgentId],
      foreignColumns: [subAgent.sessionId, subAgent.id],
    }).onDelete('cascade'),
  ],
);

/** A skill launched by a `Skill` tool call or typed as a slash command. */
export const skillLaunch = pgTable(
  'skill_launch',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    sourcePath: text('source_path').notNull(),
    recordUuid: text('record_uuid').notNull(),
    sessionId: text('session_id')
      .notNull()
      .references(() => session.id, { onDelete: 'cascade' }),
    subAgentId: text('sub_agent_id'),
    at: timestamp({ withTimezone: true }).notNull(),
    skill: text().notNull(),
  },
  (table) => [
    unique().on(table.sourcePath, table.recordUuid, table.skill),
    index().on(table.sessionId),
    foreignKey({
      columns: [table.sessionId, table.subAgentId],
      foreignColumns: [subAgent.sessionId, subAgent.id],
    }).onDelete('cascade'),
  ],
);

/** A prompt typed by the user in a session's main thread; its text is not stored. */
export const userPrompt = pgTable(
  'user_prompt',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    sourcePath: text('source_path').notNull(),
    recordUuid: text('record_uuid').notNull(),
    sessionId: text('session_id')
      .notNull()
      .references(() => session.id, { onDelete: 'cascade' }),
    at: timestamp({ withTimezone: true }).notNull(),
    promptId: text('prompt_id'),
    /** Name of the slash command the prompt typed, without the `/`. */
    command: text(),
  },
  (table) => [
    unique().on(table.sourcePath, table.recordUuid),
    index().on(table.sessionId, table.promptId),
  ],
);

export const skippedFile = pgTable(
  'skipped_file',
  {
    path: text().primaryKey(),
    sessionId: text('session_id').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    project: text(),
  },
  (table) => [index().on(table.sessionId)],
);

export const ingestState = pgTable('ingest_state', {
  id: text().primaryKey(),
  factoryCleanupDone: boolean('factory_cleanup_done').notNull().default(false),
});

export const gitHostIssue = pgTable(
  'git_host_issue',
  {
    project: text().notNull(),
    number: integer().notNull(),
    title: text().notNull(),
    state: text().notNull(),
    labels: jsonb().$type<{ name: string; color: string | null }[]>().notNull(),
    url: text().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.project, table.number] })],
);

export const gitHostRequest = pgTable(
  'git_host_request',
  {
    project: text().notNull(),
    number: integer().notNull(),
    title: text().notNull(),
    state: text().notNull(),
    draft: boolean().notNull(),
    headBranch: text('head_branch').notNull(),
    url: text().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    mergedAt: timestamp('merged_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    closes: jsonb().$type<number[]>().notNull(),
    checks: text().notNull(),
  },
  (table) => [primaryKey({ columns: [table.project, table.number] })],
);

export const gitHostProject = pgTable('git_host_project', {
  project: text().primaryKey(),
  gitHost: text('git_host'),
  repository: text(),
  syncedFrom: timestamp('synced_from', { withTimezone: true }),
  error: text(),
});

export const gitHostRun = pgTable('git_host_run', {
  id: text().primaryKey(),
  finishedAt: timestamp('finished_at', { withTimezone: true }).notNull(),
});

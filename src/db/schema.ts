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
import { UNASSIGNED_PROJECT } from '../projects/label.ts';
import type { StageLabels } from '../git-host/outcome.ts';
import type {
  LabelChange,
  SerenityReport,
  StateEvent,
} from '../git-host/types.ts';

/** A session log already read, so the next ingestion resumes where it stopped. */
export const sourceFile = pgTable('source_file', {
  path: text().primaryKey(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  readOffset: bigint('read_offset', { mode: 'number' }).notNull(),
  readerState: jsonb('reader_state').$type<Record<string, unknown>>(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export { UNASSIGNED_PROJECT };

/** A coding agent session: the main thread of one session log. */
export const session = pgTable('session', {
  id: text().primaryKey(),
  agent: text().notNull().default('claude-code'),
  /** Root path of the project, or `unassigned`. */
  project: text().notNull().default(UNASSIGNED_PROJECT),
  cwd: text(),
  /** Whether `cwd` comes from the main log; otherwise it comes from a sub-agent log, or is unknown. */
  cwdFromMain: boolean('cwd_from_main').notNull().default(false),
  gitBranch: text('git_branch').notNull().default(''),
  /** Every git branch of the main thread, in the order it first appeared. */
  gitBranches: text('git_branches').array().notNull().default([]),
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

export const closingLine = pgTable(
  'closing_line',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    sourcePath: text('source_path').notNull(),
    recordUuid: text('record_uuid').notNull(),
    sessionId: text('session_id')
      .notNull()
      .references(() => session.id, { onDelete: 'cascade' }),
    at: timestamp({ withTimezone: true }).notNull(),
    position: bigint({ mode: 'number' }).notNull(),
    line: text().notNull(),
  },
  (table) => [
    unique().on(table.sourcePath, table.recordUuid),
    index().on(table.sessionId),
  ],
);

export const friction = pgTable(
  'friction',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    sourcePath: text('source_path').notNull(),
    recordUuid: text('record_uuid').notNull(),
    position: integer().notNull(),
    sessionId: text('session_id')
      .notNull()
      .references(() => session.id, { onDelete: 'cascade' }),
    subAgentId: text('sub_agent_id'),
    at: timestamp({ withTimezone: true }).notNull(),
    agent: text().notNull(),
    kind: text().notNull(),
    tool: text(),
    category: text(),
    program: text(),
    exitCode: integer('exit_code'),
    commandHash: text('command_hash'),
    hookCommand: text('hook_command'),
    trigger: text(),
    preTokens: bigint('pre_tokens', { mode: 'number' }),
    postTokens: bigint('post_tokens', { mode: 'number' }),
  },
  (table) => [
    unique().on(table.sourcePath, table.recordUuid, table.kind, table.position),
    index().on(table.sessionId),
    index().on(table.at),
    foreignKey({
      columns: [table.sessionId, table.subAgentId],
      foreignColumns: [subAgent.sessionId, subAgent.id],
    }).onDelete('cascade'),
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
  branchesReadDone: boolean('branches_read_done').notNull().default(false),
  frictionsReadDone: boolean('frictions_read_done').notNull().default(false),
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
    reopened: boolean().notNull().default(false),
    stateEvents: jsonb('state_events')
      .$type<StateEvent[]>()
      .notNull()
      .default([]),
    needsSpec: jsonb('needs_spec').$type<LabelChange[]>().notNull().default([]),
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
    report: jsonb().$type<SerenityReport>(),
    reports: jsonb().$type<SerenityReport[]>().notNull().default([]),
  },
  (table) => [primaryKey({ columns: [table.project, table.number] })],
);

export const gitHostProject = pgTable('git_host_project', {
  project: text().primaryKey(),
  gitHost: text('git_host'),
  repository: text(),
  syncedFrom: timestamp('synced_from', { withTimezone: true }),
  error: text(),
  errorGitHost: text('error_git_host'),
  stageLabels: jsonb('stage_labels').$type<StageLabels>(),
  autoMerge: boolean('auto_merge'),
  bugLabel: text('bug_label'),
  historyRead: boolean('history_read').notNull().default(false),
  fixRead: boolean('fix_read').notNull().default(false),
  stateEventsRead: boolean('state_events_read').notNull().default(false),
  bodyClosesRead: boolean('body_closes_read').notNull().default(false),
});

export const gitHostRun = pgTable('git_host_run', {
  id: text().primaryKey(),
  finishedAt: timestamp('finished_at', { withTimezone: true }).notNull(),
});

export const projectName = pgTable('project_name', {
  project: text().primaryKey(),
  name: text().notNull(),
});

export interface ReportFilters {
  kind: string | null;
  role: string | null;
  session: string | null;
  issue: number | null;
}

export interface ReportedGroup {
  key: string;
  frictions: number;
}

export const markedReport = pgTable(
  'friction_report',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    project: text().notNull(),
    reportedAt: timestamp('reported_at', { withTimezone: true }).notNull(),
    period: text().notNull(),
    filters: jsonb().$type<ReportFilters>().notNull(),
    groups: jsonb().$type<ReportedGroup[]>().notNull(),
  },
  (table) => [index().on(table.project, table.reportedAt)],
);

export {
  account,
  accountToken,
  cliConnection,
  signInSession,
} from './auth-schema.ts';
export { project } from './project-schema.ts';

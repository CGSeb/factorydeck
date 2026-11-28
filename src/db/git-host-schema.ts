import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  pgView,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import type { StageLabels } from '../git-host/outcome.ts';
import type {
  LabelChange,
  SerenityReport,
  StateEvent,
} from '../git-host/types.ts';

const issueColumns = () => ({
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
});

export const gitHostIssue = pgTable(
  'git_host_issue',
  issueColumns(),
  (table) => [primaryKey({ columns: [table.project, table.number] })],
);

const requestColumns = () => ({
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
});

export const gitHostRequest = pgTable(
  'git_host_request',
  requestColumns(),
  (table) => [primaryKey({ columns: [table.project, table.number] })],
);

const gitHostSettingColumns = () => ({
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

export const gitHostProject = pgTable('git_host_project', {
  project: text().primaryKey(),
  ...gitHostSettingColumns(),
});

export const gitHostRun = pgTable('git_host_run', {
  id: text().primaryKey(),
  finishedAt: timestamp('finished_at', { withTimezone: true }).notNull(),
});

const CHOSEN_GIT_HOST = sql.raw(
  '(select distinct on (p.slug) p.slug as project, g.project as root from git_host_project g join root_remote r on r.root = g.project join project p on p.remote = r.remote order by p.slug, g.synced_from desc nulls last, g.project) h',
);

export const projectGitHost = pgView('project_git_host', {
  project: text().notNull(),
  root: text().notNull(),
  ...gitHostSettingColumns(),
}).as(
  sql`select h.project, h.root, g.git_host, g.repository, g.synced_from, g.error, g.error_git_host, g.stage_labels, g.auto_merge, g.bug_label, g.history_read, g.fix_read, g.state_events_read, g.body_closes_read from git_host_project g join ${CHOSEN_GIT_HOST} on h.root = g.project`,
);

export const projectIssue = pgView('project_issue', issueColumns()).as(
  sql`select h.project, i.number, i.title, i.state, i.labels, i.url, i.created_at, i.closed_at, i.updated_at, i.reopened, i.state_events, i.needs_spec from git_host_issue i join ${CHOSEN_GIT_HOST} on h.root = i.project`,
);

export const projectRequest = pgView('project_request', requestColumns()).as(
  sql`select h.project, q.number, q.title, q.state, q.draft, q.head_branch, q.url, q.created_at, q.merged_at, q.closed_at, q.updated_at, q.closes, q.checks, q.report, q.reports from git_host_request q join ${CHOSEN_GIT_HOST} on h.root = q.project`,
);

import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  integer,
  pgView,
  bigserial,
  pgTable,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { account } from './auth-schema.ts';

export const project = pgTable('project', {
  id: bigserial({ mode: 'number' }).primaryKey(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  remote: text().notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  createdBy: bigint('created_by', { mode: 'number' }).references(
    () => account.id,
    { onDelete: 'set null' },
  ),
});

export const projectRule = pgTable(
  'project_rule',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    projectId: bigint('project_id', { mode: 'number' })
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    kind: text().notNull(),
    position: integer().notNull(),
    name: text(),
    description: text(),
    agentType: text('agent_type'),
    source: text(),
    pattern: text(),
  },
  (table) => [
    unique().on(table.projectId, table.kind, table.position),
    check('project_rule_kind', sql`${table.kind} in ('role', 'work_item')`),
    check('project_rule_position', sql`${table.position} >= 0`),
    check(
      'project_rule_role',
      sql`${table.kind} <> 'role' or ${table.name} is not null`,
    ),
    check(
      'project_rule_work_item',
      sql`${table.kind} <> 'work_item' or (${table.source} is not null and ${table.pattern} is not null)`,
    ),
  ],
);
export const removedSession = pgTable('removed_session', {
  sessionId: text('session_id').primaryKey(),
  projectName: text('project_name').notNull(),
  removedAt: timestamp('removed_at', { withTimezone: true }).notNull(),
});

export const rootRemote = pgTable('root_remote', {
  root: text().primaryKey(),
  remote: text().notNull(),
});

const ROOT_PROJECT = sql.raw(
  'root_remote r join project p on p.remote = r.remote',
);

export const projectRoot = pgView('project_root', {
  root: text().notNull(),
  project: text().notNull(),
}).as(sql`select r.root, p.slug as project from ${ROOT_PROJECT}`);

export const projectSession = pgView('project_session', {
  id: text().notNull(),
  agent: text().notNull(),
  project: text().notNull(),
  root: text().notNull(),
  cwd: text(),
  cwdFromMain: boolean('cwd_from_main').notNull(),
  gitBranch: text('git_branch').notNull(),
  gitBranches: text('git_branches').array().notNull(),
  title: text().notNull(),
  firstAt: timestamp('first_at', { withTimezone: true }),
  lastAt: timestamp('last_at', { withTimezone: true }),
  turnEnded: boolean('turn_ended').notNull(),
}).as(
  sql`select s.id, s.agent, p.slug as project, s.project as root, s.cwd, s.cwd_from_main, s.git_branch, s.git_branches, s.title, s.first_at, s.last_at, s.turn_ended from session s left join root_remote r on r.root = s.project join project p on p.remote = coalesce(r.remote, s.remote)`,
);

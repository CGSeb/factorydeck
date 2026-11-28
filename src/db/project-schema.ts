import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  pgView,
  bigserial,
  pgTable,
  text,
  timestamp,
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

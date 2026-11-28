import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const account = pgTable(
  'account',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    email: text().notNull().unique(),
    name: text().notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text().$type<'manager' | 'dev'>().notNull(),
    active: boolean().notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    lastSignInAt: timestamp('last_sign_in_at', { withTimezone: true }),
  },
  (table) => [
    check('account_role_check', sql`${table.role} in ('manager', 'dev')`),
  ],
);

export const signInSession = pgTable(
  'sign_in_session',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    accountId: bigint('account_id', { mode: 'number' })
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull(),
  },
  (table) => [index().on(table.accountId)],
);

export const accountToken = pgTable(
  'account_token',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    kind: text().$type<'invitation' | 'reset'>().notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    email: text(),
    role: text().$type<'manager' | 'dev'>(),
    accountId: bigint('account_id', { mode: 'number' }).references(
      () => account.id,
      { onDelete: 'cascade' },
    ),
    createdBy: bigint('created_by', { mode: 'number' }).references(
      () => account.id,
      { onDelete: 'set null' },
    ),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'account_token_kind_check',
      sql`${table.kind} in ('invitation', 'reset')`,
    ),
    check(
      'account_token_role_check',
      sql`${table.role} is null or ${table.role} in ('manager', 'dev')`,
    ),
  ],
);

export const cliConnection = pgTable(
  'cli_connection',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    accountId: bigint('account_id', { mode: 'number' })
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    machine: text().notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull(),
  },
  (table) => [index().on(table.accountId)],
);

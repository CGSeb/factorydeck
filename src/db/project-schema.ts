import {
  bigint,
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

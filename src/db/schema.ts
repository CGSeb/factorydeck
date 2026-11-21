import { bigint, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/** A session log already read, so the next ingestion resumes where it stopped. */
export const sourceFile = pgTable('source_file', {
  path: text().primaryKey(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  readOffset: bigint('read_offset', { mode: 'number' }).notNull(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

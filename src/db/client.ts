import { type NodePgDatabase, drizzle } from 'drizzle-orm/node-postgres';
import type { PgAsyncDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import pg from 'pg';

/** Opens a connection pool on the FactoryDeck database; call `close` when done. */
export function createDatabase(url: string): {
  db: NodePgDatabase;
  close: () => Promise<void>;
} {
  const pool = new pg.Pool({ connectionString: url });
  return { db: drizzle({ client: pool }), close: () => pool.end() };
}

/** A FactoryDeck database, whatever the PostgreSQL driver. */
export type Database = PgAsyncDatabase<PgQueryResultHKT>;

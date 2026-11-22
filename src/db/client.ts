import { type NodePgDatabase, drizzle } from 'drizzle-orm/node-postgres';
import type { PgAsyncDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import pg from 'pg';

/** How long opening a connection may take before it fails; queries themselves have no time limit. */
export const CONNECTION_TIMEOUT_MS = 3000;

/**
 * Opens a connection pool on the FactoryDeck database; call `close` when done.
 * @param maxConnections The most connections the pool keeps open; `pg` defaults to 10.
 */
export function createDatabase(
  url: string,
  connectionTimeoutMs: number = CONNECTION_TIMEOUT_MS,
  maxConnections?: number,
): {
  db: NodePgDatabase;
  pool: pg.Pool;
  close: () => Promise<void>;
} {
  const pool = new pg.Pool({
    connectionString: url,
    connectionTimeoutMillis: connectionTimeoutMs,
    ...(maxConnections === undefined ? {} : { max: maxConnections }),
  });
  // An idle client losing its connection must not crash the process: the next query reports it.
  pool.on('error', () => undefined);
  return { db: drizzle({ client: pool }), pool, close: () => pool.end() };
}

/** A FactoryDeck database, whatever the PostgreSQL driver. */
export type Database = PgAsyncDatabase<PgQueryResultHKT>;

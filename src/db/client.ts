import { type NodePgDatabase, drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

/** How long a connection or a query may wait for the database before failing. */
export const DATABASE_TIMEOUT_MS = 3000;

/** Opens a connection pool on the FactoryDeck database; call `close` when done. */
export function createDatabase(
  url: string,
  timeoutMs: number = DATABASE_TIMEOUT_MS,
): {
  db: NodePgDatabase;
  pool: pg.Pool;
  close: () => Promise<void>;
} {
  const pool = new pg.Pool({
    connectionString: url,
    connectionTimeoutMillis: timeoutMs,
    query_timeout: timeoutMs,
  });
  // An idle client losing its connection must not crash the process: the next query reports it.
  pool.on('error', () => undefined);
  return { db: drizzle({ client: pool }), pool, close: () => pool.end() };
}

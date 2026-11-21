import { type NodePgDatabase, drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

/** Opens a connection pool on the FactoryDeck database; call `close` when done. */
export function createDatabase(url: string): {
  db: NodePgDatabase;
  pool: pg.Pool;
  close: () => Promise<void>;
} {
  const pool = new pg.Pool({
    connectionString: url,
    connectionTimeoutMillis: 3000,
  });
  // An idle client losing its connection must not crash the process: the next query reports it.
  pool.on('error', () => undefined);
  return { db: drizzle({ client: pool }), pool, close: () => pool.end() };
}

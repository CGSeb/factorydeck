import { setTimeout as delay } from 'node:timers/promises';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_TIMEOUT_MS } from '../db/client.ts';

/** Resolves `true` when the database answers, `false` otherwise; never rejects. */
export type DatabaseCheck = () => Promise<boolean>;

/** Checks the database with a trivial query, counting no answer within `timeoutMs` as a failure. */
export function databaseCheck(
  db: NodePgDatabase,
  timeoutMs: number = DATABASE_TIMEOUT_MS,
): DatabaseCheck {
  return async () => {
    const timeout = new AbortController();
    const answered = db.execute(sql`select 1`).then(
      () => true,
      () => false,
    );
    const timedOut = delay(timeoutMs, false, { signal: timeout.signal }).catch(
      () => false,
    );
    try {
      return await Promise.race([answered, timedOut]);
    } finally {
      timeout.abort();
    }
  };
}

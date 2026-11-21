import { setTimeout as delay } from 'node:timers/promises';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

/** How long the health check waits for the database before reporting it unreachable. */
export const HEALTH_TIMEOUT_MS = 3000;

/** Resolves `true` when the database answers, `false` otherwise; never rejects. */
export type DatabaseCheck = () => Promise<boolean>;

/** Checks the database with a trivial query, counting no answer within `timeoutMs` as a failure. */
export function databaseCheck(
  db: Pick<NodePgDatabase, 'execute'>,
  timeoutMs: number = HEALTH_TIMEOUT_MS,
): DatabaseCheck {
  let pending: Promise<boolean> | undefined;
  return async () => {
    pending ??= db
      .execute(sql`select 1`)
      .then(
        () => true,
        () => false,
      )
      .finally(() => {
        pending = undefined;
      });
    const timeout = new AbortController();
    const timedOut = delay(timeoutMs, false, { signal: timeout.signal }).catch(
      () => false,
    );
    try {
      return await Promise.race([pending, timedOut]);
    } finally {
      timeout.abort();
    }
  };
}

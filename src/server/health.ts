import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

/** Resolves `true` when the database answers, `false` otherwise; never rejects. */
export type DatabaseCheck = () => Promise<boolean>;

/** Checks the database with a trivial query. */
export function databaseCheck(db: NodePgDatabase): DatabaseCheck {
  return async () => {
    try {
      await db.execute(sql`select 1`);
      return true;
    } catch {
      return false;
    }
  };
}

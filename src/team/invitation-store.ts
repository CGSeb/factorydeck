import { type SQL, and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { account, accountToken } from '../db/schema.ts';

const EMAIL_LOCK = 1_990_001;

export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
export type Queryable = Database | Transaction;

export function pending(at: Date): SQL | undefined {
  return and(
    eq(accountToken.kind, 'invitation'),
    isNull(accountToken.usedAt),
    gt(accountToken.expiresAt, at),
  );
}

export async function lockEmail(tx: Transaction, email: string): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(${EMAIL_LOCK}, hashtext(${email}))`,
  );
}

export async function hasAccount(
  db: Queryable,
  email: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: account.id })
    .from(account)
    .where(eq(account.email, email))
    .limit(1);
  return rows.length > 0;
}

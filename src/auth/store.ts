import { sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { account, signInSession } from '../db/schema.ts';
import type { Account } from './types.ts';

const FIRST_ACCOUNT_LOCK = 1_920_001;

export async function hasAccount(db: Database): Promise<boolean> {
  const rows = await db.select({ id: account.id }).from(account).limit(1);
  return rows.length > 0;
}

export interface FirstAccount {
  email: string;
  name: string;
  passwordHash: string;
  sessionTokenHash: string;
  now: Date;
}

export async function createFirstAccount(
  db: Database,
  first: FirstAccount,
): Promise<Account | undefined> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${FIRST_ACCOUNT_LOCK})`);
    if (await hasAccount(tx)) return undefined;
    const [created] = await tx
      .insert(account)
      .values({
        email: first.email,
        name: first.name,
        passwordHash: first.passwordHash,
        role: 'manager',
        createdAt: first.now,
        lastSignInAt: first.now,
      })
      .returning({
        id: account.id,
        email: account.email,
        name: account.name,
        role: account.role,
      });
    if (created === undefined) throw new Error('Account not created');
    await tx.insert(signInSession).values({
      accountId: created.id,
      tokenHash: first.sessionTokenHash,
      createdAt: first.now,
      lastUsedAt: first.now,
    });
    return created;
  });
}

import { eq, sql } from 'drizzle-orm';
import { CONNECTION_LIFETIME_MS } from '../cli-login/connections.ts';
import type { Database } from '../db/client.ts';
import { account, cliConnection } from '../db/schema.ts';
import type { TeamAccount } from './types.ts';

type Reader = Pick<Database, 'select'>;

export function liveSince(now: Date): Date {
  return new Date(now.getTime() - CONNECTION_LIFETIME_MS);
}

function teamColumns(now: Date) {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    active: account.active,
    lastSignInAt: account.lastSignInAt,
    cliConnections:
      sql<number>`(select count(*) from ${cliConnection} where ${cliConnection.accountId} = ${account.id} and ${cliConnection.lastUsedAt} > ${liveSince(now).toISOString()}::timestamptz)`.mapWith(
        Number,
      ),
  };
}

export async function teamRows(
  db: Reader,
  now: Date,
  id?: number,
): Promise<TeamAccount[]> {
  const query = db.select(teamColumns(now)).from(account);
  const rows = await (id === undefined
    ? query
    : query.where(eq(account.id, id)));
  return rows.map((row) => ({
    ...row,
    lastSignInAt: row.lastSignInAt?.toISOString() ?? null,
  }));
}

export async function teamAccountRow(
  db: Reader,
  id: number,
  now: Date,
): Promise<TeamAccount | undefined> {
  const [row] = await teamRows(db, now, id);
  return row;
}

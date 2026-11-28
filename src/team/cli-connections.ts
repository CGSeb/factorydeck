import { and, desc, eq, gt } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { account, cliConnection } from '../db/schema.ts';
import { liveSince } from './team-columns.ts';
import type { TeamCliConnection } from './types.ts';

export interface TeamCliConnections {
  list: (accountId: number) => Promise<TeamCliConnection[] | undefined>;
  disconnect: (accountId: number, connectionId: number) => Promise<boolean>;
}

async function list(
  db: Database,
  accountId: number,
  now: Date,
): Promise<TeamCliConnection[] | undefined> {
  const [found] = await db
    .select({ id: account.id })
    .from(account)
    .where(eq(account.id, accountId));
  if (found === undefined) return undefined;
  const rows = await db
    .select({
      id: cliConnection.id,
      machine: cliConnection.machine,
      createdAt: cliConnection.createdAt,
      lastUsedAt: cliConnection.lastUsedAt,
    })
    .from(cliConnection)
    .where(
      and(
        eq(cliConnection.accountId, accountId),
        gt(cliConnection.lastUsedAt, liveSince(now)),
      ),
    )
    .orderBy(desc(cliConnection.lastUsedAt), desc(cliConnection.id));
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt.toISOString(),
  }));
}

async function disconnect(
  db: Database,
  accountId: number,
  connectionId: number,
  now: Date,
): Promise<boolean> {
  const deleted = await db
    .delete(cliConnection)
    .where(
      and(
        eq(cliConnection.id, connectionId),
        eq(cliConnection.accountId, accountId),
        gt(cliConnection.lastUsedAt, liveSince(now)),
      ),
    )
    .returning({ id: cliConnection.id });
  return deleted.length > 0;
}

export function teamCliConnections(
  db: Database,
  now: () => Date = () => new Date(),
): TeamCliConnections {
  return {
    list: (accountId) => list(db, accountId, now()),
    disconnect: (accountId, connectionId) =>
      disconnect(db, accountId, connectionId, now()),
  };
}

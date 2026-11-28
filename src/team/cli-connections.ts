import { eq } from 'drizzle-orm';
import type { CliConnections } from '../cli-login/connections.ts';
import type { Database } from '../db/client.ts';
import { account } from '../db/schema.ts';
import type { TeamCliConnection } from './types.ts';

export interface TeamCliConnections {
  list: (accountId: number) => Promise<TeamCliConnection[] | undefined>;
  disconnect: (accountId: number, connectionId: number) => Promise<boolean>;
}

type AccountConnections = Pick<CliConnections, 'list' | 'remove'>;

async function hasAccount(db: Database, accountId: number): Promise<boolean> {
  const [found] = await db
    .select({ id: account.id })
    .from(account)
    .where(eq(account.id, accountId));
  return found !== undefined;
}

export function teamCliConnections(
  db: Database,
  connections: AccountConnections,
): TeamCliConnections {
  return {
    list: async (accountId) =>
      (await hasAccount(db, accountId))
        ? connections.list(accountId)
        : undefined,
    disconnect: async (accountId, connectionId) => {
      const live = await connections.list(accountId);
      if (!live.some(({ id }) => id === connectionId)) return false;
      return connections.remove(accountId, connectionId);
    },
  };
}

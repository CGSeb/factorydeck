import { randomBytes } from 'node:crypto';
import { and, eq, lte } from 'drizzle-orm';
import { hashToken } from '../auth/secrets.ts';
import type { Account } from '../auth/types.ts';
import type { Database } from '../db/client.ts';
import { account, cliConnection } from '../db/schema.ts';

export const CONNECTION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const LAST_USE_STEP_MS = 60 * 1000;
const TOKEN_BYTES = 32;
const TOKEN_PREFIX = 'fdk_';

export interface CliSignedIn {
  account: Account;
  connectionId: number;
  machine: string;
}

export interface Connected {
  token: string;
  account: Account;
}

export interface CliConnections {
  connect: (
    accountId: number,
    machine: string,
  ) => Promise<Connected | undefined>;
  authenticate: (token: string | undefined) => Promise<CliSignedIn | undefined>;
  disconnect: (connectionId: number) => Promise<void>;
}

const accountColumns = {
  id: account.id,
  email: account.email,
  name: account.name,
  role: account.role,
};

export function newCliToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(TOKEN_BYTES).toString('base64url')}`;
}

async function connect(
  db: Database,
  accountId: number,
  machine: string,
  at: Date,
): Promise<Connected | undefined> {
  return db.transaction(async (tx): Promise<Connected | undefined> => {
    const [found] = await tx
      .select({ ...accountColumns, active: account.active })
      .from(account)
      .where(eq(account.id, accountId))
      .for('update');
    if (found === undefined || !found.active) return undefined;
    const token = newCliToken();
    await tx.insert(cliConnection).values({
      accountId,
      machine,
      tokenHash: hashToken(token),
      createdAt: at,
      lastUsedAt: at,
    });
    const { id, email, name, role } = found;
    return { token, account: { id, email, name, role } };
  });
}

async function touch(db: Database, connectionId: number, at: Date) {
  await db
    .update(cliConnection)
    .set({ lastUsedAt: at })
    .where(
      and(
        eq(cliConnection.id, connectionId),
        lte(
          cliConnection.lastUsedAt,
          new Date(at.getTime() - LAST_USE_STEP_MS),
        ),
      ),
    );
}

async function authenticate(
  db: Database,
  token: string | undefined,
  at: Date,
): Promise<CliSignedIn | undefined> {
  if (token === undefined || token === '') return undefined;
  const [found] = await db
    .select({
      ...accountColumns,
      active: account.active,
      connectionId: cliConnection.id,
      machine: cliConnection.machine,
      lastUsedAt: cliConnection.lastUsedAt,
    })
    .from(cliConnection)
    .innerJoin(account, eq(account.id, cliConnection.accountId))
    .where(eq(cliConnection.tokenHash, hashToken(token)));
  if (found === undefined) return undefined;
  const idle = at.getTime() - found.lastUsedAt.getTime();
  if (idle >= CONNECTION_LIFETIME_MS) {
    await disconnect(db, found.connectionId);
    return undefined;
  }
  if (!found.active) return undefined;
  if (idle >= LAST_USE_STEP_MS) await touch(db, found.connectionId, at);
  const { id, email, name, role, connectionId, machine } = found;
  return { account: { id, email, name, role }, connectionId, machine };
}

async function disconnect(db: Database, connectionId: number): Promise<void> {
  await db.delete(cliConnection).where(eq(cliConnection.id, connectionId));
}

export function cliConnections(
  db: Database,
  now: () => Date = () => new Date(),
): CliConnections {
  return {
    connect: (accountId, machine) => connect(db, accountId, machine, now()),
    authenticate: (token) => authenticate(db, token, now()),
    disconnect: (connectionId) => disconnect(db, connectionId),
  };
}

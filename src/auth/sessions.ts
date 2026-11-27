import { and, eq, lte } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { account, signInSession } from '../db/schema.ts';
import {
  hashPassword,
  hashToken,
  newSessionToken,
  verifyPassword,
} from './secrets.ts';
import type { Account } from './types.ts';

export const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const LAST_USE_STEP_MS = 60 * 1000;
const UNKNOWN_ACCOUNT_PASSWORD = 'no account has this password';

export type SignInResult =
  | { status: 'signed-in'; account: Account; sessionToken: string }
  | { status: 'wrong' };

export interface SignInSessions {
  signIn: (body: Record<string, unknown>) => Promise<SignInResult>;
  authenticate: (token: string | undefined) => Promise<Account | undefined>;
  signOut: (token: string | undefined) => Promise<void>;
}

export interface SignInOptions {
  now?: () => Date;
}

const accountColumns = {
  id: account.id,
  email: account.email,
  name: account.name,
  role: account.role,
};

let unknownAccountHash: Promise<string> | undefined;

async function wastePasswordCheck(password: string): Promise<void> {
  unknownAccountHash ??= hashPassword(UNKNOWN_ACCOUNT_PASSWORD);
  await verifyPassword(password, await unknownAccountHash);
}

async function openSession(
  db: Database,
  accountId: number,
  at: Date,
): Promise<string> {
  const sessionToken = newSessionToken();
  await db.transaction(async (tx) => {
    await tx.insert(signInSession).values({
      accountId,
      tokenHash: hashToken(sessionToken),
      createdAt: at,
      lastUsedAt: at,
    });
    await tx
      .update(account)
      .set({ lastSignInAt: at })
      .where(eq(account.id, accountId));
  });
  return sessionToken;
}

async function signIn(
  db: Database,
  { email, password }: Record<string, unknown>,
  at: Date,
): Promise<SignInResult> {
  if (typeof email !== 'string' || typeof password !== 'string') {
    return { status: 'wrong' };
  }
  const [found] = await db
    .select({
      ...accountColumns,
      active: account.active,
      hash: account.passwordHash,
    })
    .from(account)
    .where(eq(account.email, email.trim().toLowerCase()));
  if (found === undefined) {
    await wastePasswordCheck(password);
    return { status: 'wrong' };
  }
  if (!(await verifyPassword(password, found.hash)) || !found.active) {
    return { status: 'wrong' };
  }
  const { id, name, role } = found;
  return {
    status: 'signed-in',
    account: { id, email: found.email, name, role },
    sessionToken: await openSession(db, id, at),
  };
}

async function touch(db: Database, sessionId: number, at: Date) {
  await db
    .update(signInSession)
    .set({ lastUsedAt: at })
    .where(
      and(
        eq(signInSession.id, sessionId),
        lte(
          signInSession.lastUsedAt,
          new Date(at.getTime() - LAST_USE_STEP_MS),
        ),
      ),
    );
}

async function authenticate(
  db: Database,
  token: string | undefined,
  at: Date,
): Promise<Account | undefined> {
  if (token === undefined || token === '') return undefined;
  const [found] = await db
    .select({
      ...accountColumns,
      active: account.active,
      sessionId: signInSession.id,
      lastUsedAt: signInSession.lastUsedAt,
    })
    .from(signInSession)
    .innerJoin(account, eq(account.id, signInSession.accountId))
    .where(eq(signInSession.tokenHash, hashToken(token)));
  if (found === undefined) return undefined;
  const idle = at.getTime() - found.lastUsedAt.getTime();
  if (idle >= SESSION_LIFETIME_MS || !found.active) {
    await db.delete(signInSession).where(eq(signInSession.id, found.sessionId));
    return undefined;
  }
  if (idle >= LAST_USE_STEP_MS) await touch(db, found.sessionId, at);
  const { id, email, name, role } = found;
  return { id, email, name, role };
}

async function signOut(db: Database, token: string | undefined) {
  if (token === undefined || token === '') return;
  await db
    .delete(signInSession)
    .where(eq(signInSession.tokenHash, hashToken(token)));
}

export function signInSessions(
  db: Database,
  options: SignInOptions = {},
): SignInSessions {
  const now = options.now ?? (() => new Date());
  return {
    signIn: (body) => signIn(db, body, now()),
    authenticate: (token) => authenticate(db, token, now()),
    signOut: (token) => signOut(db, token),
  };
}

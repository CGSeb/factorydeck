import { and, eq, gt, isNull } from 'drizzle-orm';
import { passwordError } from '../auth/fields.ts';
import { hashPassword, hashToken, newSessionToken } from '../auth/secrets.ts';
import type { Account } from '../auth/types.ts';
import type { Database } from '../db/client.ts';
import { account, accountToken, signInSession } from '../db/schema.ts';

export const RESET_LINK_LIFETIME_MS = 24 * 60 * 60 * 1000;
export const OWN_RESET = 'You cannot reset your own password here';
export const DEACTIVATED = 'This account is deactivated';
export const LINK_GONE =
  'This link no longer works. Ask a manager for a new one.';

export interface ResetLinkRequest {
  accountId: number;
  createdBy: number | null;
}

export type ResetLinkOutcome =
  | { status: 'created'; token: string; expiresAt: Date }
  | { status: 'not-found' }
  | { status: 'conflict'; error: string };

export type ResetReadOutcome =
  { status: 'ok'; email: string } | { status: 'gone' };

export type ResetSaveOutcome =
  | { status: 'saved'; account: Account; sessionToken: string }
  | { status: 'gone' }
  | { status: 'invalid'; error: string; field: 'password' };

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

const RESET = 'reset';

function liveReset(tokenHash: string, now: Date) {
  return and(
    eq(accountToken.kind, RESET),
    eq(accountToken.tokenHash, tokenHash),
    isNull(accountToken.usedAt),
    gt(accountToken.expiresAt, now),
  );
}

function lockAccount(tx: Transaction, id: number) {
  return tx
    .select({
      id: account.id,
      email: account.email,
      name: account.name,
      role: account.role,
      active: account.active,
    })
    .from(account)
    .where(eq(account.id, id))
    .for('update')
    .then(([row]) => row);
}

export function createResetLink(
  db: Database,
  { accountId, createdBy }: ResetLinkRequest,
  now: Date,
): Promise<ResetLinkOutcome> {
  return db.transaction(async (tx): Promise<ResetLinkOutcome> => {
    const target = await lockAccount(tx, accountId);
    if (target === undefined) return { status: 'not-found' };
    if (target.id === createdBy)
      return { status: 'conflict', error: OWN_RESET };
    if (!target.active) return { status: 'conflict', error: DEACTIVATED };
    await tx
      .delete(accountToken)
      .where(
        and(
          eq(accountToken.kind, RESET),
          eq(accountToken.accountId, target.id),
          isNull(accountToken.usedAt),
          gt(accountToken.expiresAt, now),
        ),
      );
    const token = newSessionToken();
    const expiresAt = new Date(now.getTime() + RESET_LINK_LIFETIME_MS);
    await tx.insert(accountToken).values({
      kind: RESET,
      tokenHash: hashToken(token),
      accountId: target.id,
      createdBy,
      createdAt: now,
      expiresAt,
    });
    return { status: 'created', token, expiresAt };
  });
}

export async function activeAccountId(
  db: Database,
  email: string,
): Promise<number | undefined> {
  const [row] = await db
    .select({ id: account.id })
    .from(account)
    .where(
      and(
        eq(account.email, email.trim().toLowerCase()),
        eq(account.active, true),
      ),
    );
  return row?.id;
}

async function liveResetAccount(
  db: Database,
  token: unknown,
  now: Date,
): Promise<{ accountId: number; email: string } | undefined> {
  if (typeof token !== 'string' || token === '') return undefined;
  const [row] = await db
    .select({ accountId: account.id, email: account.email })
    .from(accountToken)
    .innerJoin(account, eq(account.id, accountToken.accountId))
    .where(and(liveReset(hashToken(token), now), eq(account.active, true)));
  return row;
}

export async function readReset(
  db: Database,
  token: unknown,
  now: Date,
): Promise<ResetReadOutcome> {
  const found = await liveResetAccount(db, token, now);
  return found === undefined
    ? { status: 'gone' }
    : { status: 'ok', email: found.email };
}

export async function saveReset(
  db: Database,
  { token, password }: Record<string, unknown>,
  previousSession: string | undefined,
  now: Date,
): Promise<ResetSaveOutcome> {
  const found = await liveResetAccount(db, token, now);
  if (found === undefined || typeof token !== 'string') {
    return { status: 'gone' };
  }
  const error = passwordError(password);
  if (error !== undefined)
    return { status: 'invalid', error, field: 'password' };
  const passwordHash = await hashPassword(String(password));
  const sessionToken = newSessionToken();
  return db.transaction(async (tx): Promise<ResetSaveOutcome> => {
    const target = await lockAccount(tx, found.accountId);
    if (target === undefined || !target.active) return { status: 'gone' };
    const claimed = await tx
      .update(accountToken)
      .set({ usedAt: now })
      .where(
        and(
          liveReset(hashToken(token), now),
          eq(accountToken.accountId, target.id),
        ),
      )
      .returning({ id: accountToken.id });
    if (claimed.length === 0) return { status: 'gone' };
    await tx
      .update(account)
      .set({ passwordHash, lastSignInAt: now })
      .where(eq(account.id, target.id));
    await tx
      .delete(signInSession)
      .where(eq(signInSession.accountId, target.id));
    if (previousSession !== undefined && previousSession !== '') {
      await tx
        .delete(signInSession)
        .where(eq(signInSession.tokenHash, hashToken(previousSession)));
    }
    await tx.insert(signInSession).values({
      accountId: target.id,
      tokenHash: hashToken(sessionToken),
      createdAt: now,
      lastUsedAt: now,
    });
    const { id, email, name, role } = target;
    return {
      status: 'saved',
      account: { id, email, name, role },
      sessionToken,
    };
  });
}

export interface ResetLinks {
  create: (request: ResetLinkRequest) => Promise<ResetLinkOutcome>;
  read: (token: unknown) => Promise<ResetReadOutcome>;
  save: (
    body: Record<string, unknown>,
    previousSession: string | undefined,
  ) => Promise<ResetSaveOutcome>;
}

export function resetLinks(
  db: Database,
  now: () => Date = () => new Date(),
): ResetLinks {
  return {
    create: (request) => createResetLink(db, request, now()),
    read: (token) => readReset(db, token, now()),
    save: (body, previousSession) =>
      saveReset(db, body, previousSession, now()),
  };
}

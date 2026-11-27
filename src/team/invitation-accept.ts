import { and, eq } from 'drizzle-orm';
import { accountFields } from '../auth/fields.ts';
import { hashPassword, hashToken, newSessionToken } from '../auth/secrets.ts';
import type { Account, FieldError } from '../auth/types.ts';
import type { Database } from '../db/client.ts';
import { account, accountToken, signInSession } from '../db/schema.ts';
import {
  type Queryable,
  hasAccount,
  lockEmail,
  pending,
} from './invitation-store.ts';
import type { NewInvitation } from './invitations.ts';

export type AcceptInvitationResult =
  | { status: 'created'; account: Account; sessionToken: string }
  | { status: 'dead' }
  | ({ status: 'invalid' } & FieldError);

interface PendingToken extends NewInvitation {
  id: number;
}

async function pendingByToken(
  db: Queryable,
  token: unknown,
  at: Date,
): Promise<PendingToken | undefined> {
  if (typeof token !== 'string' || token === '') return undefined;
  const [row] = await db
    .select({
      id: accountToken.id,
      email: accountToken.email,
      role: accountToken.role,
    })
    .from(accountToken)
    .where(and(eq(accountToken.tokenHash, hashToken(token)), pending(at)));
  if (row?.email == null || row.role == null) return undefined;
  if (await hasAccount(db, row.email)) return undefined;
  return { id: row.id, email: row.email, role: row.role };
}

export async function readInvitation(
  db: Database,
  token: unknown,
  at: Date,
): Promise<NewInvitation | undefined> {
  const found = await pendingByToken(db, token, at);
  return found === undefined
    ? undefined
    : { email: found.email, role: found.role };
}

export async function acceptInvitation(
  db: Database,
  body: Record<string, unknown>,
  previousToken: string | undefined,
  at: Date,
): Promise<AcceptInvitationResult> {
  const found = await pendingByToken(db, body['token'], at);
  if (found === undefined) return { status: 'dead' };
  const fields = accountFields({ ...body, email: found.email });
  if (!fields.ok) {
    return { status: 'invalid', error: fields.error, field: fields.field };
  }
  const passwordHash = await hashPassword(fields.value.password);
  const sessionToken = newSessionToken();
  return db.transaction(async (tx): Promise<AcceptInvitationResult> => {
    await lockEmail(tx, found.email);
    const still = await pendingByToken(tx, body['token'], at);
    if (still?.id !== found.id) return { status: 'dead' };
    const [created] = await tx
      .insert(account)
      .values({
        email: still.email,
        name: fields.value.name,
        passwordHash,
        role: still.role,
        createdAt: at,
        lastSignInAt: at,
      })
      .returning({
        id: account.id,
        email: account.email,
        name: account.name,
        role: account.role,
      });
    if (created === undefined) throw new Error('Account not created');
    await tx
      .update(accountToken)
      .set({ usedAt: at, accountId: created.id })
      .where(eq(accountToken.id, still.id));
    if (previousToken !== undefined && previousToken !== '') {
      await tx
        .delete(signInSession)
        .where(eq(signInSession.tokenHash, hashToken(previousToken)));
    }
    await tx.insert(signInSession).values({
      accountId: created.id,
      tokenHash: hashToken(sessionToken),
      createdAt: at,
      lastUsedAt: at,
    });
    return { status: 'created', account: created, sessionToken };
  });
}

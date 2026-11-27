import { and, eq, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { emailError } from '../auth/fields.ts';
import { hashToken, newSessionToken } from '../auth/secrets.ts';
import type { FieldError, Role } from '../auth/types.ts';
import type { Database } from '../db/client.ts';
import { account, accountToken } from '../db/schema.ts';
import {
  type AcceptInvitationResult,
  acceptInvitation,
  readInvitation,
} from './invitation-accept.ts';
import {
  type Queryable,
  type Transaction,
  hasAccount,
  lockEmail,
  pending,
} from './invitation-store.ts';
import {
  ROLE_ERROR,
  type CreatedInvitation,
  type TeamInvitation,
} from './types.ts';

export const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export interface NewInvitation {
  email: string;
  role: Role;
}

export type InvitationFields =
  { ok: true; value: NewInvitation } | ({ ok: false } & FieldError);

export type CreateInvitationResult =
  | { status: 'created'; invitation: CreatedInvitation }
  | { status: 'has-account' };

export type RenewInvitationResult =
  | { status: 'created'; invitation: CreatedInvitation }
  | { status: 'not-found' };

export type { AcceptInvitationResult };

export interface InvitationSource {
  list: () => Promise<TeamInvitation[]>;
  create: (
    invitation: NewInvitation,
    by: number,
  ) => Promise<CreateInvitationResult>;
  renew: (id: number, by: number) => Promise<RenewInvitationResult>;
  revoke: (id: number) => Promise<void>;
  read: (token: unknown) => Promise<NewInvitation | undefined>;
  accept: (
    body: Record<string, unknown>,
    previousToken: string | undefined,
  ) => Promise<AcceptInvitationResult>;
}

export interface InvitationOptions {
  now?: () => Date;
}

function isRole(value: unknown): value is Role {
  return value === 'manager' || value === 'dev';
}

export function invitationFields(
  body: Record<string, unknown>,
): InvitationFields {
  const email = emailError(body['email']);
  if (email !== undefined) return { ok: false, error: email, field: 'email' };
  const role = body['role'];
  if (!isRole(role)) return { ok: false, error: ROLE_ERROR, field: 'role' };
  return {
    ok: true,
    value: { email: String(body['email']).trim().toLowerCase(), role },
  };
}

async function deleteUnused(tx: Transaction, email: string): Promise<void> {
  await tx
    .delete(accountToken)
    .where(
      and(
        eq(accountToken.kind, 'invitation'),
        eq(accountToken.email, email),
        isNull(accountToken.usedAt),
      ),
    );
}

async function insertInvitation(
  tx: Transaction,
  invitation: NewInvitation,
  by: number,
  at: Date,
): Promise<CreatedInvitation> {
  const token = newSessionToken();
  const [row] = await tx
    .insert(accountToken)
    .values({
      kind: 'invitation',
      tokenHash: hashToken(token),
      email: invitation.email,
      role: invitation.role,
      createdBy: by,
      createdAt: at,
      expiresAt: new Date(at.getTime() + INVITATION_LIFETIME_MS),
    })
    .returning({ id: accountToken.id, expiresAt: accountToken.expiresAt });
  if (row === undefined) throw new Error('Invitation not created');
  const [inviter] = await tx
    .select({ name: account.name })
    .from(account)
    .where(eq(account.id, by));
  return {
    id: row.id,
    email: invitation.email,
    role: invitation.role,
    invitedBy: inviter?.name ?? null,
    createdAt: at.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    token,
  };
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  return left > right ? 1 : 0;
}

export async function listInvitations(
  db: Database,
  at: Date,
): Promise<TeamInvitation[]> {
  const inviter = alias(account, 'inviter');
  const rows = await db
    .select({
      id: accountToken.id,
      email: accountToken.email,
      role: accountToken.role,
      invitedBy: inviter.name,
      createdAt: accountToken.createdAt,
      expiresAt: accountToken.expiresAt,
    })
    .from(accountToken)
    .leftJoin(inviter, eq(inviter.id, accountToken.createdBy))
    .where(pending(at));
  return rows
    .map((row) => ({
      id: row.id,
      email: row.email ?? '',
      role: row.role ?? 'dev',
      invitedBy: row.invitedBy,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
    }))
    .sort(
      (left, right) =>
        compareText(left.expiresAt, right.expiresAt) ||
        compareText(left.email, right.email),
    );
}

export function createInvitation(
  db: Database,
  invitation: NewInvitation,
  by: number,
  at: Date,
): Promise<CreateInvitationResult> {
  return db.transaction(async (tx) => {
    await lockEmail(tx, invitation.email);
    if (await hasAccount(tx, invitation.email)) {
      return { status: 'has-account' };
    }
    await deleteUnused(tx, invitation.email);
    return {
      status: 'created',
      invitation: await insertInvitation(tx, invitation, by, at),
    };
  });
}

async function pendingById(
  db: Queryable,
  id: number,
  at: Date,
): Promise<NewInvitation | undefined> {
  const [row] = await db
    .select({ email: accountToken.email, role: accountToken.role })
    .from(accountToken)
    .where(and(eq(accountToken.id, id), pending(at)));
  if (row?.email == null || row.role == null) return undefined;
  return { email: row.email, role: row.role };
}

export async function renewInvitation(
  db: Database,
  id: number,
  by: number,
  at: Date,
): Promise<RenewInvitationResult> {
  const found = await pendingById(db, id, at);
  if (found === undefined) return { status: 'not-found' };
  return db.transaction(async (tx) => {
    await lockEmail(tx, found.email);
    const still = await pendingById(tx, id, at);
    if (still === undefined || (await hasAccount(tx, still.email))) {
      return { status: 'not-found' };
    }
    await deleteUnused(tx, still.email);
    return {
      status: 'created',
      invitation: await insertInvitation(tx, still, by, at),
    };
  });
}

export async function revokeInvitation(
  db: Database,
  id: number,
): Promise<void> {
  const [row] = await db
    .select({ email: accountToken.email })
    .from(accountToken)
    .where(
      and(
        eq(accountToken.id, id),
        eq(accountToken.kind, 'invitation'),
        isNull(accountToken.usedAt),
      ),
    );
  const email = row?.email;
  if (email == null) return;
  await db.transaction(async (tx) => {
    await lockEmail(tx, email);
    await deleteUnused(tx, email);
  });
}

export function invitations(
  db: Database,
  options: InvitationOptions = {},
): InvitationSource {
  const now = options.now ?? (() => new Date());
  return {
    list: () => listInvitations(db, now()),
    create: (invitation, by) => createInvitation(db, invitation, by, now()),
    renew: (id, by) => renewInvitation(db, id, by, now()),
    revoke: (id) => revokeInvitation(db, id),
    read: (token) => readInvitation(db, token, now()),
    accept: (body, previousToken) =>
      acceptInvitation(db, body, previousToken, now()),
  };
}

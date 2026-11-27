import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { account, accountToken, signInSession } from '../db/schema.ts';
import type { ChangeRefusal } from './account-change.ts';
import {
  LAST_MANAGER,
  leavesAnActiveManager,
  lockActiveManagers,
} from './change-role.ts';
import type { TeamAccount } from './types.ts';

export const ACTIVE_INVALID = 'Active must be true or false';
export const OWN_STATUS = 'You cannot deactivate yourself';

export type StatusChangeOutcome =
  | { status: 'changed'; account: TeamAccount }
  | { status: 'signed-out' }
  | { status: 'managers-only' }
  | { status: 'not-found' }
  | { status: 'invalid'; refusal: ChangeRefusal }
  | { status: 'conflict'; error: string };

export interface StatusChangeRequest {
  requesterId: number;
  accountId: number;
  change: { active: boolean } | { refusal: ChangeRefusal };
  now: Date;
}

const teamColumns = {
  id: account.id,
  name: account.name,
  email: account.email,
  role: account.role,
  active: account.active,
  lastSignInAt: account.lastSignInAt,
};

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export function activeChangeOf(
  active: unknown,
): { active: boolean } | { refusal: ChangeRefusal } {
  return typeof active === 'boolean'
    ? { active }
    : { refusal: { error: ACTIVE_INVALID, field: 'active' } };
}

async function accountRow(
  tx: Transaction,
  id: number,
): Promise<TeamAccount | undefined> {
  const [row] = await tx
    .select(teamColumns)
    .from(account)
    .where(eq(account.id, id));
  if (row === undefined) return undefined;
  return { ...row, lastSignInAt: row.lastSignInAt?.toISOString() ?? null };
}

async function deactivate(
  tx: Transaction,
  accountId: number,
  now: Date,
): Promise<void> {
  await tx
    .update(account)
    .set({ active: false })
    .where(eq(account.id, accountId));
  await tx.delete(signInSession).where(eq(signInSession.accountId, accountId));
  await tx
    .update(accountToken)
    .set({ usedAt: now })
    .where(
      and(
        eq(accountToken.kind, 'reset'),
        eq(accountToken.accountId, accountId),
        isNull(accountToken.usedAt),
      ),
    );
}

function statusConflict(
  target: TeamAccount,
  active: boolean,
  requesterId: number,
  activeManagers: readonly number[],
): string | undefined {
  if (active || !target.active) return undefined;
  if (target.id === requesterId) return OWN_STATUS;
  if (
    target.role === 'manager' &&
    !leavesAnActiveManager(activeManagers, target.id)
  ) {
    return LAST_MANAGER;
  }
  return undefined;
}

export function changeStatus(
  db: Database,
  { requesterId, accountId, change, now }: StatusChangeRequest,
): Promise<StatusChangeOutcome> {
  return db.transaction(async (tx): Promise<StatusChangeOutcome> => {
    const activeManagers = await lockActiveManagers(tx);
    const requester = await accountRow(tx, requesterId);
    if (requester === undefined || !requester.active) {
      return { status: 'signed-out' };
    }
    if (requester.role !== 'manager') return { status: 'managers-only' };
    const target = await accountRow(tx, accountId);
    if (target === undefined) return { status: 'not-found' };
    if ('refusal' in change) {
      return { status: 'invalid', refusal: change.refusal };
    }
    const { active } = change;
    const conflict = statusConflict(
      target,
      active,
      requesterId,
      activeManagers,
    );
    if (conflict !== undefined) return { status: 'conflict', error: conflict };
    if (target.active === active) return { status: 'changed', account: target };
    if (active) {
      await tx
        .update(account)
        .set({ active: true })
        .where(eq(account.id, accountId));
    } else {
      await deactivate(tx, accountId, now);
    }
    return { status: 'changed', account: { ...target, active } };
  });
}

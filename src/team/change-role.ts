import { and, eq } from 'drizzle-orm';
import type { Role } from '../auth/types.ts';
import type { Database } from '../db/client.ts';
import { account } from '../db/schema.ts';
import type { ChangeRefusal } from './account-change.ts';
import { teamAccountRow } from './team-columns.ts';
import type { TeamAccount } from './types.ts';

export const LAST_MANAGER = 'The team needs at least one active manager';
export const OWN_ROLE = 'You cannot change your own role';
export const REACTIVATE_FIRST = 'Reactivate this account first';

export interface RoleChangeRequest {
  requesterId: number;
  accountId: number;
  change: { role: Role } | { refusal: ChangeRefusal };
  now?: Date;
}

export type RoleChangeOutcome =
  | { status: 'changed'; account: TeamAccount }
  | { status: 'signed-out' }
  | { status: 'managers-only' }
  | { status: 'not-found' }
  | { status: 'invalid'; refusal: ChangeRefusal }
  | { status: 'conflict'; error: string };

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export function lockActiveManagers(tx: Transaction): Promise<number[]> {
  return tx
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.role, 'manager'), eq(account.active, true)))
    .for('update')
    .then((rows) => rows.map(({ id }) => id));
}

export function leavesAnActiveManager(
  activeManagerIds: readonly number[],
  demotedId: number,
): boolean {
  return activeManagerIds.some((id) => id !== demotedId);
}

export function changeRole(
  db: Database,
  { requesterId, accountId, change, now = new Date() }: RoleChangeRequest,
): Promise<RoleChangeOutcome> {
  return db.transaction(async (tx): Promise<RoleChangeOutcome> => {
    const activeManagers = await lockActiveManagers(tx);
    const requester = await teamAccountRow(tx, requesterId, now);
    if (requester === undefined || !requester.active) {
      return { status: 'signed-out' };
    }
    if (requester.role !== 'manager') return { status: 'managers-only' };
    const target = await teamAccountRow(tx, accountId, now);
    if (target === undefined) return { status: 'not-found' };
    if ('refusal' in change) {
      return { status: 'invalid', refusal: change.refusal };
    }
    if (target.id === requester.id) {
      return { status: 'conflict', error: OWN_ROLE };
    }
    if (!target.active) return { status: 'conflict', error: REACTIVATE_FIRST };
    if (target.role === change.role) {
      return { status: 'changed', account: target };
    }
    if (
      change.role === 'dev' &&
      !leavesAnActiveManager(activeManagers, target.id)
    ) {
      return { status: 'conflict', error: LAST_MANAGER };
    }
    await tx
      .update(account)
      .set({ role: change.role })
      .where(eq(account.id, target.id));
    return { status: 'changed', account: { ...target, role: change.role } };
  });
}

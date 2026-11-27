import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { account } from '../db/schema.ts';
import { START } from '../test/auth-app.ts';
import { h, useHarness, waitForLockWaiter } from '../test/team-status.ts';
import { type StatusChangeOutcome, changeStatus } from './account-status.ts';
import { lockActiveManagers } from './change-role.ts';

useHarness();

async function activeManagers(): Promise<number[]> {
  const rows = await h.db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.role, 'manager'), eq(account.active, true)));
  return rows.map(({ id }) => id);
}

describe('changeStatus', () => {
  it('waits for a demotion holding the active-manager lock, then refuses the demoted requester', async () => {
    const ada = await h.addAccount('ada@example.test', { role: 'manager' });
    const bea = await h.addAccount('bea@example.test', { role: 'manager' });
    let deactivation: Promise<StatusChangeOutcome> | undefined;
    await h.db.transaction(async (tx) => {
      await lockActiveManagers(tx);
      deactivation = changeStatus(h.db, {
        requesterId: bea,
        accountId: ada,
        change: { active: false },
        now: START,
      });
      await waitForLockWaiter(tx);
      await tx.update(account).set({ role: 'dev' }).where(eq(account.id, bea));
    });
    expect(await deactivation).toEqual({ status: 'managers-only' });
    expect(await activeManagers()).toEqual([ada]);
  });

  it('waits for the active-manager lock, then deactivates the other manager', async () => {
    const ada = await h.addAccount('ada@example.test', { role: 'manager' });
    const bea = await h.addAccount('bea@example.test', { role: 'manager' });
    let deactivation: Promise<StatusChangeOutcome> | undefined;
    await h.db.transaction(async (tx) => {
      await lockActiveManagers(tx);
      deactivation = changeStatus(h.db, {
        requesterId: ada,
        accountId: bea,
        change: { active: false },
        now: START,
      });
      await waitForLockWaiter(tx);
    });
    expect(await deactivation).toMatchObject({ status: 'changed' });
    expect(await activeManagers()).toEqual([ada]);
  });

  it('answers the refusal it is given once the account exists', async () => {
    const ada = await h.addAccount('ada@example.test', { role: 'manager' });
    const refusal = { error: 'Active must be true or false', field: 'active' };
    expect(
      await changeStatus(h.db, {
        requesterId: ada,
        accountId: 999,
        change: { refusal },
        now: START,
      }),
    ).toEqual({ status: 'not-found' });
    expect(
      await changeStatus(h.db, {
        requesterId: ada,
        accountId: ada,
        change: { refusal },
        now: START,
      }),
    ).toEqual({ status: 'invalid', refusal });
  });
});

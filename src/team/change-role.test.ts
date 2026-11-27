import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { account } from '../db/schema.ts';
import { type AuthHarness, authHarness } from '../test/auth-app.ts';
import {
  type RoleChangeOutcome,
  changeRole,
  leavesAnActiveManager,
  lockActiveManagers,
} from './change-role.ts';

let h: AuthHarness;

beforeEach(async () => {
  h = await authHarness();
});

afterEach(async () => {
  await h.close();
});

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

const RACE_MS = 300;

async function whileLocked<T>(
  change: (tx: Transaction) => Promise<T>,
  meanwhile: () => void,
): Promise<T> {
  return h.db.transaction(async (tx) => {
    await lockActiveManagers(tx);
    meanwhile();
    await new Promise((resolve) => setTimeout(resolve, RACE_MS));
    return change(tx);
  });
}

async function changeRoleIn(
  tx: Transaction,
  requesterId: number,
  accountId: number,
): Promise<boolean> {
  const managers = await lockActiveManagers(tx);
  if (!managers.includes(requesterId)) return false;
  if (!leavesAnActiveManager(managers, accountId)) return false;
  await tx
    .update(account)
    .set({ role: 'dev' })
    .where(eq(account.id, accountId));
  return true;
}

async function activeManagers(): Promise<number[]> {
  const rows = await h.db.select().from(account);
  return rows
    .filter(({ role, active }) => role === 'manager' && active)
    .map(({ id }) => id);
}

describe('changeRole', () => {
  it('answers a requester made dev meanwhile managers-only', async () => {
    const ada = await h.addAccount('ada@example.test');
    const bob = await h.addAccount('bob@example.test');
    expect(
      await changeRole(h.db, {
        requesterId: ada,
        accountId: bob,
        change: { role: 'manager' },
      }),
    ).toEqual({ status: 'managers-only' });
  });

  it('answers a requester deactivated meanwhile signed-out', async () => {
    const ada = await h.addAccount('ada@example.test', {
      role: 'manager',
      active: false,
    });
    const bob = await h.addAccount('bob@example.test');
    expect(
      await changeRole(h.db, {
        requesterId: ada,
        accountId: bob,
        change: { role: 'manager' },
      }),
    ).toEqual({ status: 'signed-out' });
  });

  it('keeps one manager when two managers demote each other at once', async () => {
    const ada = await h.addAccount('ada@example.test', { role: 'manager' });
    const bea = await h.addAccount('bea@example.test', { role: 'manager' });
    let second: Promise<RoleChangeOutcome> | undefined;
    const first = await whileLocked(
      (tx) => changeRoleIn(tx, bea, ada),
      () => {
        second = changeRole(h.db, {
          requesterId: ada,
          accountId: bea,
          change: { role: 'dev' },
        });
      },
    );
    expect(first).toBe(true);
    expect(await second).toEqual({ status: 'managers-only' });
    expect(await activeManagers()).toEqual([bea]);
  });

  it('keeps one active manager when a demotion and a deactivation run at once', async () => {
    const ada = await h.addAccount('ada@example.test', { role: 'manager' });
    const bea = await h.addAccount('bea@example.test', { role: 'manager' });
    let demotion: Promise<RoleChangeOutcome> | undefined;
    const deactivated = await whileLocked(
      async (tx) => {
        await tx
          .update(account)
          .set({ active: false })
          .where(eq(account.id, ada));
        return true;
      },
      () => {
        demotion = changeRole(h.db, {
          requesterId: ada,
          accountId: bea,
          change: { role: 'dev' },
        });
      },
    );
    expect(deactivated).toBe(true);
    expect(await demotion).toEqual({ status: 'signed-out' });
    expect(await activeManagers()).toEqual([bea]);
  });
});

describe('leavesAnActiveManager', () => {
  it('refuses to demote the last active manager', () => {
    expect(leavesAnActiveManager([3], 3)).toBe(false);
    expect(leavesAnActiveManager([], 3)).toBe(false);
    expect(leavesAnActiveManager([3, 4], 3)).toBe(true);
  });
});

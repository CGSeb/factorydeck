import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../auth/secrets.ts';
import {
  CONNECTION_TIMEOUT_MS,
  type Database,
  createDatabase,
} from '../db/client.ts';
import { account, cliConnection } from '../db/schema.ts';
import { createScratchDatabase } from '../test/postgres.ts';
import { changeStatus } from '../team/account-status.ts';
import { cliConnections } from './connections.ts';

const NOW = new Date('2026-03-12T10:00:00.000Z');
const POOL_SIZE = 4;

let db: Database;
let close: () => Promise<void>;

beforeEach(async () => {
  const scratch = await createScratchDatabase();
  const pool = createDatabase(scratch.url, CONNECTION_TIMEOUT_MS, POOL_SIZE);
  db = pool.db;
  close = async () => {
    await pool.close();
    await scratch.drop();
  };
});

afterEach(async () => {
  await close();
});

async function addAccount(email: string, role: 'manager' | 'dev') {
  const [row] = await db
    .insert(account)
    .values({
      email,
      name: email,
      passwordHash: await hashPassword('a long passphrase'),
      role,
      createdAt: NOW,
    })
    .returning({ id: account.id });
  if (row === undefined) throw new Error('No account');
  return row.id;
}

function waitersIn(result: unknown): number {
  if (typeof result !== 'object' || result === null) return 0;
  if (!('rows' in result) || !Array.isArray(result.rows)) return 0;
  const first: unknown = result.rows[0];
  return typeof first === 'object' && first !== null && 'waiting' in first
    ? Number(first.waiting)
    : 0;
}

async function waitForWaiters(
  tx: Pick<Database, 'execute'>,
  count: number,
): Promise<void> {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    await tx.execute(sql`select pg_stat_clear_snapshot()`);
    const result: unknown = await tx.execute(
      sql`select count(*)::int as waiting from pg_stat_activity
          where wait_event_type = 'Lock' and datname = current_database()`,
    );
    if (waitersIn(result) >= count) return;
    await new Promise((done) => setTimeout(done, 10));
  }
  throw new Error(`Fewer than ${String(count)} requests waited on the lock`);
}

type Order = 'connection first' | 'deactivation first';

async function race(order: Order) {
  const ada = await addAccount('ada@example.test', 'manager');
  const bob = await addAccount('bob@example.test', 'dev');
  const connect = () => cliConnections(db, () => NOW).connect(bob, 'laptop');
  const deactivate = () =>
    changeStatus(db, {
      requesterId: ada,
      accountId: bob,
      change: { active: false },
      now: NOW,
    });
  let connected: ReturnType<typeof connect> | undefined;
  let deactivated: ReturnType<typeof deactivate> | undefined;
  await db.transaction(async (tx) => {
    await tx.select().from(account).where(eq(account.id, bob)).for('update');
    if (order === 'connection first') connected = connect();
    else deactivated = deactivate();
    await waitForWaiters(tx, 1);
    if (order === 'connection first') deactivated = deactivate();
    else connected = connect();
    await waitForWaiters(tx, 2);
  });
  return {
    ada,
    bob,
    connected: await connected,
    deactivated: await deactivated,
  };
}

describe('a CLI connection racing a deactivation', () => {
  it.each<[Order, boolean]>([
    ['connection first', true],
    ['deactivation first', false],
  ])(
    'with the %s, leaves no connection that works after a reactivation',
    async (order, gotToken) => {
      const { ada, bob, connected, deactivated } = await race(order);
      expect(connected !== undefined).toBe(gotToken);
      expect(deactivated?.status).toBe('changed');
      const rows = await db
        .select()
        .from(cliConnection)
        .where(eq(cliConnection.accountId, bob));
      expect(rows).toEqual([]);
      const reactivated = await changeStatus(db, {
        requesterId: ada,
        accountId: bob,
        change: { active: true },
        now: NOW,
      });
      expect(reactivated.status).toBe('changed');
      const signedIn = await cliConnections(db, () => NOW).authenticate(
        connected?.token,
      );
      expect(signedIn).toBeUndefined();
    },
  );
});

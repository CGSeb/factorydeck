import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach } from 'vitest';
import { account, accountToken, signInSession } from '../db/schema.ts';
import { lockActiveManagers } from '../team/change-role.ts';
import {
  type AuthHarness,
  DAY_MS,
  START,
  authHarness,
  signedIn,
} from './auth-app.ts';

let current: AuthHarness | undefined;

function harness(): AuthHarness {
  if (current === undefined) throw new Error('No harness: call useHarness');
  return current;
}

export const h: AuthHarness = {
  get db() {
    return harness().db;
  },
  get clock() {
    return harness().clock;
  },
  set clock(value) {
    harness().clock = value;
  },
  get signInLimit() {
    return harness().signInLimit;
  },
  get cliLogins() {
    return harness().cliLogins;
  },
  get lockWaitMs() {
    return harness().lockWaitMs;
  },
  set lockWaitMs(value) {
    harness().lockWaitMs = value;
  },
  get secretKey() {
    return harness().secretKey;
  },
  set secretKey(value) {
    harness().secretKey = value;
  },
  get hostCli() {
    return harness().hostCli;
  },
  set hostCli(value) {
    harness().hostCli = value;
  },
  app: (up) => harness().app(up),
  addAccount: (email, options) => harness().addAccount(email, options),
  close: () => harness().close(),
};

function hasWaiter(result: unknown): boolean {
  if (typeof result !== 'object' || result === null) return false;
  if (!('rows' in result) || !Array.isArray(result.rows)) return false;
  const first: unknown = result.rows[0];
  return (
    typeof first === 'object' &&
    first !== null &&
    'waiting' in first &&
    Number(first.waiting) > 0
  );
}

export function useHarness(): void {
  beforeEach(async () => {
    current = await authHarness();
  });
  afterEach(async () => {
    await current?.close();
    current = undefined;
  });
}

export function patch(
  path: string,
  cookie: string,
  body: unknown,
): Promise<Response> {
  return Promise.resolve(
    h.app().request(path, {
      method: 'PATCH',
      headers: { cookie, 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
}

export function setActive(
  id: number | string,
  cookie: string,
  active: unknown,
): Promise<Response> {
  return patch(`/api/team/accounts/${id}`, cookie, { active });
}

export async function sessionsOf(id: number): Promise<number> {
  const rows = await h.db
    .select({ id: signInSession.id })
    .from(signInSession)
    .where(eq(signInSession.accountId, id));
  return rows.length;
}

export async function isActive(id: number): Promise<boolean | undefined> {
  const [row] = await h.db
    .select({ active: account.active })
    .from(account)
    .where(eq(account.id, id));
  return row?.active;
}

export async function addResetLink(
  accountId: number,
  hash: string,
  usedAt: Date | null = null,
): Promise<void> {
  await h.db.insert(accountToken).values({
    kind: 'reset',
    tokenHash: hash,
    accountId,
    createdAt: START,
    expiresAt: new Date(START.getTime() + DAY_MS),
    usedAt,
  });
}

export async function resetLinkUsedAt(hash: string): Promise<Date | null> {
  const [row] = await h.db
    .select({ usedAt: accountToken.usedAt })
    .from(accountToken)
    .where(eq(accountToken.tokenHash, hash));
  return row?.usedAt ?? null;
}

export async function team(): Promise<{
  ada: number;
  dev: number;
  cookie: string;
  devCookie: string;
}> {
  const ada = await h.addAccount('ada@example.test', {
    role: 'manager',
    name: 'Ada',
  });
  const dev = await h.addAccount('dev@example.test', { name: 'Dev' });
  const cookie = await signedIn(h.app(), 'ada@example.test');
  const devCookie = await signedIn(h.app(), 'dev@example.test');
  return { ada, dev, cookie, devCookie };
}

export const NOT_FOUND = { error: 'Not found' };
export const YOURSELF = { error: 'You cannot deactivate yourself' };

export async function waitForLockWaiter(
  tx: Pick<AuthHarness['db'], 'execute'>,
): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    await tx.execute(sql`select pg_stat_clear_snapshot()`);
    const result: unknown = await tx.execute(
      sql`select count(*)::int as waiting from pg_stat_activity
          where wait_event_type = 'Lock'
          and datname = current_database()`,
    );
    if (hasWaiter(result)) return;
    await new Promise((done) => setTimeout(done, 10));
  }
  throw new Error('No request waited on the team lock');
}

export async function whileLocked(
  send: () => Promise<Response>,
  meanwhile: (tx: Pick<typeof h.db, 'update'>) => Promise<unknown>,
): Promise<Response> {
  let answer: Promise<Response> | undefined;
  await h.db.transaction(async (tx) => {
    await lockActiveManagers(tx);
    answer = send();
    await waitForLockWaiter(tx);
    await meanwhile(tx);
  });
  if (answer === undefined) throw new Error('Not sent');
  return answer;
}

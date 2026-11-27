import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { account, signInSession } from '../db/schema.ts';
import {
  type AuthHarness,
  DAY_MS,
  START,
  authHarness,
  get,
  signedIn,
} from '../test/auth-app.ts';

let h: AuthHarness;

beforeEach(async () => {
  h = await authHarness();
});

afterEach(async () => {
  await h.close();
});

function patch(
  path: string,
  cookie: string,
  body: string | null,
  up = true,
): Promise<Response> {
  return Promise.resolve(
    h.app(up).request(path, {
      method: 'PATCH',
      headers: { cookie, 'content-type': 'application/json' },
      body,
    }),
  );
}

function setRole(id: number | string, cookie: string, role: unknown) {
  return patch(`/api/team/accounts/${id}`, cookie, JSON.stringify({ role }));
}

async function roleOf(id: number): Promise<string | undefined> {
  const [row] = await h.db
    .select({ role: account.role })
    .from(account)
    .where(eq(account.id, id));
  return row?.role;
}

async function managerAndDev(): Promise<{
  ada: number;
  bob: number;
  cookie: string;
}> {
  const ada = await h.addAccount('ada@example.test', {
    role: 'manager',
    name: 'Ada',
  });
  const bob = await h.addAccount('bob@example.test', { name: 'Bob' });
  const cookie = await signedIn(h.app(), 'ada@example.test');
  return { ada, bob, cookie };
}

const ROLE_INVALID = { error: 'Role must be manager or dev', field: 'role' };

describe('PATCH /api/team/accounts/<id> with a role', () => {
  it('makes a dev a manager, answering the row of the list', async () => {
    const { bob, cookie } = await managerAndDev();
    const lastSignInAt = new Date(START.getTime() - DAY_MS);
    await h.db.update(account).set({ lastSignInAt }).where(eq(account.id, bob));
    const response = await setRole(bob, cookie, 'manager');
    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(body).toEqual({
      id: bob,
      name: 'Bob',
      email: 'bob@example.test',
      role: 'manager',
      active: true,
      lastSignInAt: lastSignInAt.toISOString(),
      you: false,
    });
    const list = (await (
      await get(h.app(), '/api/team/accounts', cookie)
    ).json()) as { accounts: unknown[] };
    expect(list.accounts).toContainEqual(body);
    expect(await roleOf(bob)).toBe('manager');
  });

  it('makes a manager a dev', async () => {
    const { cookie } = await managerAndDev();
    const cy = await h.addAccount('cy@example.test', { role: 'manager' });
    const response = await setRole(cy, cookie, 'dev');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: cy, role: 'dev' });
    expect(await roleOf(cy)).toBe('dev');
  });

  it('takes effect on the next request and keeps the sessions open', async () => {
    const { bob, cookie } = await managerAndDev();
    const bobCookie = await signedIn(h.app(), 'bob@example.test');
    expect((await get(h.app(), '/api/team/accounts', bobCookie)).status).toBe(
      403,
    );
    expect((await setRole(bob, cookie, 'manager')).status).toBe(200);
    expect((await get(h.app(), '/api/team/accounts', bobCookie)).status).toBe(
      200,
    );
    const me = await get(h.app(), '/api/auth/me', bobCookie);
    expect(await me.json()).toMatchObject({ role: 'manager' });
    const sessions = await h.db
      .select()
      .from(signInSession)
      .where(eq(signInSession.accountId, bob));
    expect(sessions).toHaveLength(1);
  });

  it('answers the same role 200 with the account unchanged, writing nothing', async () => {
    const { bob, cookie } = await managerAndDev();
    const before = await h.db.select().from(account).where(eq(account.id, bob));
    const response = await setRole(bob, cookie, 'dev');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: bob, role: 'dev' });
    expect(
      await h.db.select().from(account).where(eq(account.id, bob)),
    ).toEqual(before);
  });

  it.each([
    ['missing', '{}', { error: 'Send role or active' }],
    ['not a JSON object', '[1]', { error: 'Send role or active' }],
    ['a string body', '"role"', { error: 'Send role or active' }],
    ['not JSON at all', 'role=dev', { error: 'Send role or active' }],
    ['null', '{"role":null}', ROLE_INVALID],
    ['a number', '{"role":1}', ROLE_INVALID],
    ['in another case', '{"role":"Manager"}', ROLE_INVALID],
    ['another role', '{"role":"admin"}', ROLE_INVALID],
    ['empty', '{"role":""}', ROLE_INVALID],
    [
      'sent with active',
      '{"role":"manager","active":true}',
      { error: 'Change the role or the status, not both' },
    ],
  ])('answers 400 for a role %s', async (_case, body, error) => {
    const { bob, cookie } = await managerAndDev();
    const response = await patch(`/api/team/accounts/${bob}`, cookie, body);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(error);
    expect(await roleOf(bob)).toBe('dev');
  });

  it('ignores unknown fields', async () => {
    const { bob, cookie } = await managerAndDev();
    const response = await patch(
      `/api/team/accounts/${bob}`,
      cookie,
      JSON.stringify({ role: 'manager', name: 'Eve' }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ name: 'Bob' });
  });

  it.each(['abc', '-1', '1.5', '007', '0', '99999', '99999999999999999999'])(
    'answers 404 for the id %s',
    async (id) => {
      const { cookie } = await managerAndDev();
      const response = await setRole(id, cookie, 'manager');
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Not found' });
    },
  );

  it('refuses to change one’s own role', async () => {
    const { ada, cookie } = await managerAndDev();
    await h.addAccount('cy@example.test', { role: 'manager' });
    const response = await setRole(ada, cookie, 'dev');
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'You cannot change your own role',
    });
    expect(await roleOf(ada)).toBe('manager');
  });

  it('refuses a deactivated account, even with its own role', async () => {
    const { cookie } = await managerAndDev();
    const dan = await h.addAccount('dan@example.test', { active: false });
    for (const role of ['manager', 'dev']) {
      const response = await setRole(dan, cookie, role);
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        error: 'Reactivate this account first',
      });
    }
    expect(await roleOf(dan)).toBe('dev');
  });

  it('answers 404 before 400, 400 before yourself, yourself before deactivated', async () => {
    const { ada, cookie } = await managerAndDev();
    const dan = await h.addAccount('dan@example.test', { active: false });
    const unknown = await setRole(99999, cookie, 'admin');
    expect(unknown.status).toBe(404);
    const invalid = await setRole(ada, cookie, 'admin');
    expect(invalid.status).toBe(400);
    const invalidDeactivated = await setRole(dan, cookie, 'admin');
    expect(invalidDeactivated.status).toBe(400);
    const yourself = await setRole(ada, cookie, 'manager');
    expect(await yourself.json()).toEqual({
      error: 'You cannot change your own role',
    });
  });

  it('answers a dev 403 before 404', async () => {
    const { bob } = await managerAndDev();
    const cookie = await signedIn(h.app(), 'bob@example.test');
    const response = await setRole('abc', cookie, 'manager');
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Managers only' });
    expect(await roleOf(bob)).toBe('dev');
  });

  it('answers 503 and changes nothing while the database is down', async () => {
    const { bob, cookie } = await managerAndDev();
    const response = await patch(
      `/api/team/accounts/${bob}`,
      cookie,
      JSON.stringify({ role: 'manager' }),
      false,
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'unreachable',
      refreshSeconds: 10,
    });
    expect(await roleOf(bob)).toBe('dev');
  });

  it('answers 401 without a session', async () => {
    const { bob } = await managerAndDev();
    const response = await setRole(bob, '', 'manager');
    expect(response.status).toBe(401);
  });
});

import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { account, accountToken, signInSession } from '../db/schema.ts';
import { INVITATION_LIFETIME_MS } from '../team/invitations.ts';
import {
  type AuthHarness,
  DAY_MS,
  PASSWORD,
  START,
  authHarness,
  get,
  signIn,
  tokenOf,
} from '../test/auth-app.ts';
import {
  DEAD,
  NEW_PASSWORD,
  invitationClient,
} from '../test/invitation-client.ts';

let h: AuthHarness;

beforeEach(async () => {
  h = await authHarness();
});

afterEach(async () => {
  await h.close();
});

const { send, manager, invite, read, accept, pendingList } = invitationClient(
  () => h,
);

describe('POST /api/auth/invitation', () => {
  it('answers the email and role of a pending invitation without a session', async () => {
    const { cookie } = await manager();
    const created = await invite(cookie);
    const response = await read(created.token);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      email: 'dev@example.test',
      role: 'dev',
    });
  });

  it('works until just before 7 x 24 h, and stops at exactly 7 x 24 h', async () => {
    const { cookie } = await manager();
    const created = await invite(cookie);
    h.clock = new Date(START.getTime() + INVITATION_LIFETIME_MS - 1);
    expect((await read(created.token)).status).toBe(200);
    h.clock = new Date(START.getTime() + INVITATION_LIFETIME_MS);
    expect((await read(created.token)).status).toBe(410);
    expect((await accept(created.token)).status).toBe(410);
  });

  it.each([undefined, '', 'unknown', 42, 'x'.repeat(500)])(
    'answers 410 for the token %j',
    async (token) => {
      const response = await read(token);
      expect(response.status).toBe(410);
      expect(await response.json()).toEqual(DEAD);
    },
  );

  it('answers 410 once the email got an account since', async () => {
    const { cookie } = await manager();
    const created = await invite(cookie);
    await h.addAccount('dev@example.test');
    expect((await read(created.token)).status).toBe(410);
    expect((await accept(created.token)).status).toBe(410);
  });

  it('answers 503 while the database is unreachable', async () => {
    const response = await Promise.resolve(
      h.app(false).request('/api/auth/invitation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: 'x' }),
      }),
    );
    expect(response.status).toBe(503);
  });
});

describe('POST /api/auth/invitation/accept', () => {
  it('creates the account with the invitation role, signs it in, then refuses the link', async () => {
    const { cookie } = await manager();
    const created = await invite(cookie, 'dev@example.test', 'manager');
    h.clock = new Date(START.getTime() + DAY_MS);
    const response = await accept(created.token, {
      name: '  Dev One ',
      password: NEW_PASSWORD,
      email: 'other@example.test',
      role: 'dev',
    });
    expect(response.status).toBe(201);
    const body = (await response.json()) as { id: number };
    expect(body).toEqual({
      id: expect.any(Number) as number,
      email: 'dev@example.test',
      name: 'Dev One',
      role: 'manager',
    });
    const session = `factorydeck_session=${tokenOf(response)}`;
    expect(await (await get(h.app(), '/api/auth/me', session)).json()).toEqual(
      body,
    );
    const [row] = await h.db
      .select()
      .from(account)
      .where(eq(account.id, body.id));
    expect(row?.lastSignInAt?.toISOString()).toBe(h.clock.toISOString());
    const [used] = await h.db.select().from(accountToken);
    expect(used?.usedAt?.toISOString()).toBe(h.clock.toISOString());
    expect(used?.accountId).toBe(body.id);
    expect((await read(created.token)).status).toBe(410);
    expect((await accept(created.token)).status).toBe(410);
    const again = await signIn(h.app(), {
      email: 'dev@example.test',
      password: NEW_PASSWORD,
    });
    expect(again.status).toBe(200);
  });

  it('answers 410 for a dead link before a field error', async () => {
    const response = await accept('unknown', { name: '', password: 'short' });
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual(DEAD);
  });

  it.each([
    [{ password: NEW_PASSWORD }, 'name', 'Name is required'],
    [{ name: '', password: 'short' }, 'name', 'Name is required'],
    [
      { name: 'Dev', password: 'short' },
      'password',
      'Password must be at least 12 characters',
    ],
    [{ name: 'Dev' }, 'password', 'Password is required'],
  ])('answers 400 for %j and creates nothing', async (fields, field, error) => {
    const { cookie } = await manager();
    const created = await invite(cookie);
    const response = await accept(created.token, fields);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error, field });
    expect((await read(created.token)).status).toBe(200);
  });

  it('deletes the session the browser already had', async () => {
    const ada = await manager();
    const created = await invite(ada.cookie);
    const response = await accept(created.token, undefined, ada.cookie);
    expect(response.status).toBe(201);
    expect((await get(h.app(), '/api/auth/me', ada.cookie)).status).toBe(401);
    expect(await h.db.select().from(signInSession)).toHaveLength(1);
  });

  it('creates one account when two accepts of one token arrive at once', async () => {
    const { cookie } = await manager();
    const created = await invite(cookie);
    const responses = await Promise.all([
      accept(created.token),
      accept(created.token),
    ]);
    expect(responses.map((r) => r.status).sort((a, b) => a - b)).toEqual([
      201, 410,
    ]);
    const rows = await h.db
      .select()
      .from(account)
      .where(eq(account.email, 'dev@example.test'));
    expect(rows).toHaveLength(1);
  });

  it.each(['revoke', 'new link'])(
    'either succeeds whole or answers 410 when racing a %s',
    async (race) => {
      const { cookie } = await manager();
      const created = await invite(cookie);
      const path =
        race === 'revoke'
          ? `/api/team/invitations/${created.id}`
          : `/api/team/invitations/${created.id}/new-link`;
      const [accepted] = await Promise.all([
        accept(created.token),
        send(race === 'revoke' ? 'DELETE' : 'POST', path, undefined, cookie),
      ]);
      const accounts = await h.db
        .select()
        .from(account)
        .where(eq(account.email, 'dev@example.test'));
      const pending = await pendingList(cookie);
      const sessions = await h.db.select().from(signInSession);
      const whole = {
        status: accepted.status,
        accounts: accounts.length,
        pending: pending.length,
        sessions: sessions.length,
      };
      expect([
        { status: 201, accounts: 1, pending: 0, sessions: 2 },
        {
          status: 410,
          accounts: 0,
          pending: race === 'revoke' ? 0 : 1,
          sessions: 1,
        },
      ]).toContainEqual(whole);
    },
  );

  it('does not clear the failed sign-in count of the email', async () => {
    const { cookie } = await manager();
    for (let i = 0; i < 10; i++) {
      await signIn(h.app(), { email: 'dev@example.test', password: 'wrong' });
    }
    const created = await invite(cookie);
    expect((await accept(created.token)).status).toBe(201);
    const response = await signIn(h.app(), {
      email: 'dev@example.test',
      password: NEW_PASSWORD,
    });
    expect(response.status).toBe(429);
  });

  it('answers 503 while the database is unreachable', async () => {
    const response = await Promise.resolve(
      h.app(false).request('/api/auth/invitation/accept', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: 'x', name: 'Dev', password: PASSWORD }),
      }),
    );
    expect(response.status).toBe(503);
  });
});

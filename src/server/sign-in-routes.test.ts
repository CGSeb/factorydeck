import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { account, signInSession } from '../db/schema.ts';
import {
  type AuthHarness,
  DAY_MS,
  PASSWORD,
  START,
  authHarness,
  get,
  signIn,
  signedIn,
  tokenOf,
} from '../test/auth-app.ts';

let h: AuthHarness;

beforeEach(async () => {
  h = await authHarness();
});

afterEach(async () => {
  await h.close();
});

describe('POST /api/auth/sign-in', () => {
  it('answers 200 with the account, opens a session, sets its cookie and records the sign-in', async () => {
    const id = await h.addAccount('ada@example.test', { role: 'manager' });
    h.clock = new Date(START.getTime() + DAY_MS);
    const response = await signIn(h.app(), {
      email: '  ADA@Example.TEST ',
      password: PASSWORD,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id,
      email: 'ada@example.test',
      name: 'ada',
      role: 'manager',
    });
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie.split('; ').slice(1).sort()).toEqual([
      'HttpOnly',
      'Max-Age=2592000',
      'Path=/',
      'SameSite=Lax',
    ]);
    expect(Buffer.from(tokenOf(response), 'base64url')).toHaveLength(32);
    const stored = await h.db.select().from(signInSession);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      accountId: id,
      createdAt: h.clock,
      lastUsedAt: h.clock,
    });
    expect(stored[0]?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    const [row] = await h.db.select().from(account);
    expect(row?.lastSignInAt).toEqual(h.clock);
  });

  it('sets Secure on the cookie behind an HTTPS proxy', async () => {
    await h.addAccount('ada@example.test');
    const response = await h.app().request('/api/auth/sign-in', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-proto': 'https',
      },
      body: JSON.stringify({ email: 'ada@example.test', password: PASSWORD }),
    });
    expect(response.headers.get('set-cookie')).toMatch(/; Secure(;|$)/);
  });

  it.each([
    [
      'a wrong password',
      { email: 'ada@example.test', password: 'wrong one!!!' },
    ],
    [
      'the password trimmed',
      { email: 'ada@example.test', password: ' a long passphrase ' },
    ],
    ['an unknown email', { email: 'grace@example.test', password: PASSWORD }],
    [
      'a deactivated account',
      { email: 'hedy@example.test', password: PASSWORD },
    ],
    ['a missing password', { email: 'ada@example.test' }],
    ['a non-string email', { email: 42, password: PASSWORD }],
    ['a body that is not a JSON object', 'not json'],
  ])('answers 401 on %s, and opens no session', async (_case, body) => {
    await h.addAccount('ada@example.test');
    await h.addAccount('hedy@example.test', { active: false });
    const response = await signIn(h.app(), body);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Wrong email or password' });
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(await h.db.select().from(signInSession)).toEqual([]);
    const rows = await h.db.select().from(account);
    expect(rows.map((row) => row.lastSignInAt)).toEqual([null, null]);
  });

  it('keeps several sessions of one account open at once', async () => {
    await h.addAccount('ada@example.test');
    const server = h.app();
    const first = await signedIn(server);
    const second = await signedIn(server);
    expect(first).not.toBe(second);
    expect(await h.db.select().from(signInSession)).toHaveLength(2);
    expect((await get(server, '/api/auth/me', first)).status).toBe(200);
    expect((await get(server, '/api/auth/me', second)).status).toBe(200);
  });

  it('deletes the session the sign-in carries before opening the new one', async () => {
    await h.addAccount('ada@example.test');
    await h.addAccount('grace@example.test');
    const server = h.app();
    const other = await signedIn(server);
    const carried = await signedIn(server);
    const again = (password: string, email = 'grace@example.test') =>
      server.request('/api/auth/sign-in', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: carried },
        body: JSON.stringify({ email, password }),
      });
    expect((await again('wrong password!')).status).toBe(401);
    expect((await get(server, '/api/auth/me', carried)).status).toBe(200);
    const response = await again(PASSWORD);
    expect(response.status).toBe(200);
    expect((await get(server, '/api/auth/me', carried)).status).toBe(401);
    expect((await get(server, '/api/auth/me', other)).status).toBe(200);
    const fresh = `factorydeck_session=${tokenOf(response)}`;
    expect(
      await (await get(server, '/api/auth/me', fresh)).json(),
    ).toMatchObject({ email: 'grace@example.test' });
    expect(await h.db.select().from(signInSession)).toHaveLength(2);
  });

  it('answers 503 when the database is unreachable', async () => {
    const response = await signIn(h.app(false), {
      email: 'ada@example.test',
      password: PASSWORD,
    });
    expect(response.status).toBe(503);
  });
});

describe('POST /api/auth/sign-out', () => {
  it('deletes the current session only, clears the cookie and answers 204', async () => {
    await h.addAccount('ada@example.test');
    const server = h.app();
    const current = await signedIn(server);
    const other = await signedIn(server);
    const response = await server.request('/api/auth/sign-out', {
      method: 'POST',
      headers: { cookie: current },
    });
    expect(response.status).toBe(204);
    const cleared = response.headers.get('set-cookie') ?? '';
    expect(cleared).toMatch(/^factorydeck_session=;/);
    expect(cleared).toContain('Max-Age=0');
    expect(await h.db.select().from(signInSession)).toHaveLength(1);
    expect((await get(server, '/api/auth/me', current)).status).toBe(401);
    expect((await get(server, '/api/auth/me', other)).status).toBe(200);
  });

  it.each([
    ['no cookie', {}],
    ['an unknown session', { cookie: 'factorydeck_session=unknown' }],
  ])('answers 204 with %s', async (_case, headers) => {
    const response = await h.app().request('/api/auth/sign-out', {
      method: 'POST',
      headers,
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });
});

describe('GET /api/auth/me', () => {
  it('answers the account of the session', async () => {
    const id = await h.addAccount('ada@example.test');
    const server = h.app();
    const response = await get(server, '/api/auth/me', await signedIn(server));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id,
      email: 'ada@example.test',
      name: 'ada',
      role: 'dev',
    });
  });

  it.each([
    ['no cookie', undefined],
    ['an empty cookie', 'factorydeck_session='],
    ['an unknown session', 'factorydeck_session=unknown'],
  ])('answers 401 with %s', async (_case, cookie) => {
    const response = await get(h.app(), '/api/auth/me', cookie);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Not signed in' });
  });
});

describe('session lifetime', () => {
  it('lasts 30 days after its last use, and is deleted once expired', async () => {
    await h.addAccount('ada@example.test');
    const server = h.app();
    const cookie = await signedIn(server);
    h.clock = new Date(START.getTime() + 29 * DAY_MS);
    expect((await get(server, '/api/auth/me', cookie)).status).toBe(200);
    h.clock = new Date(START.getTime() + 58 * DAY_MS);
    expect((await get(server, '/api/auth/me', cookie)).status).toBe(200);
    h.clock = new Date(START.getTime() + 89 * DAY_MS);
    const expired = await get(server, '/api/auth/me', cookie);
    expect(expired.status).toBe(401);
    expect(await expired.json()).toEqual({ error: 'Not signed in' });
    expect(await h.db.select().from(signInSession)).toEqual([]);
  });

  it('expires at exactly 30 days after its stored last use, and not a millisecond before', async () => {
    await h.addAccount('ada@example.test');
    const server = h.app();
    const cookie = await signedIn(server);
    const second = await signedIn(server);
    h.clock = new Date(START.getTime() + 30 * DAY_MS - 1);
    expect((await get(server, '/api/auth/me', cookie)).status).toBe(200);
    h.clock = new Date(START.getTime() + 30 * DAY_MS);
    const expired = await get(server, '/api/auth/me', second);
    expect(expired.status).toBe(401);
    expect(await h.db.select().from(signInSession)).toHaveLength(1);
  });

  it('writes the last use at most once a minute and renews the cookie on each request', async () => {
    await h.addAccount('ada@example.test');
    const server = h.app();
    const cookie = await signedIn(server);
    const lastUse = async () =>
      (await h.db.select().from(signInSession))[0]?.lastUsedAt;
    h.clock = new Date(START.getTime() + 30_000);
    const early = await get(server, '/api/auth/me', cookie);
    expect(await lastUse()).toEqual(START);
    expect(early.headers.get('set-cookie')).toBe(
      `${cookie}; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax`,
    );
    h.clock = new Date(START.getTime() + 60_000);
    await get(server, '/api/auth/me', cookie);
    expect(await lastUse()).toEqual(h.clock);
  });

  it('treats a deactivated account as not signed in, and deletes its session', async () => {
    const id = await h.addAccount('ada@example.test');
    const server = h.app();
    const cookie = await signedIn(server);
    await h.db.update(account).set({ active: false }).where(eq(account.id, id));
    const response = await get(server, '/api/auth/me', cookie);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Not signed in' });
    expect(await h.db.select().from(signInSession)).toEqual([]);
  });
});

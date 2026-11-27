import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hashToken } from '../auth/secrets.ts';
import { accountToken } from '../db/schema.ts';
import {
  type AuthHarness,
  DAY_MS,
  PASSWORD,
  START,
  authHarness,
  get,
  signIn,
  signedIn,
} from '../test/auth-app.ts';
import { GONE, resetClient } from '../test/reset-client.ts';

let h: AuthHarness;
const { post, team, createLink, linkFor, save, sessionsOf } = resetClient(
  () => h,
);

beforeEach(async () => {
  h = await authHarness();
});

afterEach(async () => {
  await h.close();
});

describe('POST /api/team/accounts/<id>/reset-link', () => {
  it('answers 201 with a token valid 24 hours, storing only its hash', async () => {
    const { ada, bob, cookie } = await team();
    const response = await post(
      `/api/team/accounts/${bob}/reset-link`,
      { ignored: true },
      cookie,
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['expiresAt', 'token']);
    expect(body['token']).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body['expiresAt']).toBe(
      new Date(START.getTime() + DAY_MS).toISOString(),
    );
    const rows = await h.db.select().from(accountToken);
    expect(rows).toEqual([
      expect.objectContaining({
        kind: 'reset',
        tokenHash: hashToken(String(body['token'])),
        accountId: bob,
        createdBy: ada,
        email: null,
        role: null,
        createdAt: START,
        expiresAt: new Date(START.getTime() + DAY_MS),
        usedAt: null,
      }),
    ]);
  });

  it('changes nothing for the account until the link is used', async () => {
    const { bob, cookie } = await team();
    const bobCookie = await signedIn(h.app(), 'bob@example.test');
    await linkFor(bob, cookie);
    expect(await sessionsOf(bob)).toBe(1);
    expect((await get(h.app(), '/api/auth/me', bobCookie)).status).toBe(200);
    const again = await signIn(h.app(), {
      email: 'bob@example.test',
      password: PASSWORD,
    });
    expect(again.status).toBe(200);
  });

  it('refuses a dev with 403', async () => {
    const { bob } = await team();
    await h.addAccount('cy@example.test');
    const dev = await signedIn(h.app(), 'cy@example.test');
    const response = await createLink(bob, dev);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Managers only' });
    expect(await h.db.select().from(accountToken)).toEqual([]);
  });

  it('answers 404 for an unknown or non-numeric id', async () => {
    const { cookie } = await team();
    for (const id of ['999', 'abc', '007', '-1', '1.5']) {
      const response = await createLink(id, cookie);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Not found' });
    }
  });

  it('answers 409 for oneself and for a deactivated account', async () => {
    const { ada, cookie } = await team();
    const own = await createLink(ada, cookie);
    expect(own.status).toBe(409);
    expect(await own.json()).toEqual({
      error: 'You cannot reset your own password here',
    });
    const dan = await h.addAccount('dan@example.test', { active: false });
    const deactivated = await createLink(dan, cookie);
    expect(deactivated.status).toBe(409);
    expect(await deactivated.json()).toEqual({
      error: 'This account is deactivated',
    });
    expect(await h.db.select().from(accountToken)).toEqual([]);
  });

  it('answers 401 without a session and 503 while the database is down', async () => {
    const { bob, cookie } = await team();
    expect((await createLink(bob, '')).status).toBe(401);
    const down = await post(
      `/api/team/accounts/${bob}/reset-link`,
      undefined,
      cookie,
      false,
    );
    expect(down.status).toBe(503);
  });

  it('replaces the previous unused link', async () => {
    const { bob, cookie } = await team();
    const first = await linkFor(bob, cookie);
    const second = await linkFor(bob, cookie);
    expect((await post('/api/auth/reset', { token: first })).status).toBe(410);
    expect((await post('/api/auth/reset', { token: second })).status).toBe(200);
    const rows = await h.db.select().from(accountToken);
    expect(rows.map(({ tokenHash }) => tokenHash)).toEqual([hashToken(second)]);
  });
});

describe('POST /api/auth/reset', () => {
  it('answers the email without a session and uses nothing', async () => {
    const { bob, cookie } = await team();
    const token = await linkFor(bob, cookie);
    for (let i = 0; i < 2; i++) {
      const response = await post('/api/auth/reset', { token, extra: 1 });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ email: 'bob@example.test' });
    }
    const [row] = await h.db.select().from(accountToken);
    expect(row?.usedAt).toBeNull();
  });

  it('answers 410 for a missing, unknown or non-string token, or a body that is not an object', async () => {
    for (const body of [{}, { token: 'nope' }, { token: 42 }, '[1]', 'x']) {
      const response = await post('/api/auth/reset', body);
      expect(response.status).toBe(410);
      expect(await response.json()).toEqual(GONE);
    }
    expect((await post('/api/auth/reset', undefined)).status).toBe(410);
  });

  it('refuses a token once 24 hours or more have passed', async () => {
    const { bob, cookie } = await team();
    const token = await linkFor(bob, cookie);
    h.clock = new Date(START.getTime() + DAY_MS - 1);
    expect((await post('/api/auth/reset', { token })).status).toBe(200);
    h.clock = new Date(START.getTime() + DAY_MS);
    expect((await post('/api/auth/reset', { token })).status).toBe(410);
    expect((await save(token)).status).toBe(410);
  });

  it('answers 503 while the database is down', async () => {
    const response = await post(
      '/api/auth/reset',
      { token: 'x' },
      undefined,
      false,
    );
    expect(response.status).toBe(503);
  });
});

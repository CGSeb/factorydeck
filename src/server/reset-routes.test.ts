import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { account, accountToken } from '../db/schema.ts';
import {
  type AuthHarness,
  PASSWORD,
  START,
  authHarness,
  get,
  signIn,
  signedIn,
  tokenOf,
} from '../test/auth-app.ts';
import { GONE, NEW_PASSWORD, resetClient } from '../test/reset-client.ts';

let h: AuthHarness;
const { post, team, linkFor, save, sessionsOf } = resetClient(() => h);

beforeEach(async () => {
  h = await authHarness();
});

afterEach(async () => {
  await h.close();
});

describe('POST /api/auth/reset/save', () => {
  it('replaces the password, closes the old sessions and opens a new one', async () => {
    const { bob, cookie } = await team();
    const bobCookie = await signedIn(h.app(), 'bob@example.test');
    const token = await linkFor(bob, cookie);
    h.clock = new Date(START.getTime() + 60_000);
    const response = await save(token);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: bob,
      email: 'bob@example.test',
      name: 'Bob',
      role: 'dev',
    });
    const fresh = tokenOf(response);
    expect(fresh).not.toBe('');
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect((await get(h.app(), '/api/auth/me', bobCookie)).status).toBe(401);
    const me = await get(
      h.app(),
      '/api/auth/me',
      `factorydeck_session=${fresh}`,
    );
    expect(me.status).toBe(200);
    expect(await sessionsOf(bob)).toBe(1);
    const [row] = await h.db
      .select({ lastSignInAt: account.lastSignInAt })
      .from(account)
      .where(eq(account.id, bob));
    expect(row?.lastSignInAt).toEqual(h.clock);
    const [used] = await h.db.select().from(accountToken);
    expect(used?.usedAt).toEqual(h.clock);
    const old = await signIn(h.app(), {
      email: 'bob@example.test',
      password: PASSWORD,
    });
    expect(old.status).toBe(401);
    const withNew = await signIn(h.app(), {
      email: 'bob@example.test',
      password: NEW_PASSWORD,
    });
    expect(withNew.status).toBe(200);
  });

  it('closes the session the browser already had, of another account', async () => {
    const { ada, bob, cookie } = await team();
    const token = await linkFor(bob, cookie);
    const response = await save(token, NEW_PASSWORD, cookie);
    expect(response.status).toBe(200);
    expect((await get(h.app(), '/api/auth/me', cookie)).status).toBe(401);
    expect(await sessionsOf(ada)).toBe(0);
  });

  it('accepts the current password as the new one', async () => {
    const { bob, cookie } = await team();
    const token = await linkFor(bob, cookie);
    expect((await save(token, PASSWORD)).status).toBe(200);
  });

  it('works once: a used link answers 410 on both routes', async () => {
    const { bob, cookie } = await team();
    const token = await linkFor(bob, cookie);
    expect((await save(token)).status).toBe(200);
    const again = await save(token);
    expect(again.status).toBe(410);
    expect(await again.json()).toEqual(GONE);
    expect((await post('/api/auth/reset', { token })).status).toBe(410);
  });

  it('checks the link before the password, then answers 400 as the setup does', async () => {
    const { bob, cookie } = await team();
    const short = await save('unknown', 'short');
    expect(short.status).toBe(410);
    const token = await linkFor(bob, cookie);
    const invalid = await save(token, 'short');
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({
      error: 'Password must be at least 12 characters',
      field: 'password',
    });
    const missing = await post('/api/auth/reset/save', { token });
    expect(await missing.json()).toEqual({
      error: 'Password is required',
      field: 'password',
    });
    expect((await post('/api/auth/reset/save', '"x"')).status).toBe(410);
    const [row] = await h.db.select().from(accountToken);
    expect(row?.usedAt).toBeNull();
  });

  it('lets one of two saves at once win, the other answering 410', async () => {
    const { bob, cookie } = await team();
    const token = await linkFor(bob, cookie);
    const answers = await Promise.all([
      save(token, 'first new passphrase'),
      save(token, 'second new passphrase'),
    ]);
    expect(answers.map(({ status }) => status).sort((a, b) => a - b)).toEqual([
      200, 410,
    ]);
    expect(await sessionsOf(bob)).toBe(1);
  });

  it('refuses the link of a deactivated account, even after a reactivation', async () => {
    const { bob, cookie } = await team();
    const token = await linkFor(bob, cookie);
    await h.db
      .update(account)
      .set({ active: false })
      .where(eq(account.id, bob));
    expect((await post('/api/auth/reset', { token })).status).toBe(410);
    expect((await save(token)).status).toBe(410);
    await h.db
      .update(accountToken)
      .set({ usedAt: START })
      .where(eq(accountToken.accountId, bob));
    await h.db.update(account).set({ active: true }).where(eq(account.id, bob));
    expect((await post('/api/auth/reset', { token })).status).toBe(410);
    expect((await save(token)).status).toBe(410);
  });

  it('still works after its creator was made dev or deactivated', async () => {
    const { ada, bob, cookie } = await team();
    const token = await linkFor(bob, cookie);
    await h.db.update(account).set({ role: 'dev' }).where(eq(account.id, ada));
    expect((await post('/api/auth/reset', { token })).status).toBe(200);
    await h.db
      .update(account)
      .set({ active: false })
      .where(eq(account.id, ada));
    expect((await save(token)).status).toBe(200);
  });

  it('answers 503 while the database is down', async () => {
    const response = await post(
      '/api/auth/reset/save',
      { token: 'x', password: NEW_PASSWORD },
      undefined,
      false,
    );
    expect(response.status).toBe(503);
  });
});

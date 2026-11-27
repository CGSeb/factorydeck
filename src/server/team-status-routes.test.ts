import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { accountToken } from '../db/schema.ts';
import { DAY_MS, START, get, signIn, signedIn } from '../test/auth-app.ts';
import {
  YOURSELF,
  addResetLink,
  h,
  isActive,
  resetLinkUsedAt,
  sessionsOf,
  setActive,
  team,
  useHarness,
} from '../test/team-status.ts';

useHarness();

describe('PATCH /api/team/accounts/<id> with active', () => {
  it('deactivates an account, answers its row and signs it out at once', async () => {
    const { dev, cookie, devCookie } = await team();
    await signedIn(h.app(), 'dev@example.test');
    expect(await sessionsOf(dev)).toBe(2);

    const response = await setActive(dev, cookie, false);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: dev,
      name: 'Dev',
      email: 'dev@example.test',
      role: 'dev',
      active: false,
      lastSignInAt: START.toISOString(),
      you: false,
    });
    expect(await sessionsOf(dev)).toBe(0);
    expect((await get(h.app(), '/api/auth/me', devCookie)).status).toBe(401);
    const again = await signIn(h.app(), {
      email: 'dev@example.test',
      password: 'a long passphrase',
    });
    expect(again.status).toBe(401);
    expect(await again.json()).toEqual({ error: 'Wrong email or password' });
  });

  it('answers in the shape of a row of the list', async () => {
    const { dev, cookie } = await team();
    const answer: unknown = await (await setActive(dev, cookie, false)).json();
    const list = (await (
      await get(h.app(), '/api/team/accounts', cookie)
    ).json()) as { accounts: { id: number }[] };
    expect(answer).toEqual(list.accounts.find(({ id }) => id === dev));
  });

  it('reactivates an account without opening a session', async () => {
    const { dev, cookie } = await team();
    await setActive(dev, cookie, false);

    const response = await setActive(dev, cookie, true);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: dev, active: true });
    expect(await sessionsOf(dev)).toBe(0);
    await signedIn(h.app(), 'dev@example.test');
  });

  it('deactivates another manager while one stays active', async () => {
    const { cookie } = await team();
    const chen = await h.addAccount('chen@example.test', { role: 'manager' });
    const response = await setActive(chen, cookie, false);
    expect(response.status).toBe(200);
    expect(await isActive(chen)).toBe(false);
  });

  it('refuses to deactivate yourself, and reactivating yourself changes nothing', async () => {
    const { ada, cookie } = await team();
    const refused = await setActive(ada, cookie, false);
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual(YOURSELF);
    expect(await isActive(ada)).toBe(true);
    const same = await setActive(ada, cookie, true);
    expect(same.status).toBe(200);
    expect(await same.json()).toMatchObject({
      id: ada,
      active: true,
      you: true,
    });
  });

  it('answers 409 yourself to the only active manager, before the last-manager rule', async () => {
    const { ada, cookie } = await team();
    const response = await setActive(ada, cookie, false);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(YOURSELF);
  });

  it('answers 200 with the account unchanged on a change that changes nothing', async () => {
    const { dev, cookie, devCookie } = await team();
    const same = await setActive(dev, cookie, true);
    expect(same.status).toBe(200);
    expect(await same.json()).toMatchObject({ id: dev, active: true });
    expect((await get(h.app(), '/api/auth/me', devCookie)).status).toBe(200);
    await setActive(dev, cookie, false);
    const again = await setActive(dev, cookie, false);
    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ id: dev, active: false });
  });

  it('marks the unused reset links as used, so they stay used after a reactivation', async () => {
    const { ada, dev, cookie } = await team();
    const used = new Date(START.getTime() - DAY_MS);
    await addResetLink(dev, 'unused');
    await addResetLink(dev, 'used-before', used);
    await addResetLink(ada, 'other-account');

    await setActive(dev, cookie, false);
    await setActive(dev, cookie, true);

    expect(await resetLinkUsedAt('unused')).not.toBeNull();
    expect(await resetLinkUsedAt('used-before')).toEqual(used);
    expect(await resetLinkUsedAt('other-account')).toBeNull();
  });

  it('keeps the invitations the account created', async () => {
    const { dev, cookie } = await team();
    await h.db.insert(accountToken).values({
      kind: 'invitation',
      tokenHash: 'invite',
      email: 'new@example.test',
      role: 'dev',
      createdBy: dev,
      createdAt: START,
      expiresAt: new Date(START.getTime() + DAY_MS),
    });
    await setActive(dev, cookie, false);
    const [row] = await h.db
      .select({
        usedAt: accountToken.usedAt,
        createdBy: accountToken.createdBy,
      })
      .from(accountToken)
      .where(eq(accountToken.tokenHash, 'invite'));
    expect(row).toEqual({ usedAt: null, createdBy: dev });
  });

  it('changes nothing when the deactivation fails midway', async () => {
    const { dev, cookie, devCookie } = await team();
    await addResetLink(dev, 'unused');
    await h.db.execute(sql`
      create function refuse_delete() returns trigger language plpgsql as $$
      begin raise exception 'refused'; end $$`);
    await h.db.execute(sql`
      create trigger refuse_session_delete before delete on sign_in_session
      for each row execute function refuse_delete()`);

    const response = await setActive(dev, cookie, false);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'unreachable',
      refreshSeconds: 10,
    });
    expect(await isActive(dev)).toBe(true);
    expect(await sessionsOf(dev)).toBe(1);
    expect(await resetLinkUsedAt('unused')).toBeNull();
    expect((await get(h.app(), '/api/auth/me', devCookie)).status).toBe(200);
  });
});

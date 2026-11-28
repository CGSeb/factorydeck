import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { account, cliConnection } from '../db/schema.ts';
import {
  type AuthHarness,
  DAY_MS,
  authHarness,
  signedIn,
} from '../test/auth-app.ts';
import { bearer, cliClient } from '../test/cli-client.ts';

let h: AuthHarness;
let cookie: string;
const { post, get, connect, later } = cliClient(() => h);

const RUN_LOGIN = { error: 'Run factorydeck login' };

beforeEach(async () => {
  h = await authHarness();
  await h.addAccount('ada@example.test', { name: 'Ada' });
  cookie = await signedIn(h.app(), 'ada@example.test');
});

afterEach(async () => {
  await h.close();
});

async function connections() {
  return h.db
    .select({
      machine: cliConnection.machine,
      tokenHash: cliConnection.tokenHash,
    })
    .from(cliConnection);
}

describe('a CLI token', () => {
  it('is signed in under /api/cli/ only', async () => {
    const token = await connect(cookie);
    const data = await get('/api/team', bearer(token));
    expect(data.status).toBe(401);
    expect(await data.json()).toEqual({ error: 'Not signed in' });
    expect((await get('/api/auth/me', bearer(token))).status).toBe(401);
    const cookieOnCli = await get('/api/cli/me', { cookie });
    expect(cookieOnCli.status).toBe(401);
    expect(await cookieOnCli.json()).toEqual(RUN_LOGIN);
  });

  it.each([
    ['no header', {}],
    ['a wrong token', bearer('fdk_wrong')],
    ['another scheme', { authorization: 'Basic abc' }],
  ])('answers 401 with %s', async (_name, headers) => {
    await connect(cookie);
    const response = await get('/api/cli/me', headers);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(RUN_LOGIN);
  });

  it('is refused for a deactivated account', async () => {
    const token = await connect(cookie);
    await h.db
      .update(account)
      .set({ active: false })
      .where(eq(account.email, 'ada@example.test'));
    const response = await get('/api/cli/me', bearer(token));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(RUN_LOGIN);
  });

  it('is deleted when its account is deactivated, and stays refused after reactivation', async () => {
    const token = await connect(cookie);
    await h.addAccount('grace@example.test', { role: 'manager' });
    const manager = await signedIn(h.app(), 'grace@example.test');
    const [row] = await h.db
      .select({ id: account.id })
      .from(account)
      .where(eq(account.email, 'ada@example.test'));
    const setActive = (active: boolean) =>
      Promise.resolve(
        h.app().request(`/api/team/accounts/${String(row?.id)}`, {
          method: 'PATCH',
          headers: { cookie: manager, 'content-type': 'application/json' },
          body: JSON.stringify({ active }),
        }),
      );
    expect((await setActive(false)).status).toBe(200);
    expect(await connections()).toHaveLength(0);
    expect((await get('/api/cli/me', bearer(token))).status).toBe(401);
    expect((await setActive(true)).status).toBe(200);
    const after = await get('/api/cli/me', bearer(token));
    expect(after.status).toBe(401);
    expect(await after.json()).toEqual(RUN_LOGIN);
  });

  it('is checked on every route under /api/cli/ but login and poll', async () => {
    const token = await connect(cookie);
    const routes: [string, string][] = [
      ['GET', '/api/cli/nope'],
      ['POST', '/api/cli/nope'],
      ['GET', '/api/cli/login'],
    ];
    for (const [method, path] of routes) {
      const without = await h.app().request(path, { method });
      expect([method, path, without.status]).toEqual([method, path, 401]);
      expect(await without.json()).toEqual(RUN_LOGIN);
      const withToken = await h
        .app()
        .request(path, { method, headers: bearer(token) });
      expect([method, path, withToken.status]).toEqual([method, path, 404]);
    }
  });

  it('works at 29 days without use and expires at 30', async () => {
    const token = await connect(cookie);
    later(29 * DAY_MS);
    expect((await get('/api/cli/me', bearer(token))).status).toBe(200);
    later(30 * DAY_MS - 1);
    expect((await get('/api/cli/me', bearer(token))).status).toBe(200);
    later(30 * DAY_MS);
    const expired = await get('/api/cli/me', bearer(token));
    expect(expired.status).toBe(401);
    expect(await connections()).toHaveLength(0);
  });

  it('moves its last use at most once a minute', async () => {
    const token = await connect(cookie);
    const lastUse = async () =>
      (
        await h.db.select({ at: cliConnection.lastUsedAt }).from(cliConnection)
      )[0]?.at;
    const first = await lastUse();
    later(59_000);
    await get('/api/cli/me', bearer(token));
    expect(await lastUse()).toEqual(first);
    later(1000);
    await get('/api/cli/me', bearer(token));
    expect(await lastUse()).toEqual(h.clock);
  });

  it('logs out and deletes only its connection', async () => {
    const token = await connect(cookie, 'laptop');
    const other = await connect(cookie, 'desktop');
    const response = await post('/api/cli/logout', '', bearer(token));
    expect(response.status).toBe(204);
    expect((await get('/api/cli/me', bearer(token))).status).toBe(401);
    expect((await get('/api/cli/me', bearer(other))).status).toBe(200);
    expect((await connections()).map((row) => row.machine)).toEqual([
      'desktop',
    ]);
  });
});

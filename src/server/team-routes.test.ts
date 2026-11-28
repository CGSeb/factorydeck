import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { account } from '../db/schema.ts';
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

const MANAGERS_ONLY = { error: 'Managers only' };

function post(
  path: string,
  init: { cookie?: string; contentType?: string; body?: string },
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (init.cookie !== undefined) headers['cookie'] = init.cookie;
  if (init.contentType !== undefined) {
    headers['content-type'] = init.contentType;
  }
  return Promise.resolve(
    h.app().request(path, { method: 'POST', headers, body: init.body ?? null }),
  );
}

describe('GET /api/team/accounts', () => {
  it('answers every account, active first then by name, with you on the requester only', async () => {
    const ada = await h.addAccount('ada@example.test', {
      role: 'manager',
      name: 'ada',
    });
    const zoe = await h.addAccount('zoe@example.test', { name: 'Zoe' });
    const bob = await h.addAccount('bob@example.test', {
      name: 'Bob',
      active: false,
    });
    const ben2 = await h.addAccount('ben2@example.test', { name: 'Ben' });
    const ben1 = await h.addAccount('ben1@example.test', {
      name: 'ben',
      role: 'manager',
    });
    await h.db
      .update(account)
      .set({ lastSignInAt: new Date(START.getTime() - DAY_MS) })
      .where(eq(account.id, zoe));
    h.clock = new Date(START.getTime() + DAY_MS);
    const cookie = await signedIn(h.app(), 'ada@example.test');

    const response = await get(h.app(), '/api/team/accounts', cookie);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      refreshSeconds: 10,
      accounts: [
        {
          id: ada,
          name: 'ada',
          email: 'ada@example.test',
          role: 'manager',
          active: true,
          lastSignInAt: h.clock.toISOString(),
          cliConnections: 0,
          you: true,
        },
        {
          id: ben1,
          name: 'ben',
          email: 'ben1@example.test',
          role: 'manager',
          active: true,
          lastSignInAt: null,
          cliConnections: 0,
          you: false,
        },
        {
          id: ben2,
          name: 'Ben',
          email: 'ben2@example.test',
          role: 'dev',
          active: true,
          lastSignInAt: null,
          cliConnections: 0,
          you: false,
        },
        {
          id: zoe,
          name: 'Zoe',
          email: 'zoe@example.test',
          role: 'dev',
          active: true,
          lastSignInAt: new Date(START.getTime() - DAY_MS).toISOString(),
          cliConnections: 0,
          you: false,
        },
        {
          id: bob,
          name: 'Bob',
          email: 'bob@example.test',
          role: 'dev',
          active: false,
          lastSignInAt: null,
          cliConnections: 0,
          you: false,
        },
      ],
    });
  });

  it('refuses a dev with 403', async () => {
    await h.addAccount('dev@example.test');
    const cookie = await signedIn(h.app(), 'dev@example.test');
    const response = await get(h.app(), '/api/team/accounts', cookie);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual(MANAGERS_ONLY);
  });

  it('reads the role at each request', async () => {
    const id = await h.addAccount('ada@example.test', { role: 'manager' });
    const cookie = await signedIn(h.app(), 'ada@example.test');
    expect((await get(h.app(), '/api/team/accounts', cookie)).status).toBe(200);
    await h.db.update(account).set({ role: 'dev' }).where(eq(account.id, id));
    expect((await get(h.app(), '/api/team/accounts', cookie)).status).toBe(403);
  });

  it('answers 503 with the unreachable body while the database is down', async () => {
    const response = await get(
      h.app(false),
      '/api/team/accounts',
      'factorydeck_session=any',
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'unreachable',
      refreshSeconds: 10,
    });
  });

  it('answers 401 without a session', async () => {
    const response = await get(h.app(), '/api/team/accounts');
    expect(response.status).toBe(401);
  });
});

describe('other paths under /api/team/', () => {
  it.each(['/api/team', '/api/team/', '/api/team/unknown', '/api/team/a/b'])(
    'answers a dev 403 on %s',
    async (path) => {
      await h.addAccount('dev@example.test');
      const cookie = await signedIn(h.app(), 'dev@example.test');
      const response = await get(h.app(), path, cookie);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual(MANAGERS_ONLY);
    },
  );

  it('answers a dev 403 on a write to an unknown path', async () => {
    await h.addAccount('dev@example.test');
    const cookie = await signedIn(h.app(), 'dev@example.test');
    const response = await post('/api/team/accounts', { cookie });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual(MANAGERS_ONLY);
  });

  it.each(['/api/team', '/api/team/unknown', '/api/team/accounts/1'])(
    'answers a manager 404 on %s',
    async (path) => {
      await h.addAccount('ada@example.test', { role: 'manager' });
      const cookie = await signedIn(h.app(), 'ada@example.test');
      const response = await get(h.app(), path, cookie);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Not found' });
    },
  );

  it('answers 415 before 401, and 401 before 403', async () => {
    await h.addAccount('dev@example.test');
    const cookie = await signedIn(h.app(), 'dev@example.test');
    const text = { contentType: 'text/plain', body: 'x' };
    expect((await post('/api/team/x', text)).status).toBe(415);
    expect((await post('/api/team/x', { ...text, cookie })).status).toBe(415);
    expect((await post('/api/team/x', {})).status).toBe(401);
    expect(
      (await post('/api/team/x', { cookie: 'factorydeck_session=wrong' }))
        .status,
    ).toBe(401);
    expect((await post('/api/team/x', { cookie })).status).toBe(403);
  });

  it('answers 413 before everything else', async () => {
    await h.addAccount('dev@example.test');
    const cookie = await signedIn(h.app(), 'dev@example.test');
    const response = await post('/api/team/x', {
      cookie,
      contentType: 'text/plain',
      body: 'x'.repeat(1024 * 1024 + 1),
    });
    expect(response.status).toBe(413);
  });
});

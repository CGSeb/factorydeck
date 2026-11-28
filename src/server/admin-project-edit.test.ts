import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { project, projectSession, rootRemote, session } from '../db/schema.ts';
import {
  type AuthHarness,
  START,
  authHarness,
  get,
  signedIn,
} from '../test/auth-app.ts';

let h: AuthHarness;

beforeEach(async () => {
  h = await authHarness({ linkRoots: false });
});

afterEach(async () => {
  await h.close();
});

const SHOP = 'github.com/owner/shop';
const STORE = 'github.com/owner/store';
const OTHER = 'github.com/owner/other';

interface Listed {
  id: number;
  name: string;
  slug: string;
  remote: string;
  createdAt: string;
  sessions: number;
}

function send(
  method: 'POST' | 'PATCH',
  path: string,
  body: unknown,
  cookie: string,
): Promise<Response> {
  return Promise.resolve(
    h.app().request(path, {
      method,
      headers: { 'content-type': 'application/json', cookie },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
}

async function manager(): Promise<string> {
  await h.addAccount('ada@example.test', { role: 'manager', name: 'Ada' });
  return signedIn(h.app(), 'ada@example.test');
}

async function added(cookie: string, remote: string, name: string) {
  const response = await send(
    'POST',
    '/api/admin/projects',
    { remote, name },
    cookie,
  );
  return (await response.json()) as Listed;
}

async function sessionsOf(remote: string, root: string, ids: string[]) {
  await h.db.insert(rootRemote).values({ root, remote });
  await h.db.insert(session).values(ids.map((id) => ({ id, project: root })));
}

async function listed(cookie: string): Promise<Listed[]> {
  const response = await get(h.app(), '/api/admin/projects', cookie);
  return ((await response.json()) as { projects: Listed[] }).projects;
}

function patch(id: number | string, body: unknown, cookie: string) {
  return send('PATCH', `/api/admin/projects/${String(id)}`, body, cookie);
}

describe('GET /api/admin/projects sessions', () => {
  it('counts every stored session of each project by its remote', async () => {
    const cookie = await manager();
    await added(cookie, `https://${SHOP}`, 'Shop');
    await added(cookie, `https://${OTHER}`, 'Other');
    await sessionsOf(SHOP, '/work/shop', ['s1', 's2']);
    await h.db.insert(rootRemote).values({ root: '/clone/shop', remote: SHOP });
    await h.db.insert(session).values({ id: 's3', project: '/clone/shop' });

    const projects = await listed(cookie);

    expect(projects.map(({ name, sessions }) => [name, sessions])).toEqual([
      ['Other', 0],
      ['Shop', 3],
    ]);
  });
});

describe('PATCH /api/admin/projects/:id', () => {
  it('renames a project and answers it as a list item', async () => {
    const cookie = await manager();
    const shop = await added(cookie, `git@github.com:owner/shop.git`, 'Shop');
    await sessionsOf(SHOP, '/work/shop', ['s1']);

    const response = await patch(
      shop.id,
      { name: '  Shop front  ', extra: true },
      cookie,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: shop.id,
      name: 'Shop front',
      slug: 'shop',
      remote: SHOP,
      createdAt: START.toISOString(),
      sessions: 1,
    });
    expect((await listed(cookie))[0]?.name).toBe('Shop front');
  });

  it('moves the sessions of the new remote to the project and keeps the slug', async () => {
    const cookie = await manager();
    const shop = await added(cookie, `https://${SHOP}`, 'Shop');
    await sessionsOf(SHOP, '/work/shop', ['old-1', 'old-2']);
    await sessionsOf(STORE, '/work/store', ['new-1']);

    const response = await patch(
      shop.id,
      { remote: 'git@GitHub.com:Owner/Store.git' },
      cookie,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      name: 'Shop',
      slug: 'shop',
      remote: STORE,
      sessions: 1,
    });
    const linked = await h.db
      .select({ id: projectSession.id, project: projectSession.project })
      .from(projectSession);
    expect(linked).toEqual([{ id: 'new-1', project: 'shop' }]);
    expect(await h.db.select().from(session)).toHaveLength(3);
  });

  it('refuses a remote that belongs to another project with 409', async () => {
    const cookie = await manager();
    const shop = await added(cookie, `https://${SHOP}`, 'Shop');
    await added(cookie, `https://${OTHER}`, 'Other');

    const response = await patch(
      shop.id,
      { remote: `git@github.com:owner/other.git`, name: 'Renamed' },
      cookie,
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'This remote is already the project Other',
    });
    const rows = await h.db.select().from(project);
    expect(rows.find((row) => row.id === shop.id)).toMatchObject({
      name: 'Shop',
      remote: SHOP,
    });
  });

  it('saves a remote that normalises to the project own remote', async () => {
    const cookie = await manager();
    const shop = await added(cookie, `https://${SHOP}`, 'Shop');

    const response = await patch(
      shop.id,
      { remote: 'ssh://git@GitHub.com:22/owner/shop.git/' },
      cookie,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ remote: SHOP });
  });

  it.each([{}, [], 'not json', { other: 1 }])(
    'answers the project unchanged for the body %j',
    async (body) => {
      const cookie = await manager();
      const shop = await added(cookie, `https://${SHOP}`, 'Shop');

      const response = await patch(shop.id, body, cookie);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ...shop, sessions: 0 });
    },
  );

  it.each([
    [{ remote: null }, 'Not a git remote', 'remote'],
    [{ remote: 5 }, 'Not a git remote', 'remote'],
    [{ remote: 'foo' }, 'Not a git remote', 'remote'],
    [{ remote: '' }, 'Not a git remote', 'remote'],
    [{ name: '' }, 'Name is required', 'name'],
    [{ name: '   ' }, 'Name is required', 'name'],
    [{ name: null }, 'Name must be text', 'name'],
    [{ name: 3 }, 'Name must be text', 'name'],
    [{ name: 'x'.repeat(81) }, 'Name must be at most 80 characters', 'name'],
    [{ remote: 'foo', name: '' }, 'Not a git remote', 'remote'],
    [{ remote: `https://${OTHER}`, name: '' }, 'Name is required', 'name'],
  ])('refuses %j with 400', async (body, error, field) => {
    const cookie = await manager();
    const shop = await added(cookie, `https://${SHOP}`, 'Shop');
    await added(cookie, `https://${OTHER}`, 'Other');

    const response = await patch(shop.id, body, cookie);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error, field });
    expect((await listed(cookie)).map(({ name }) => name)).toEqual([
      'Other',
      'Shop',
    ]);
  });

  it.each(['abc', '0', '-1', '1.5', '01', '999', '99999999999999999999'])(
    'answers 404 for the id %s, before checking the body',
    async (id) => {
      const cookie = await manager();
      await added(cookie, `https://${SHOP}`, 'Shop');

      const response = await patch(id, { name: '' }, cookie);

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Not found' });
    },
  );

  it('keeps the last of two saves', async () => {
    const cookie = await manager();
    const shop = await added(cookie, `https://${SHOP}`, 'Shop');

    await patch(shop.id, { name: 'First' }, cookie);
    await patch(shop.id, { name: 'Second' }, cookie);

    expect((await listed(cookie))[0]?.name).toBe('Second');
  });

  it('answers 503 when the database does not answer', async () => {
    const cookie = await manager();

    const response = await Promise.resolve(
      h.app(false).request('/api/admin/projects/1', {
        method: 'PATCH',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Shop' }),
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'unreachable',
      refreshSeconds: 10,
    });
  });
});

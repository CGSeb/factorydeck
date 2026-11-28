import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { project } from '../db/schema.ts';
import type { RemoveProjectResult } from '../team/project-types.ts';
import type { ProjectStore } from '../team/projects.ts';
import { adminRoutes } from './admin-routes.ts';
import { apiContext } from './api-context.ts';
import type { AuthEnv } from './auth-routes.ts';
import { type AuthHarness, authHarness, signedIn } from '../test/auth-app.ts';

let h: AuthHarness;

beforeEach(async () => {
  h = await authHarness();
});

afterEach(async () => {
  await h.close();
});

const MANAGERS_ONLY = { error: 'Managers only' };

function post(path: string, body: unknown, cookie: string): Promise<Response> {
  return Promise.resolve(
    h.app().request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(body),
    }),
  );
}

async function manager(): Promise<string> {
  await h.addAccount('ada@example.test', { role: 'manager', name: 'Ada' });
  return signedIn(h.app(), 'ada@example.test');
}

function fakeApp(result: RemoveProjectResult): {
  app: Hono<AuthEnv>;
  removed: number[];
} {
  const removed: number[] = [];
  const projects: ProjectStore = {
    list: () => Promise.reject(new Error('Not used')),
    remotesNotAdded: () => Promise.reject(new Error('Not used')),
    add: () => Promise.reject(new Error('Not used')),
    update: () => Promise.reject(new Error('Not used')),
    remove: (id) => {
      removed.push(id);
      return Promise.resolve(result);
    },
  };
  const routes = new Hono<AuthEnv>();
  routes.use('*', async (c, next) => {
    c.set('account', {
      id: 1,
      email: 'ada@example.test',
      name: 'Ada',
      role: 'manager',
    });
    await next();
  });
  routes.route(
    '/api/admin',
    adminRoutes(
      { projects },
      apiContext(
        () => Promise.resolve(true),
        10,
        () => undefined,
      ),
    ),
  );
  return { app: routes, removed };
}

describe('DELETE /api/admin/projects/<id> answers', () => {
  it('503 Busy, try again while the locks stay taken', async () => {
    const { app: server, removed } = fakeApp('busy');

    const response = await server.request('/api/admin/projects/7', {
      method: 'DELETE',
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Busy, try again' });
    expect(removed).toEqual([7]);
  });
});

describe('DELETE /api/admin/projects/<id>', () => {
  function remove(path: string, cookie: string): Promise<Response> {
    return Promise.resolve(
      h.app().request(path, { method: 'DELETE', headers: { cookie } }),
    );
  }

  async function added(cookie: string, remote: string): Promise<number> {
    const response = await post('/api/admin/projects', { remote }, cookie);
    return ((await response.json()) as { id: number }).id;
  }

  it('removes the project and answers 204, leaving the other projects', async () => {
    const cookie = await manager();
    const shop = await added(cookie, 'git@github.com:example-org/shop.git');
    await added(cookie, 'git@github.com:example-org/lib.git');

    const response = await remove(
      `/api/admin/projects/${String(shop)}`,
      cookie,
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect((await h.db.select().from(project)).map((row) => row.slug)).toEqual([
      'lib',
    ]);
    const again = await post(
      '/api/admin/projects',
      { remote: 'https://github.com/example-org/shop' },
      cookie,
    );
    expect(again.status).toBe(201);
    expect(await again.json()).toMatchObject({ slug: 'shop' });
  });

  it.each(['0', '-1', '1.5', 'abc', '01', '99999999999999999999', '424242'])(
    'answers 404 Not found for the id %s',
    async (id) => {
      const cookie = await manager();
      await added(cookie, 'git@github.com:example-org/shop.git');

      const response = await remove(`/api/admin/projects/${id}`, cookie);

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Not found' });
      expect(await h.db.select().from(project)).toHaveLength(1);
    },
  );

  it('answers 404 for a project already removed', async () => {
    const cookie = await manager();
    const shop = await added(cookie, 'git@github.com:example-org/shop.git');
    await remove(`/api/admin/projects/${String(shop)}`, cookie);

    const response = await remove(
      `/api/admin/projects/${String(shop)}`,
      cookie,
    );

    expect(response.status).toBe(404);
  });

  it('answers 404 to a PATCH of the settings page of a removed project', async () => {
    const cookie = await manager();
    const shop = await added(cookie, 'git@github.com:example-org/shop.git');
    await remove(`/api/admin/projects/${String(shop)}`, cookie);

    const response = await Promise.resolve(
      h.app().request(`/api/admin/projects/${String(shop)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ name: 'Shop' }),
      }),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
  });

  it('refuses a dev with 403 and removes nothing', async () => {
    const cookie = await manager();
    const shop = await added(cookie, 'git@github.com:example-org/shop.git');
    await h.addAccount('dev@example.test');
    const dev = await signedIn(h.app(), 'dev@example.test');

    const response = await remove(`/api/admin/projects/${String(shop)}`, dev);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual(MANAGERS_ONLY);
    expect(await h.db.select().from(project)).toHaveLength(1);
  });

  it('answers 503 unreachable when the database does not answer', async () => {
    const cookie = await manager();
    const shop = await added(cookie, 'git@github.com:example-org/shop.git');

    const response = await Promise.resolve(
      h.app(false).request(`/api/admin/projects/${String(shop)}`, {
        method: 'DELETE',
        headers: { cookie },
      }),
    );

    expect(response.status).toBe(503);
    expect(await h.db.select().from(project)).toHaveLength(1);
  });
});

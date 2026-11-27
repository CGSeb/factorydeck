import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type AuthHarness,
  PASSWORD,
  type Server,
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

describe('routes that need a session', () => {
  const OPEN = [
    'GET /api/health',
    'GET /api/auth/state',
    'POST /api/auth/setup',
    'POST /api/auth/sign-in',
    'POST /api/auth/sign-out',
  ];

  function apiRoutes(server: Server) {
    const seen = new Set<string>();
    return server.routes
      .filter((route) => route.method !== 'ALL')
      .map((route) => ({
        method: route.method,
        path: route.path.replaceAll(/:[a-zA-Z]+/g, 'x'),
      }))
      .filter(({ method, path }) => {
        const key = `${method} ${path}`;
        if (!path.startsWith('/api/') || OPEN.includes(key) || seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
  }

  it('lists the data routes of every section', () => {
    const paths = apiRoutes(h.app()).map(
      ({ method, path }) => `${method} ${path}`,
    );
    expect(paths).toEqual(
      expect.arrayContaining([
        'GET /api/overview',
        'GET /api/sessions',
        'GET /api/skills',
        'GET /api/roles',
        'GET /api/features',
        'GET /api/bugs',
        'GET /api/git-host',
        'POST /api/git-host/refresh',
        'GET /api/auth/me',
      ]),
    );
    expect(paths.length).toBeGreaterThan(15);
  });

  it('answers 401 on every data route without a session, and lets it answer with one', async () => {
    await h.addAccount('ada@example.test');
    const server = h.app();
    const cookie = await signedIn(server);
    for (const { method, path } of apiRoutes(server)) {
      const without = await server.request(path, { method });
      expect([method, path, without.status]).toEqual([method, path, 401]);
      expect(await without.json()).toEqual({ error: 'Not signed in' });
      const withSession = await server.request(path, {
        method,
        headers: { cookie },
      });
      expect([method, path, withSession.status]).not.toEqual([
        method,
        path,
        401,
      ]);
    }
  });

  it('answers 401 on an unknown API route without a session', async () => {
    expect((await get(h.app(), '/api/nope')).status).toBe(401);
  });

  it('serves the health check and the built UI without a session', async () => {
    const server = h.app();
    expect((await get(server, '/api/health')).status).toBe(200);
    for (const path of ['/', '/app.js', '/sessions/42']) {
      expect((await get(server, path)).status).toBe(200);
    }
  });

  it('answers 503 on a data route while the database is unreachable', async () => {
    const response = await get(
      h.app(false),
      '/api/overview',
      'factorydeck_session=x',
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'unreachable',
      refreshSeconds: 10,
    });
  });
});

describe('JSON bodies', () => {
  it.each([
    [
      'POST',
      '/api/auth/sign-in',
      'application/x-www-form-urlencoded',
      'email=a',
    ],
    ['POST', '/api/auth/setup', 'text/plain', '{"code":"X"}'],
    [
      'POST',
      '/api/git-host/refresh',
      'multipart/form-data; boundary=x',
      '--x--',
    ],
    ['PUT', '/api/projects/x', 'application/json-patch', '{}'],
    ['PATCH', '/api/projects/x', undefined, '{}'],
    ['DELETE', '/api/projects/x', 'text/plain', 'x'],
  ])(
    'answers 415 on %s %s with a %s body',
    async (method, path, type, body) => {
      const response = await h.app().request(path, {
        method,
        headers: type === undefined ? {} : { 'content-type': type },
        body,
      });
      expect(response.status).toBe(415);
      expect(await response.json()).toEqual({ error: 'JSON body expected' });
    },
  );

  it('accepts a JSON body whatever its letter case and charset, and a request with no body', async () => {
    await h.addAccount('ada@example.test');
    const server = h.app();
    const response = await server.request('/api/auth/sign-in', {
      method: 'POST',
      headers: { 'content-type': 'Application/JSON; charset=utf-8' },
      body: JSON.stringify({ email: 'ada@example.test', password: PASSWORD }),
    });
    expect(response.status).toBe(200);
    for (const headers of [{}, { 'content-type': 'text/plain' }]) {
      const empty = await server.request('/api/auth/sign-out', {
        method: 'POST',
        headers,
      });
      expect(empty.status).toBe(204);
    }
  });
});

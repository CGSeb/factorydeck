import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { project } from '../db/schema.ts';
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
const NOT_A_REMOTE = { error: 'Not a git remote', field: 'remote' };

function post(path: string, body: unknown, cookie?: string): Promise<Response> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (cookie !== undefined) headers['cookie'] = cookie;
  return Promise.resolve(
    h.app().request(path, {
      method: 'POST',
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
}

async function manager(): Promise<string> {
  await h.addAccount('ada@example.test', { role: 'manager', name: 'Ada' });
  return signedIn(h.app(), 'ada@example.test');
}

describe('POST /api/admin/projects', () => {
  it('adds a project with its normalised remote, slug and creator, and answers 201', async () => {
    const cookie = await manager();

    const response = await post(
      '/api/admin/projects',
      { remote: 'git@github.com:Owner/My.Repo.git', name: '  Deck  ' },
      cookie,
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as { id: number };
    expect(body).toEqual({
      id: body.id,
      name: 'Deck',
      slug: 'my-repo',
      remote: 'github.com/owner/my.repo',
      createdAt: START.toISOString(),
    });
    const rows = await h.db.select().from(project);
    expect(rows.map((row) => row.createdBy)).toHaveLength(1);
    expect(rows[0]?.createdBy).not.toBeNull();
  });

  it.each([undefined, null, '', '   '])(
    'names the project after the repository as written when the name is %j',
    async (name) => {
      const cookie = await manager();

      const response = await post(
        '/api/admin/projects',
        { remote: 'https://github.com/owner/FactoryDeck/', name, extra: 1 },
        cookie,
      );

      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({
        name: 'FactoryDeck',
        slug: 'factorydeck',
      });
    },
  );

  it('numbers a slug already taken from 2, and never changes it afterwards', async () => {
    const cookie = await manager();
    const remotes = [
      'git@github.com:one/my-repo.git',
      'https://github.com/two/My.Repo',
      'ssh://git@gitlab.example.test:2222/group/sub/my_repo.git',
    ];
    const slugs: unknown[] = [];
    for (const remote of remotes) {
      const response = await post('/api/admin/projects', { remote }, cookie);
      expect(response.status).toBe(201);
      slugs.push(((await response.json()) as { slug: string }).slug);
    }
    expect(slugs).toEqual(['my-repo', 'my-repo-2', 'my-repo-3']);
  });

  it('keeps a numbered slug at most 40 characters', async () => {
    const cookie = await manager();
    const repository = 'r'.repeat(45);
    const slugs: unknown[] = [];
    for (const owner of ['one', 'two']) {
      const response = await post(
        '/api/admin/projects',
        { remote: `git@github.com:${owner}/${repository}.git` },
        cookie,
      );
      slugs.push(((await response.json()) as { slug: string }).slug);
    }
    expect(slugs).toEqual(['r'.repeat(40), `${'r'.repeat(38)}-2`]);
  });

  it('refuses a remote already added in another form with 409', async () => {
    const cookie = await manager();
    await post(
      '/api/admin/projects',
      { remote: 'git@github.com:owner/repo.git', name: 'First' },
      cookie,
    );

    const response = await post(
      '/api/admin/projects',
      { remote: 'https://GitHub.com/Owner/Repo.git', name: 'Second' },
      cookie,
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'This remote is already the project First',
    });
    expect(await h.db.select().from(project)).toHaveLength(1);
  });

  it.each([
    [{}],
    [{ remote: 42 }],
    [{ remote: '' }],
    [{ remote: 'foo' }],
    [{ remote: 'https://github.com/owner' }],
    [{ remote: '~/code/repo' }],
    [{ remote: 'file:///srv/repo.git' }],
    [{ remote: `https://github.com/owner/${'r'.repeat(480)}` }],
    ['not json'],
    [[]],
  ])('refuses %j as not a git remote', async (body) => {
    const cookie = await manager();

    const response = await post('/api/admin/projects', body, cookie);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(NOT_A_REMOTE);
  });

  it.each([
    [42, 'Name must be text'],
    ['x'.repeat(81), 'Name must be at most 80 characters'],
  ])('refuses the name %j with 400', async (name, error) => {
    const cookie = await manager();

    const response = await post(
      '/api/admin/projects',
      { remote: 'git@github.com:owner/repo.git', name },
      cookie,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error, field: 'name' });
  });

  it('accepts a name of 80 characters after trimming', async () => {
    const cookie = await manager();

    const response = await post(
      '/api/admin/projects',
      { remote: 'git@github.com:owner/repo.git', name: ` ${'x'.repeat(80)} ` },
      cookie,
    );

    expect(response.status).toBe(201);
  });

  it('checks the body before a conflict', async () => {
    const cookie = await manager();
    await post(
      '/api/admin/projects',
      { remote: 'git@github.com:owner/repo.git' },
      cookie,
    );

    const response = await post(
      '/api/admin/projects',
      { remote: 'git@github.com:owner/repo.git', name: 42 },
      cookie,
    );

    expect(response.status).toBe(400);
  });
});

describe('GET /api/admin/projects', () => {
  it('answers every project sorted by name without letter case', async () => {
    const cookie = await manager();
    for (const [remote, name] of [
      ['git@github.com:owner/zeta.git', 'zeta'],
      ['https://github.com/owner/alpha', 'Beta'],
      ['https://gitlab.example.test/group/sub/alpha', 'alpha'],
    ]) {
      h.clock = new Date(h.clock.getTime() + DAY_MS);
      await post('/api/admin/projects', { remote, name }, cookie);
    }

    const response = await get(h.app(), '/api/admin/projects', cookie);

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      projects: { id: number }[];
    };
    expect(body).toEqual({
      status: 'ok',
      refreshSeconds: 10,
      projects: [
        {
          id: body.projects[0]?.id,
          name: 'alpha',
          slug: 'alpha-2',
          remote: 'gitlab.example.test/group/sub/alpha',
          createdAt: new Date(START.getTime() + 3 * DAY_MS).toISOString(),
        },
        {
          id: body.projects[1]?.id,
          name: 'Beta',
          slug: 'alpha',
          remote: 'github.com/owner/alpha',
          createdAt: new Date(START.getTime() + 2 * DAY_MS).toISOString(),
        },
        {
          id: body.projects[2]?.id,
          name: 'zeta',
          slug: 'zeta',
          remote: 'github.com/owner/zeta',
          createdAt: new Date(START.getTime() + DAY_MS).toISOString(),
        },
      ],
    });
  });

  it('answers an empty list with no project', async () => {
    const cookie = await manager();

    const response = await get(h.app(), '/api/admin/projects', cookie);

    expect(await response.json()).toEqual({
      status: 'ok',
      refreshSeconds: 10,
      projects: [],
    });
  });

  it('answers 503 when the database does not answer', async () => {
    const cookie = await manager();

    const response = await Promise.resolve(
      h.app(false).request('/api/admin/projects', { headers: { cookie } }),
    );

    expect(response.status).toBe(503);
  });
});

describe('every route under /api/admin/', () => {
  const routes: [string, string][] = [
    ['GET', '/api/admin/projects'],
    ['POST', '/api/admin/projects'],
    ['GET', '/api/admin/anything'],
    ['DELETE', '/api/admin/projects/1'],
    ['GET', '/api/admin'],
  ];

  it.each(routes)('answers a dev 403 on %s %s', async (method, path) => {
    await h.addAccount('dev@example.test');
    const cookie = await signedIn(h.app(), 'dev@example.test');

    const response = await Promise.resolve(
      h.app().request(path, {
        method,
        headers: { cookie, 'content-type': 'application/json' },
        ...(method === 'POST'
          ? { body: JSON.stringify({ remote: 'foo' }) }
          : {}),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual(MANAGERS_ONLY);
  });

  it.each(routes)(
    'answers 401 without a session on %s %s',
    async (method, path) => {
      const response = await Promise.resolve(h.app().request(path, { method }));

      expect(response.status).toBe(401);
    },
  );
});

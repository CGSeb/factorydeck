import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { project, projectRule } from '../db/schema.ts';
import { DEFAULT_ROLE_RULES } from '../roles/default-roles.ts';
import {
  type AuthHarness,
  authHarness,
  get,
  signedIn,
} from '../test/auth-app.ts';
import { roleRule as rule, roleRuleClient } from '../test/role-rule-client.ts';

let h: AuthHarness;

beforeEach(async () => {
  h = await authHarness({ linkRoots: false });
});

afterEach(async () => {
  await h.close();
});

const { path, manager, added, stored, put } = roleRuleClient(() => h);

describe('GET /api/admin/projects/<id>/rules/role', () => {
  it('answers the default role rules of a project added through the API', async () => {
    const cookie = await manager();
    const id = await added(cookie);

    const response = await get(h.app(), path(id), cookie);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      refreshSeconds: 10,
      rules: DEFAULT_ROLE_RULES,
    });
  });

  it('answers an empty list for a project with no role row', async () => {
    const cookie = await manager();
    const [row] = await h.db
      .insert(project)
      .values({
        name: 'Bare',
        slug: 'bare',
        remote: 'github.com/owner/bare',
        createdAt: new Date(),
      })
      .returning();
    expect(await stored(cookie, row?.id ?? 0)).toEqual([]);
  });

  it.each(['999', '0', '-1', 'abc', '1.5'])(
    'answers 404 for the id %s',
    async (id) => {
      const cookie = await manager();
      const response = await get(h.app(), path(id), cookie);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Not found' });
    },
  );

  it('answers 503 unreachable when the database does not answer', async () => {
    const cookie = await manager();
    const id = await added(cookie);
    const response = await Promise.resolve(
      h.app(false).request(path(id), { headers: { cookie } }),
    );
    expect(response.status).toBe(503);
  });
});

describe('PUT /api/admin/projects/<id>/rules/role', () => {
  it('replaces the role rules and answers them in the same shape', async () => {
    const cookie = await manager();
    const id = await added(cookie);
    const rules = [
      { name: '  writer ', description: '^Write ', agentType: '' },
      { name: 'writer', description: null, agentType: '^general-purpose$' },
      { name: 'checker', description: 'check', agentType: 'Explore' },
      { name: 'solo', description: '(?<x>a)b ' },
    ];

    const response = await put(id, { rules }, cookie);

    const expected = [
      { name: 'writer', description: '^Write ', agentType: null },
      { name: 'writer', description: null, agentType: '^general-purpose$' },
      { name: 'checker', description: 'check', agentType: 'Explore' },
      { name: 'solo', description: '(?<x>a)b ', agentType: null },
    ];
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ rules: expected });
    expect(await stored(cookie, id)).toEqual(expected);
  });

  it('saves an empty list', async () => {
    const cookie = await manager();
    const id = await added(cookie);
    const response = await put(id, { rules: [] }, cookie);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ rules: [] });
    expect(await stored(cookie, id)).toEqual([]);
  });

  it('keeps each project its own rules', async () => {
    const cookie = await manager();
    const shop = await added(cookie);
    const store = await added(cookie, 'https://github.com/owner/store');
    await put(shop, { rules: [rule('maker')] }, cookie);
    expect(await stored(cookie, shop)).toEqual([rule('maker')]);
    expect(await stored(cookie, store)).toEqual(DEFAULT_ROLE_RULES);
  });

  it('lets the last save win', async () => {
    const cookie = await manager();
    const id = await added(cookie);
    await Promise.all([
      put(id, { rules: [rule('first')] }, cookie),
      put(id, { rules: [rule('second'), rule('third')] }, cookie),
    ]);
    const rules = await stored(cookie, id);
    expect([[rule('first')], [rule('second'), rule('third')]]).toContainEqual(
      rules,
    );
  });

  it.each(['999', '0', 'abc'])(
    'answers 404 for the id %s before refusing the body',
    async (id) => {
      const cookie = await manager();
      const response = await put(id, { rules: [rule('main')] }, cookie);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Not found' });
    },
  );

  it('answers 404 once the project is removed, and deletes its rules with it', async () => {
    const cookie = await manager();
    const id = await added(cookie);
    await h.db.delete(project).where(eq(project.id, id));
    expect(
      await h.db
        .select()
        .from(projectRule)
        .where(eq(projectRule.projectId, id)),
    ).toEqual([]);
    for (const body of [{ rules: [rule('maker')] }, { rules: 'x' }]) {
      const response = await put(id, body, cookie);
      expect(response.status).toBe(404);
    }
    expect((await get(h.app(), path(id), cookie)).status).toBe(404);
  });

  it('answers 503 unreachable when the database does not answer', async () => {
    const cookie = await manager();
    const id = await added(cookie);
    const response = await Promise.resolve(
      h.app(false).request(path(id), {
        method: 'PUT',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ rules: [] }),
      }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'unreachable',
      refreshSeconds: 10,
    });
  });
});

describe('the role rule routes', () => {
  it.each(['GET', 'PUT'])('answer a dev 403 on %s', async (method) => {
    const cookie = await manager();
    const id = await added(cookie);
    await h.addAccount('dev@example.test');
    const dev = await signedIn(h.app(), 'dev@example.test');
    const response = await Promise.resolve(
      h.app().request(path(id), {
        method,
        headers: { cookie: dev, 'content-type': 'application/json' },
        ...(method === 'PUT' ? { body: JSON.stringify({ rules: [] }) } : {}),
      }),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Managers only' });
    expect(await stored(cookie, id)).toEqual(DEFAULT_ROLE_RULES);
  });

  it.each(['GET', 'PUT'])(
    'answer 401 without a session on %s',
    async (method) => {
      const response = await Promise.resolve(
        h.app().request(path(1), { method }),
      );
      expect(response.status).toBe(401);
    },
  );

  it('answers 415 to a PUT that is not JSON', async () => {
    const cookie = await manager();
    const id = await added(cookie);
    const response = await Promise.resolve(
      h.app().request(path(id), {
        method: 'PUT',
        headers: { cookie, 'content-type': 'text/plain' },
        body: '{"rules":[]}',
      }),
    );
    expect(response.status).toBe(415);
  });
});

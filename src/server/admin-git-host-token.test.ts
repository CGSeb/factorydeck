import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { project } from '../db/schema.ts';
import { decryptToken } from '../team/token-cipher.ts';
import { get } from '../test/auth-app.ts';
import {
  KEY,
  LAB,
  LAB_FILE,
  LAB_PROJECT,
  SHOP,
  addProject,
  goodGitHub,
  manager,
  putToken,
  send,
  useTokenHarness,
} from '../test/git-host-token.ts';

const t = useTokenHarness();

async function stored(id: number) {
  const [row] = await t.h.db.select().from(project).where(eq(project.id, id));
  return row;
}

async function listed(cookie: string) {
  const response = await get(t.h.app(), '/api/admin/projects', cookie);
  return (await response.json()) as {
    secretKey: boolean;
    projects: Record<string, unknown>[];
  };
}

describe('PUT /api/admin/projects/<id>/git-host', () => {
  it('checks a good token, stores it encrypted and never answers it', async () => {
    const cookie = await manager(t);
    const id = await addProject(t, cookie, SHOP);
    await goodGitHub(t);
    const response = await putToken(t, id, cookie, { token: '  ghp_good  ' });
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain('ghp_good');
    expect(JSON.parse(text)).toEqual({
      gitHost: 'github',
      tokenSet: true,
      tokenSetAt: t.h.clock.toISOString(),
      tokenSetBy: { name: 'Ada' },
      defaultBranch: 'trunk',
    });
    const row = await stored(id);
    expect(row?.gitHost).toBeNull();
    expect(row?.tokenCiphertext).not.toContain('ghp_good');
    expect(
      decryptToken(Buffer.from(KEY, 'base64'), id, row?.tokenCiphertext ?? ''),
    ).toBe('ghp_good');
    const calls = await t.fake.calls();
    expect(calls.map((call) => call.env['GH_TOKEN'])).toEqual([
      'ghp_good',
      'ghp_good',
    ]);
    const list = await get(t.h.app(), '/api/admin/projects', cookie);
    const body = await list.text();
    expect(body).not.toContain('ghp_good');
    expect(body).not.toContain(row?.tokenCiphertext ?? '');
    expect(JSON.parse(body)).toMatchObject({
      secretKey: true,
      projects: [
        {
          id,
          gitHost: 'github',
          tokenSet: true,
          tokenSetAt: t.h.clock.toISOString(),
          tokenSetBy: { name: 'Ada' },
        },
      ],
    });
  });

  it('stores GitLab chosen for a self-hosted remote and replaces a token saved again', async () => {
    const cookie = await manager(t);
    const id = await addProject(
      t,
      cookie,
      'https://git.example.test/group/shop',
    );
    await t.fake.answer(LAB_PROJECT, {
      status: 200,
      body: { default_branch: 'trunk' },
    });
    await t.fake.answer(LAB_FILE, {
      status: 200,
      body: { file_name: 'factory.yml' },
    });
    const first = await putToken(t, id, cookie, {
      gitHost: 'gitlab',
      token: 'glpat-one',
    });
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ gitHost: 'gitlab' });
    const [call] = await t.fake.calls();
    expect(call?.cli).toBe('glab');
    expect(call?.env['GITLAB_HOST']).toBe('git.example.test');
    expect(call?.args).toEqual([
      'api',
      '--hostname',
      'git.example.test',
      LAB_PROJECT,
    ]);
    const second = await putToken(t, id, cookie, {
      gitHost: 'gitlab',
      token: 'glpat-two',
    });
    expect(second.status).toBe(200);
    const row = await stored(id);
    expect(row?.gitHost).toBe('gitlab');
    expect(
      decryptToken(Buffer.from(KEY, 'base64'), id, row?.tokenCiphertext ?? ''),
    ).toBe('glpat-two');
  });
});

describe('DELETE /api/admin/projects/<id>/git-host/token', () => {
  it('forgets the token and keeps the chosen git host, even without a key', async () => {
    const cookie = await manager(t);
    const id = await addProject(t, cookie, LAB);
    await t.fake.answer(LAB_PROJECT, {
      status: 200,
      body: { default_branch: 'trunk' },
    });
    await t.fake.answer(LAB_FILE, { status: 200, body: { file_name: 'f' } });
    await putToken(t, id, cookie, { gitHost: 'gitlab', token: 'glpat' });
    t.h.secretKey = undefined;
    const path = `/api/admin/projects/${String(id)}/git-host/token`;
    const response = await send(t, 'DELETE', path, { cookie });
    expect(response.status).toBe(204);
    expect(await stored(id)).toMatchObject({
      gitHost: 'gitlab',
      tokenCiphertext: null,
      tokenSetAt: null,
      tokenSetBy: null,
    });
    expect((await send(t, 'DELETE', path, { cookie })).status).toBe(204);
    const list = await listed(cookie);
    expect(list.secretKey).toBe(false);
    expect(list.projects[0]).toMatchObject({
      gitHost: 'gitlab',
      tokenSet: false,
      tokenSetAt: null,
      tokenSetBy: null,
    });
  });

  it('answers 403, 404, then 503 for the database', async () => {
    const cookie = await manager(t);
    const id = await addProject(t, cookie, SHOP);
    await t.h.addAccount('dev@example.test');
    const { signedIn } = await import('../test/auth-app.ts');
    const dev = await signedIn(t.h.app(), 'dev@example.test');
    const path = (value: number | string) =>
      `/api/admin/projects/${String(value)}/git-host/token`;
    expect((await send(t, 'DELETE', path(id), { cookie: dev })).status).toBe(
      403,
    );
    expect((await send(t, 'DELETE', path(999), { cookie })).status).toBe(404);
    expect((await send(t, 'DELETE', path('x'), { cookie })).status).toBe(404);
    const down = await t.h.app(false).request(path(id), {
      method: 'DELETE',
      headers: { cookie },
    });
    expect(down.status).toBe(503);
  });
});

describe('a project remote change', () => {
  it('clears the token and git host for another host, and keeps them on the same host', async () => {
    const cookie = await manager(t);
    const id = await addProject(t, cookie, SHOP);
    await goodGitHub(t);
    await putToken(t, id, cookie, { token: 'ghp_good' });
    const patch = (remote: string) =>
      send(t, 'PATCH', `/api/admin/projects/${String(id)}`, {
        cookie,
        body: { remote },
      });
    const same = await patch('git@github.com:owner/renamed.git');
    expect(await same.json()).toMatchObject({ tokenSet: true });
    expect((await stored(id))?.tokenCiphertext).not.toBeNull();
    const other = await patch('git@gitlab.com:owner/renamed.git');
    expect(await other.json()).toMatchObject({
      gitHost: 'gitlab',
      tokenSet: false,
      tokenSetAt: null,
      tokenSetBy: null,
    });
    expect(await stored(id)).toMatchObject({
      gitHost: null,
      tokenCiphertext: null,
      tokenSetAt: null,
      tokenSetBy: null,
    });
  });
});

describe('GET /api/admin/projects', () => {
  it('gives an unknown git host as null and a token whose author was removed without a name', async () => {
    const cookie = await manager(t);
    const id = await addProject(t, cookie, LAB);
    await t.h.db
      .update(project)
      .set({ tokenCiphertext: 'v1:a:b:c', tokenSetAt: t.h.clock })
      .where(eq(project.id, id));
    const list = await listed(cookie);
    expect(list.projects[0]).toMatchObject({
      gitHost: null,
      tokenSet: true,
      tokenSetBy: null,
    });
    expect(JSON.stringify(list)).not.toContain('v1:a:b:c');
  });
});

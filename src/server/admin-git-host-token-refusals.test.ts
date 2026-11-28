import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { project } from '../db/schema.ts';
import { hostCliRunner } from '../team/host-cli.ts';
import { signedIn } from '../test/auth-app.ts';
import {
  FILE,
  LAB,
  REPO,
  SHOP,
  type TokenHarness,
  addProject,
  goodGitHub,
  manager,
  putToken,
  useTokenHarness,
} from '../test/git-host-token.ts';

const t: TokenHarness = useTokenHarness();

async function answerOf(
  response: Response | Promise<Response>,
): Promise<[number, unknown]> {
  const answer = await response;
  return [answer.status, await answer.json()];
}

async function nothingStored(id: number): Promise<void> {
  const [row] = await t.h.db.select().from(project).where(eq(project.id, id));
  expect(row).toMatchObject({
    gitHost: null,
    tokenCiphertext: null,
    tokenSetAt: null,
    tokenSetBy: null,
  });
}

const token = (error: string) => ({ error, field: 'token' });
const gitHost = (error: string) => ({ error, field: 'gitHost' });

describe('PUT /api/admin/projects/<id>/git-host refuses, in order', () => {
  it('the shared guards, then 403, 404 and the database 503', async () => {
    const cookie = await manager(t);
    const id = await addProject(t, cookie, SHOP);
    const path = `/api/admin/projects/${String(id)}/git-host`;
    const unsigned = await t.h.app().request(path, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(unsigned.status).toBe(401);
    const text = await t.h.app().request(path, {
      method: 'PUT',
      headers: { 'content-type': 'text/plain', cookie },
      body: 'token',
    });
    expect(text.status).toBe(415);
    await t.h.addAccount('dev@example.test');
    const dev = await signedIn(t.h.app(), 'dev@example.test');
    expect(await answerOf(putToken(t, id, dev, {}))).toEqual([
      403,
      { error: 'Managers only' },
    ]);
    expect(await answerOf(putToken(t, 999, cookie, {}))).toEqual([
      404,
      { error: 'Not found' },
    ]);
    expect(await answerOf(putToken(t, '0x1', cookie, {}))).toEqual([
      404,
      { error: 'Not found' },
    ]);
    const down = await t.h.app(false).request(path, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie },
      body: '{}',
    });
    expect(down.status).toBe(503);
    expect(await down.json()).toEqual({
      status: 'unreachable',
      refreshSeconds: 10,
    });
  });

  it('400 for the token before gitHost', async () => {
    const cookie = await manager(t);
    const lab = await addProject(t, cookie, LAB);
    const required = token('Token is required');
    for (const body of [
      {},
      { token: '' },
      { token: '   ' },
      { token: 42 },
      { token: null },
      { gitHost: 'nope' },
    ]) {
      expect(await answerOf(putToken(t, lab, cookie, body))).toEqual([
        400,
        required,
      ]);
    }
    expect(
      await answerOf(
        putToken(t, lab, cookie, { token: 'x'.repeat(1001), gitHost: 'nope' }),
      ),
    ).toEqual([400, token('At most 1000 characters')]);
    await nothingStored(lab);
  });

  it('400 for a missing or unknown gitHost on another host, on every PUT', async () => {
    const cookie = await manager(t);
    const lab = await addProject(t, cookie, LAB);
    await t.h.db
      .update(project)
      .set({ gitHost: 'gitlab' })
      .where(eq(project.id, lab));
    for (const chosen of [undefined, null, 'GitHub', 'bitbucket', 1]) {
      expect(
        await answerOf(
          putToken(t, lab, cookie, { token: 'tok', gitHost: chosen }),
        ),
      ).toEqual([400, gitHost('Choose GitHub or GitLab')]);
    }
    expect(await t.fake.calls()).toEqual([]);
  });

  it('400 for gitHost sent with a github.com or gitlab.com remote', async () => {
    const cookie = await manager(t);
    const hub = await addProject(t, cookie, SHOP);
    const lab = await addProject(t, cookie, 'git@gitlab.com:group/shop.git');
    for (const chosen of ['github', 'gitlab', null]) {
      expect(
        await answerOf(
          putToken(t, hub, cookie, { token: 'tok', gitHost: chosen }),
        ),
      ).toEqual([400, gitHost('GitHub.com is always GitHub')]);
      expect(
        await answerOf(
          putToken(t, lab, cookie, { token: 'tok', gitHost: chosen }),
        ),
      ).toEqual([400, gitHost('GitLab.com is always GitLab')]);
    }
  });

  it('503 for a missing or invalid key, before the CLI', async () => {
    const cookie = await manager(t);
    const id = await addProject(t, cookie, SHOP);
    t.h.hostCli = hostCliRunner({ commands: { github: '/no/such/gh' } });
    const noKey = { error: 'No secret key: set FACTORYDECK_SECRET_KEY' };
    for (const key of [undefined, '', 'c2hvcnQ=', 'not base64!']) {
      t.h.secretKey = key;
      expect(await answerOf(putToken(t, id, cookie, { token: 'tok' }))).toEqual(
        [503, noKey],
      );
    }
    await nothingStored(id);
  });

  it('503 for a missing CLI, before the check', async () => {
    const cookie = await manager(t);
    const hub = await addProject(t, cookie, SHOP);
    const lab = await addProject(t, cookie, LAB);
    t.h.hostCli = hostCliRunner({
      commands: { github: '/no/such/gh', gitlab: '/no/such/glab' },
    });
    expect(await answerOf(putToken(t, hub, cookie, { token: 'tok' }))).toEqual([
      503,
      {
        error: 'gh not found on the server',
      },
    ]);
    expect(
      await answerOf(
        putToken(t, lab, cookie, { token: 'tok', gitHost: 'gitlab' }),
      ),
    ).toEqual([503, { error: 'glab not found on the server' }]);
  });

  it("422 with the check's failure, storing nothing", async () => {
    const cookie = await manager(t);
    const id = await addProject(t, cookie, SHOP);
    const cases: [() => Promise<void>, string][] = [
      [() => t.fake.answer(REPO, { status: 401 }), 'Bad token'],
      [
        () => t.fake.answer(REPO, { status: 403 }),
        'Token cannot read this repository',
      ],
      [
        () => t.fake.answer(REPO, { status: 404 }),
        'Repository not found or not visible with this token',
      ],
      [
        () => t.fake.answer(REPO, { status: 502 }),
        'Could not reach github.com',
      ],
      [
        async () => {
          await t.fake.answer(REPO, {
            status: 200,
            body: { default_branch: 'trunk' },
          });
          await t.fake.answer(FILE, { status: 404 });
        },
        'No docs/agents/factory.yml on trunk',
      ],
    ];
    for (const [answer, error] of cases) {
      await answer();
      const response = await putToken(t, id, cookie, { token: 'ghp_secret' });
      expect(response.status).toBe(422);
      const text = await response.text();
      expect(text).not.toContain('ghp_secret');
      expect(JSON.parse(text)).toEqual(token(error));
    }
    await nothingStored(id);
  });

  it('accepts a token of exactly 1000 characters', async () => {
    const cookie = await manager(t);
    const id = await addProject(t, cookie, SHOP);
    await goodGitHub(t);
    const response = await putToken(t, id, cookie, { token: 'x'.repeat(1000) });
    expect(response.status).toBe(200);
  });
});

describe('PUT /api/admin/projects/<id>/git-host without a temporary folder', () => {
  it('answers 422 Could not reach <host> instead of a 500, storing nothing', async () => {
    const cookie = await manager(t);
    const id = await addProject(t, cookie, SHOP);
    await goodGitHub(t);
    t.h.hostCli = hostCliRunner({
      ...t.fake.options(),
      tempRoot: `${t.fake.folder}/answers.json`,
    });
    expect(
      await answerOf(putToken(t, id, cookie, { token: 'ghp_secret' })),
    ).toEqual([422, token('Could not reach github.com')]);
    await nothingStored(id);
  });
});

describe('PUT /api/admin/projects/<id>/git-host under the project lock', () => {
  it('answers 409 when the remote changed during the check, and 404 when the project was removed', async () => {
    const cookie = await manager(t);
    const id = await addProject(t, cookie, SHOP);
    await goodGitHub(t);
    const run = t.h.hostCli;
    let during: () => Promise<unknown> = () => Promise.resolve();
    t.h.hostCli = async (call) => {
      await during();
      during = () => Promise.resolve();
      return run(call);
    };
    during = () =>
      t.h.db
        .update(project)
        .set({ remote: 'github.com/owner/moved' })
        .where(eq(project.id, id));
    expect(await answerOf(putToken(t, id, cookie, { token: 'tok' }))).toEqual([
      409,
      {
        error: 'The remote changed during the check: try again',
      },
    ]);
    await nothingStored(id);
    await t.h.db
      .update(project)
      .set({ remote: 'github.com/owner/shop' })
      .where(eq(project.id, id));
    during = () => t.h.db.delete(project).where(eq(project.id, id));
    expect(await answerOf(putToken(t, id, cookie, { token: 'tok' }))).toEqual([
      404,
      {
        error: 'Not found',
      },
    ]);
  });
});

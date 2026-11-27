import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { account } from '../db/schema.ts';
import { signedIn } from '../test/auth-app.ts';
import {
  NOT_FOUND,
  YOURSELF,
  h,
  isActive,
  patch,
  setActive,
  team,
  useHarness,
  whileLocked,
} from '../test/team-status.ts';

useHarness();

describe('PATCH /api/team/accounts/<id> refusals', () => {
  it.each([
    [
      'both fields',
      { role: 'dev', active: false },
      { error: 'Change the role or the status, not both' },
    ],
    ['neither field', { name: 'x' }, { error: 'Send role or active' }],
    ['an empty object', {}, { error: 'Send role or active' }],
    ['an array', [false], { error: 'Send role or active' }],
    ['null', null, { error: 'Send role or active' }],
    ['a string', '"active"', { error: 'Send role or active' }],
    ['a body that is not JSON', '{', { error: 'Send role or active' }],
    [
      'a string active',
      { active: 'false' },
      { error: 'Active must be true or false', field: 'active' },
    ],
    [
      'a null active',
      { active: null },
      { error: 'Active must be true or false', field: 'active' },
    ],
    [
      'a number active',
      { active: 0 },
      { error: 'Active must be true or false', field: 'active' },
    ],
  ])('answers 400 on %s', async (_, body, expected) => {
    const { dev, cookie } = await team();
    const response = await patch(`/api/team/accounts/${dev}`, cookie, body);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(expected);
    expect(await isActive(dev)).toBe(true);
  });

  it('ignores unknown fields', async () => {
    const { dev, cookie } = await team();
    const response = await patch(`/api/team/accounts/${dev}`, cookie, {
      active: false,
      name: 'Renamed',
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ name: 'Dev', active: false });
  });

  it.each(['abc', '007', '0', '-1', '1.5', '1e3', '99999', '9007199254740993'])(
    'answers 404 on the id %s',
    async (id) => {
      const { cookie } = await team();
      const response = await setActive(id, cookie, false);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual(NOT_FOUND);
    },
  );

  it('answers 404 before 400, 400 before 409 yourself, 409 yourself before 409 last manager', async () => {
    const { ada, cookie } = await team();
    const unknown = await patch('/api/team/accounts/99999', cookie, {
      active: 'no',
    });
    expect(unknown.status).toBe(404);
    const invalid = await patch(`/api/team/accounts/${ada}`, cookie, {
      active: 'no',
    });
    expect(invalid.status).toBe(400);
    const yourself = await setActive(ada, cookie, false);
    expect(yourself.status).toBe(409);
    expect(await yourself.json()).toEqual(YOURSELF);
  });

  it('answers a dev 403 before 404 and 400', async () => {
    const { devCookie } = await team();
    const response = await patch('/api/team/accounts/abc', devCookie, 'x');
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Managers only' });
  });

  it('answers 401 without a session, and 503 while the database is down', async () => {
    const { dev } = await team();
    const anonymous = await Promise.resolve(
      h.app().request(`/api/team/accounts/${dev}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: '{"active":false}',
      }),
    );
    expect(anonymous.status).toBe(401);
    const down = await Promise.resolve(
      h.app(false).request(`/api/team/accounts/${dev}`, {
        method: 'PATCH',
        headers: {
          cookie: 'factorydeck_session=any',
          'content-type': 'application/json',
        },
        body: '{"active":false}',
      }),
    );
    expect(down.status).toBe(503);
  });
});

describe('PATCH /api/team/accounts/<id> races', () => {
  it('answers 401 to a requester deactivated meanwhile', async () => {
    const { ada, dev, cookie } = await team();
    const response = await whileLocked(
      () => setActive(dev, cookie, false),
      (tx) =>
        tx.update(account).set({ active: false }).where(eq(account.id, ada)),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Not signed in' });
    expect(await isActive(dev)).toBe(true);
  });

  it('answers 403 to a requester made dev meanwhile', async () => {
    const { ada, dev, cookie } = await team();
    const response = await whileLocked(
      () => setActive(dev, cookie, false),
      (tx) =>
        tx.update(account).set({ role: 'dev' }).where(eq(account.id, ada)),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Managers only' });
    expect(await isActive(dev)).toBe(true);
  });

  it('leaves one active manager when two managers deactivate each other at once', async () => {
    const ada = await h.addAccount('ada@example.test', { role: 'manager' });
    const chen = await h.addAccount('chen@example.test', { role: 'manager' });
    const adaCookie = await signedIn(h.app(), 'ada@example.test');
    const chenCookie = await signedIn(h.app(), 'chen@example.test');

    const answers = await Promise.all([
      setActive(chen, adaCookie, false),
      setActive(ada, chenCookie, false),
    ]);

    expect(answers.map(({ status }) => status).sort((a, b) => a - b)).toEqual([
      200, 401,
    ]);
    const active = [await isActive(ada), await isActive(chen)];
    expect(active.filter(Boolean)).toHaveLength(1);
  });
});

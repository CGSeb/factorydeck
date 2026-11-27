import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { accountToken } from '../db/schema.ts';
import {
  type AuthHarness,
  DAY_MS,
  START,
  authHarness,
  signedIn,
} from '../test/auth-app.ts';
import { invitationClient } from '../test/invitation-client.ts';

let h: AuthHarness;

beforeEach(async () => {
  h = await authHarness();
});

afterEach(async () => {
  await h.close();
});

const { send, manager, invite, read, pendingList } = invitationClient(() => h);

describe('POST /api/team/invitations', () => {
  it('creates an invitation valid 7 days with a 32-byte token stored as its hash', async () => {
    const { cookie } = await manager();
    const created = await invite(cookie, ' Dev@Example.TEST ', 'manager');
    expect(created).toEqual({
      id: expect.any(Number) as number,
      email: 'dev@example.test',
      role: 'manager',
      invitedBy: 'Ada',
      createdAt: START.toISOString(),
      expiresAt: new Date(START.getTime() + 7 * DAY_MS).toISOString(),
      token: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) as string,
    });
    const rows = await h.db.select().from(accountToken);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe('invitation');
    expect(rows[0]?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0]?.tokenHash).not.toContain(created.token);
  });

  it.each([
    [{ role: 'dev' }, 'email', 'Email is required'],
    [
      { email: 'nope', role: 'admin' },
      'email',
      'Email must have one @ with text on both sides',
    ],
    [{ email: 'dev@example.test' }, 'role', 'Role must be manager or dev'],
    [
      { email: 'dev@example.test', role: 'Manager' },
      'role',
      'Role must be manager or dev',
    ],
  ])('answers 400 for %j and creates nothing', async (body, field, error) => {
    const { cookie } = await manager();
    const response = await send('POST', '/api/team/invitations', body, cookie);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error, field });
    expect(await h.db.select().from(accountToken)).toHaveLength(0);
  });

  it('reads a body that is not a JSON object as empty', async () => {
    const { cookie } = await manager();
    const response = await send('POST', '/api/team/invitations', [1], cookie);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Email is required',
      field: 'email',
    });
  });

  it.each([
    ['an active account', true],
    ['a deactivated account', false],
  ])('answers 409 for the email of %s', async (_, active) => {
    const { cookie } = await manager();
    await h.addAccount('dev@example.test', { active });
    const response = await send(
      'POST',
      '/api/team/invitations',
      { email: 'DEV@example.test', role: 'dev' },
      cookie,
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'This email already has an account',
    });
    expect(await h.db.select().from(accountToken)).toHaveLength(0);
  });

  it('replaces a pending invitation of the same email, whose link stops working', async () => {
    const { cookie } = await manager();
    const first = await invite(cookie);
    const second = await invite(cookie, 'dev@example.test', 'manager');
    expect((await read(first.token)).status).toBe(410);
    expect(await (await read(second.token)).json()).toEqual({
      email: 'dev@example.test',
      role: 'manager',
    });
    expect(await pendingList(cookie)).toHaveLength(1);
  });

  it('leaves one pending invitation when two are sent at the same time', async () => {
    const { cookie } = await manager();
    const responses = await Promise.all([
      send(
        'POST',
        '/api/team/invitations',
        { email: 'dev@example.test', role: 'dev' },
        cookie,
      ),
      send(
        'POST',
        '/api/team/invitations',
        { email: 'dev@example.test', role: 'dev' },
        cookie,
      ),
    ]);
    expect(responses.map((r) => r.status)).toEqual([201, 201]);
    expect(await pendingList(cookie)).toHaveLength(1);
    expect(await h.db.select().from(accountToken)).toHaveLength(1);
  });
});

describe('dev and anonymous access', () => {
  it.each([
    ['GET', '/api/team/invitations', undefined],
    ['POST', '/api/team/invitations', { email: 'x@example.test', role: 'dev' }],
    ['POST', '/api/team/invitations/1/new-link', undefined],
    ['DELETE', '/api/team/invitations/1', undefined],
  ])('refuses a dev on %s %s with 403', async (method, path, body) => {
    await h.addAccount('dev@example.test');
    const cookie = await signedIn(h.app(), 'dev@example.test');
    const response = await send(method, path, body, cookie);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Managers only' });
  });

  it('answers 401 without a session on the team routes', async () => {
    expect((await send('GET', '/api/team/invitations')).status).toBe(401);
  });

  it('answers 404 to a manager on an unknown path under invitations', async () => {
    const { cookie } = await manager();
    const response = await send(
      'GET',
      '/api/team/invitations/1/x',
      undefined,
      cookie,
    );
    expect(response.status).toBe(404);
  });
});

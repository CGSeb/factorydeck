import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { account, accountToken } from '../db/schema.ts';
import { INVITATION_LIFETIME_MS } from '../team/invitations.ts';
import {
  type AuthHarness,
  DAY_MS,
  START,
  authHarness,
  get,
  signedIn,
} from '../test/auth-app.ts';
import {
  type Created,
  NOT_FOUND,
  invitationClient,
} from '../test/invitation-client.ts';

let h: AuthHarness;

beforeEach(async () => {
  h = await authHarness();
});

afterEach(async () => {
  await h.close();
});

const { send, manager, invite, read, accept, pendingList } = invitationClient(
  () => h,
);

describe('GET /api/team/invitations', () => {
  it('lists pending invitations by soonest expiry, then email, with the inviter name', async () => {
    const ada = await manager();
    const chen = await h.addAccount('chen@example.test', {
      role: 'manager',
      name: 'Chen',
    });
    const chenCookie = await signedIn(h.app(), 'chen@example.test');
    await invite(ada.cookie, 'zed@example.test');
    await invite(chenCookie, 'bea@example.test', 'manager');
    h.clock = new Date(START.getTime() + DAY_MS);
    const later = await invite(ada.cookie, 'amy@example.test');
    const used = await invite(ada.cookie, 'used@example.test');
    expect((await accept(used.token)).status).toBe(201);
    await h.db.delete(account).where(eq(account.id, chen));

    const response = await get(h.app(), '/api/team/invitations', ada.cookie);
    expect(response.status).toBe(200);
    const expires = new Date(START.getTime() + 7 * DAY_MS).toISOString();
    expect(await response.json()).toEqual({
      status: 'ok',
      refreshSeconds: 10,
      invitations: [
        {
          id: expect.any(Number) as number,
          email: 'bea@example.test',
          role: 'manager',
          invitedBy: null,
          createdAt: START.toISOString(),
          expiresAt: expires,
        },
        {
          id: expect.any(Number) as number,
          email: 'zed@example.test',
          role: 'dev',
          invitedBy: 'Ada',
          createdAt: START.toISOString(),
          expiresAt: expires,
        },
        {
          id: later.id,
          email: 'amy@example.test',
          role: 'dev',
          invitedBy: 'Ada',
          createdAt: later.createdAt,
          expiresAt: later.expiresAt,
        },
      ],
    });
  });

  it('leaves expired invitations out but keeps their rows', async () => {
    const { cookie } = await manager();
    await invite(cookie);
    h.clock = new Date(START.getTime() + INVITATION_LIFETIME_MS);
    expect(await pendingList(cookie)).toEqual([]);
    expect(await h.db.select().from(accountToken)).toHaveLength(1);
  });

  it('keeps the invitation of a deactivated inviter working, with their name', async () => {
    const ada = await manager();
    const created = await invite(ada.cookie);
    await h.db
      .update(account)
      .set({ active: false })
      .where(eq(account.id, ada.id));
    await manager('chen@example.test', 'Chen');
    const cookie = await signedIn(h.app(), 'chen@example.test');
    expect(await pendingList(cookie)).toEqual([
      expect.objectContaining({ invitedBy: 'Ada' }),
    ]);
    expect((await read(created.token)).status).toBe(200);
  });

  it('answers 503 while the database is unreachable', async () => {
    const response = await Promise.resolve(
      h.app(false).request('/api/team/invitations', {
        headers: { cookie: 'factorydeck_session=any' },
      }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'unreachable',
      refreshSeconds: 10,
    });
  });
});

describe('new link and revoke', () => {
  it('replaces the invitation with a fresh 7 days, created by the manager who clicked', async () => {
    const ada = await manager();
    const created = await invite(ada.cookie, 'dev@example.test', 'manager');
    await manager('chen@example.test', 'Chen');
    const chenCookie = await signedIn(h.app(), 'chen@example.test');
    h.clock = new Date(START.getTime() + 2 * DAY_MS);
    const response = await send(
      'POST',
      `/api/team/invitations/${created.id}/new-link`,
      undefined,
      chenCookie,
    );
    expect(response.status).toBe(201);
    const renewed = (await response.json()) as Created;
    expect(renewed).toEqual({
      id: expect.any(Number) as number,
      email: 'dev@example.test',
      role: 'manager',
      invitedBy: 'Chen',
      createdAt: h.clock.toISOString(),
      expiresAt: new Date(h.clock.getTime() + 7 * DAY_MS).toISOString(),
      token: expect.any(String) as string,
    });
    expect(renewed.id).not.toBe(created.id);
    expect((await read(created.token)).status).toBe(410);
    expect((await read(renewed.token)).status).toBe(200);
    const rows = await h.db.select().from(accountToken);
    expect(rows.map((row) => row.id)).toEqual([renewed.id]);
  });

  it.each(['999', 'abc', '1.5', '99999999999999999999'])(
    'answers 404 to a new link on the unknown id %s',
    async (id) => {
      const { cookie } = await manager();
      const response = await send(
        'POST',
        `/api/team/invitations/${id}/new-link`,
        undefined,
        cookie,
      );
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual(NOT_FOUND);
    },
  );

  it.each(['accepted', 'expired', 'revoked'])(
    'answers 404 to a new link on an invitation %s',
    async (how) => {
      const { cookie } = await manager();
      const created = await invite(cookie);
      if (how === 'accepted') await accept(created.token);
      if (how === 'expired') {
        h.clock = new Date(START.getTime() + INVITATION_LIFETIME_MS);
      }
      if (how === 'revoked') {
        await send(
          'DELETE',
          `/api/team/invitations/${created.id}`,
          undefined,
          cookie,
        );
      }
      const response = await send(
        'POST',
        `/api/team/invitations/${created.id}/new-link`,
        undefined,
        cookie,
      );
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual(NOT_FOUND);
    },
  );

  it('revokes at once with 204, and answers 204 again once gone', async () => {
    const { cookie } = await manager();
    const created = await invite(cookie);
    const path = `/api/team/invitations/${created.id}`;
    const first = await send('DELETE', path, undefined, cookie);
    expect(first.status).toBe(204);
    expect((await read(created.token)).status).toBe(410);
    expect(await pendingList(cookie)).toEqual([]);
    expect((await send('DELETE', path, undefined, cookie)).status).toBe(204);
    expect(
      (await send('DELETE', '/api/team/invitations/abc', undefined, cookie))
        .status,
    ).toBe(204);
  });

  it('does not touch a used invitation on revoke', async () => {
    const { cookie } = await manager();
    const created = await invite(cookie);
    expect((await accept(created.token)).status).toBe(201);
    await send(
      'DELETE',
      `/api/team/invitations/${created.id}`,
      undefined,
      cookie,
    );
    const [row] = await h.db.select().from(accountToken);
    expect(row?.usedAt).not.toBeNull();
  });
});

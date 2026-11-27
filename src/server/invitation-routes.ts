import type { Context } from 'hono';
import { Hono } from 'hono';
import {
  type InvitationSource,
  invitationFields,
} from '../team/invitations.ts';
import {
  DEAD_INVITATION,
  HAS_ACCOUNT,
  INVITATION_NOT_FOUND,
  type InvitationsResponse,
} from '../team/types.ts';
import type { ApiContext } from './api-context.ts';
import { type AuthEnv, sessionToken, setSessionCookie } from './auth-routes.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function jsonObject(c: Context): Promise<Record<string, unknown>> {
  const body: unknown = await c.req.json().catch(() => undefined);
  return isRecord(body) ? body : {};
}

function idOf(value: string): number | undefined {
  if (!/^\d+$/.test(value)) return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : undefined;
}

export function teamInvitationRoutes(
  source: InvitationSource,
  {
    refreshSeconds,
    fromDatabase,
  }: Pick<ApiContext, 'refreshSeconds' | 'fromDatabase'>,
): Hono<AuthEnv> {
  const routes = new Hono<AuthEnv>();
  routes.get('/', async (c) => {
    const body: InvitationsResponse = await fromDatabase(async () => ({
      status: 'ok',
      refreshSeconds,
      invitations: await source.list(),
    }));
    return c.json(body, body.status === 'ok' ? 200 : 503);
  });
  routes.post('/', async (c) => {
    const fields = invitationFields(await jsonObject(c));
    if (!fields.ok) {
      return c.json({ error: fields.error, field: fields.field }, 400);
    }
    const by = c.get('account').id;
    const result = await fromDatabase(() => source.create(fields.value, by));
    if (result.status === 'unreachable') return c.json(result, 503);
    if (result.status === 'has-account') {
      return c.json({ error: HAS_ACCOUNT }, 409);
    }
    return c.json(result.invitation, 201);
  });
  routes.post('/:id/new-link', async (c) => {
    const id = idOf(c.req.param('id'));
    if (id === undefined) return c.json({ error: INVITATION_NOT_FOUND }, 404);
    const by = c.get('account').id;
    const result = await fromDatabase(() => source.renew(id, by));
    if (result.status === 'unreachable') return c.json(result, 503);
    if (result.status === 'not-found') {
      return c.json({ error: INVITATION_NOT_FOUND }, 404);
    }
    return c.json(result.invitation, 201);
  });
  routes.delete('/:id', async (c) => {
    const id = idOf(c.req.param('id'));
    if (id === undefined) return c.body(null, 204);
    const result = await fromDatabase(() => source.revoke(id));
    if (result !== undefined) return c.json(result, 503);
    return c.body(null, 204);
  });
  return routes;
}

export function invitationAuthRoutes(
  source: InvitationSource,
  { fromDatabase }: Pick<ApiContext, 'fromDatabase'>,
): Hono<AuthEnv> {
  const routes = new Hono<AuthEnv>();
  routes.post('/', async (c) => {
    const { token } = await jsonObject(c);
    const result = await fromDatabase(async () => ({
      invitation: await source.read(token),
    }));
    if ('status' in result) return c.json(result, 503);
    if (result.invitation === undefined) {
      return c.json({ error: DEAD_INVITATION }, 410);
    }
    return c.json(result.invitation, 200);
  });
  routes.post('/accept', async (c) => {
    const body = await jsonObject(c);
    const result = await fromDatabase(() =>
      source.accept(body, sessionToken(c)),
    );
    switch (result.status) {
      case 'unreachable':
        return c.json(result, 503);
      case 'dead':
        return c.json({ error: DEAD_INVITATION }, 410);
      case 'invalid':
        return c.json({ error: result.error, field: result.field }, 400);
      case 'created':
        setSessionCookie(c, result.sessionToken);
        return c.json(result.account, 201);
    }
  });
  return routes;
}

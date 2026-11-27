import { type Context, Hono } from 'hono';
import {
  LINK_GONE,
  type ResetReadOutcome,
  type ResetSaveOutcome,
} from '../team/reset-links.ts';
import type { ApiContext } from './api-context.ts';
import { sessionToken, setSessionCookie } from './auth-routes.ts';

export interface ResetSource {
  read: (token: unknown) => Promise<ResetReadOutcome>;
  save: (
    body: Record<string, unknown>,
    previousSession: string | undefined,
  ) => Promise<ResetSaveOutcome>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function jsonObject(c: Context): Promise<Record<string, unknown>> {
  const body: unknown = await c.req.json().catch(() => undefined);
  return isRecord(body) ? body : {};
}

function gone(c: Context): Response {
  return c.json({ error: LINK_GONE }, 410);
}

export function resetRoutes(
  resets: ResetSource,
  { fromDatabase }: ApiContext,
): Hono {
  const routes = new Hono();
  routes.post('/', async (c) => {
    const body = await jsonObject(c);
    const result = await fromDatabase(() => resets.read(body['token']));
    if (result.status === 'unreachable') return c.json(result, 503);
    if (result.status === 'gone') return gone(c);
    return c.json({ email: result.email }, 200);
  });
  routes.post('/save', async (c) => {
    const body = await jsonObject(c);
    const result = await fromDatabase(() => resets.save(body, sessionToken(c)));
    switch (result.status) {
      case 'unreachable':
        return c.json(result, 503);
      case 'gone':
        return gone(c);
      case 'invalid':
        return c.json({ error: result.error, field: result.field }, 400);
      case 'saved':
        setSessionCookie(c, result.sessionToken);
        return c.json(result.account, 200);
    }
  });
  return routes;
}

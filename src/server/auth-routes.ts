import type { Context } from 'hono';
import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import type { Setup } from '../auth/setup.ts';
import type { ApiContext } from './api-context.ts';

export type AuthSource = Pick<Setup, 'needed' | 'run'>;

export const SESSION_COOKIE = 'factorydeck_session';
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function overHttps(c: Context): boolean {
  const forwarded = c.req.header('x-forwarded-proto') ?? '';
  return (
    new URL(c.req.url).protocol === 'https:' ||
    forwarded.split(',')[0]?.trim().toLowerCase() === 'https'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function jsonObject(c: Context): Promise<Record<string, unknown>> {
  const body: unknown = await c.req.json().catch(() => undefined);
  return isRecord(body) ? body : {};
}

export function authRoutes(
  auth: AuthSource,
  { fromDatabase }: ApiContext,
): Hono {
  const routes = new Hono();
  routes.get('/state', async (c) => {
    const body = await fromDatabase(async () => ({
      setup: await auth.needed(),
    }));
    return c.json(body, 'status' in body ? 503 : 200);
  });
  routes.post('/setup', async (c) => {
    const body = await jsonObject(c);
    const result = await fromDatabase(() => auth.run(body));
    switch (result.status) {
      case 'unreachable':
        return c.json(result, 503);
      case 'already-set-up':
        return c.json({ error: 'Already set up' }, 409);
      case 'wrong-code':
        return c.json({ error: 'Wrong setup code' }, 403);
      case 'invalid':
        return c.json({ error: result.error, field: result.field }, 400);
      case 'created':
        setCookie(c, SESSION_COOKIE, result.sessionToken, {
          httpOnly: true,
          sameSite: 'Lax',
          path: '/',
          maxAge: SESSION_MAX_AGE_SECONDS,
          secure: overHttps(c),
        });
        return c.json(result.account, 201);
    }
  });
  return routes;
}

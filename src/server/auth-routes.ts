import type { Context } from 'hono';
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { SignInSessions } from '../auth/sessions.ts';
import type { Setup } from '../auth/setup.ts';
import type { Account } from '../auth/types.ts';
import type { ApiContext } from './api-context.ts';

export type AuthSource = Pick<Setup, 'needed' | 'run'> & SignInSessions;

export interface AuthEnv {
  Variables: { account: Account };
}

export const SESSION_COOKIE = 'factorydeck_session';
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function overHttps(c: Context): boolean {
  const forwarded = c.req.header('x-forwarded-proto') ?? '';
  return (
    new URL(c.req.url).protocol === 'https:' ||
    forwarded.split(',')[0]?.trim().toLowerCase() === 'https'
  );
}

function cookieOptions(c: Context) {
  return {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    secure: overHttps(c),
  } as const;
}

export function sessionToken(c: Context): string | undefined {
  return getCookie(c, SESSION_COOKIE);
}

export function setSessionCookie(c: Context, token: string): void {
  setCookie(c, SESSION_COOKIE, token, {
    ...cookieOptions(c),
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
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
): Hono<AuthEnv> {
  const routes = new Hono<AuthEnv>();
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
        setSessionCookie(c, result.sessionToken);
        return c.json(result.account, 201);
    }
  });
  routes.post('/sign-in', async (c) => {
    const body = await jsonObject(c);
    const result = await fromDatabase(() => auth.signIn(body, sessionToken(c)));
    switch (result.status) {
      case 'unreachable':
        return c.json(result, 503);
      case 'wrong':
        return c.json({ error: 'Wrong email or password' }, 401);
      case 'signed-in':
        setSessionCookie(c, result.sessionToken);
        return c.json(result.account, 200);
    }
  });
  routes.post('/sign-out', async (c) => {
    const result = await fromDatabase(() => auth.signOut(sessionToken(c)));
    if (result !== undefined) return c.json(result, 503);
    deleteCookie(c, SESSION_COOKIE, cookieOptions(c));
    return c.body(null, 204);
  });
  routes.get('/me', (c) => c.json(c.get('account')));
  return routes;
}

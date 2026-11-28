import type { Context, MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { ApiContext } from './api-context.ts';
import {
  type AuthEnv,
  type AuthSource,
  sessionToken,
  setSessionCookie,
} from './auth-routes.ts';
import { CLI_PATH_PREFIX } from './cli-routes.ts';
import { INGEST_PATH } from './ingest-routes.ts';

const OPEN_ROUTES = new Set([
  'GET /api/health',
  'GET /api/auth/state',
  'POST /api/auth/setup',
  'POST /api/auth/sign-in',
  'POST /api/auth/sign-out',
  'POST /api/auth/invitation',
  'POST /api/auth/invitation/accept',
  'POST /api/auth/reset',
  'POST /api/auth/reset/save',
]);
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
export const MAX_BODY_BYTES = 1024 * 1024;

function isOpen(c: Context): boolean {
  if (c.req.path.startsWith(CLI_PATH_PREFIX)) return true;
  const method = c.req.method === 'HEAD' ? 'GET' : c.req.method;
  return OPEN_ROUTES.has(`${method} ${c.req.path}`);
}

function ownsItsBody(c: Context): boolean {
  return c.req.method === 'POST' && c.req.path === INGEST_PATH;
}

function isJson(contentType: string | undefined): boolean {
  const mediaType = (contentType ?? '').split(';')[0] ?? '';
  return mediaType.trim().toLowerCase() === 'application/json';
}

async function hasBody(c: Context): Promise<boolean> {
  if (c.req.raw.body === null) return false;
  return (await c.req.arrayBuffer()).byteLength > 0;
}

export function bodySizeGuard(): MiddlewareHandler {
  const limit = bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: (c) => c.json({ error: 'Body too large' }, 413),
  });
  return (c, next) =>
    WRITE_METHODS.has(c.req.method) && !ownsItsBody(c)
      ? limit(c, next)
      : next();
}

export function jsonBodyGuard(): MiddlewareHandler {
  return async (c, next) => {
    if (
      WRITE_METHODS.has(c.req.method) &&
      !ownsItsBody(c) &&
      !isJson(c.req.header('content-type')) &&
      (await hasBody(c))
    ) {
      return c.json({ error: 'JSON body expected' }, 415);
    }
    return next();
  };
}

export function sessionGuard(
  auth: AuthSource,
  { fromDatabase }: ApiContext,
): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    if (isOpen(c)) return next();
    const token = sessionToken(c);
    const signedIn = await fromDatabase(async () => ({
      account: await auth.authenticate(token),
    }));
    if ('status' in signedIn) return c.json(signedIn, 503);
    if (signedIn.account === undefined) {
      return c.json({ error: 'Not signed in' }, 401);
    }
    c.set('account', signedIn.account);
    if (token !== undefined) setSessionCookie(c, token);
    return next();
  };
}

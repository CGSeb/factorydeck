import { type Context, Hono, type MiddlewareHandler } from 'hono';
import type { CliConnections, CliSignedIn } from '../cli-login/connections.ts';
import {
  LOGIN_LIFETIME_MS,
  POLL_INTERVAL_MS,
  type PendingLogins,
  formatUserCode,
} from '../cli-login/pending.ts';
import type { ApiContext } from './api-context.ts';
import { overHttps } from './auth-routes.ts';

export interface CliSource {
  logins: PendingLogins;
  connections: CliConnections;
}

export interface CliEnv {
  Variables: { cli: CliSignedIn };
}

export const CLI_PATH_PREFIX = '/api/cli/';
export const RUN_LOGIN = 'Run factorydeck login';
export const LOGIN_GONE =
  'This login is no longer valid. Run factorydeck login again.';
export const TOO_MANY_LOGINS = 'Too many pending logins, try again later';
const MAX_MACHINE = 80;
const BEARER = /^Bearer\s+(?<token>\S+)\s*$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function jsonObject(c: Context): Promise<Record<string, unknown>> {
  const body: unknown = await c.req.json().catch(() => undefined);
  return isRecord(body) ? body : {};
}

function machineError(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') {
    return 'Machine is required';
  }
  if (Array.from(value.trim()).length > MAX_MACHINE) {
    return `Machine must be at most ${MAX_MACHINE} characters`;
  }
  return undefined;
}

function originOf(c: Context): string {
  const url = new URL(c.req.url);
  const host = c.req.header('host') ?? url.host;
  return `${overHttps(c) ? 'https' : 'http'}://${host}`;
}

export function bearerToken(c: Context): string | undefined {
  return BEARER.exec(c.req.header('authorization') ?? '')?.groups?.['token'];
}

function bearerGuard(
  connections: CliConnections,
  { fromDatabase }: ApiContext,
): MiddlewareHandler<CliEnv> {
  return async (c, next) => {
    const signedIn = await fromDatabase(async () => ({
      cli: await connections.authenticate(bearerToken(c)),
    }));
    if ('status' in signedIn) return c.json(signedIn, 503);
    if (signedIn.cli === undefined) return c.json({ error: RUN_LOGIN }, 401);
    c.set('cli', signedIn.cli);
    return next();
  };
}

function loginRoutes(
  routes: Hono<CliEnv>,
  { logins, connections }: CliSource,
  { fromDatabase }: ApiContext,
): void {
  routes.post('/login', async (c) => {
    const { machine } = await jsonObject(c);
    const error = machineError(machine);
    if (error !== undefined) return c.json({ error, field: 'machine' }, 400);
    const started = logins.start(String(machine).trim());
    if (started.status === 'full') {
      return c.json({ error: TOO_MANY_LOGINS }, 503);
    }
    const userCode = formatUserCode(started.userCode);
    return c.json({
      deviceCode: started.deviceCode,
      userCode,
      verificationUrl: `${originOf(c)}/cli?code=${userCode}`,
      expiresIn: LOGIN_LIFETIME_MS / 1000,
      interval: POLL_INTERVAL_MS / 1000,
    });
  });
  routes.post('/login/poll', async (c) => {
    const { deviceCode } = await jsonObject(c);
    if (typeof deviceCode !== 'string' || deviceCode === '') {
      return c.json(
        { error: 'Device code is required', field: 'deviceCode' },
        400,
      );
    }
    const polled = logins.poll(deviceCode);
    switch (polled.status) {
      case 'slow-down':
        return c.json({ error: 'Slow down' }, 429);
      case 'gone':
        return c.json({ error: LOGIN_GONE }, 410);
      case 'pending':
        return c.json({ status: 'pending' }, 202);
      case 'approved':
        break;
    }
    const connected = await fromDatabase(() =>
      connections.connect(polled.accountId, polled.machine),
    ).catch((error: unknown) => {
      polled.undo();
      throw error;
    });
    if (connected !== undefined && 'status' in connected) {
      polled.undo();
      return c.json(connected, 503);
    }
    polled.done();
    if (connected === undefined) return c.json({ error: LOGIN_GONE }, 410);
    return c.json(connected, 200);
  });
}

export function cliRoutes(
  source: CliSource,
  context: ApiContext,
): Hono<CliEnv> {
  const routes = new Hono<CliEnv>();
  loginRoutes(routes, source, context);
  const guard = bearerGuard(source.connections, context);
  routes.get('/me', guard, (c) => {
    const { account, machine } = c.get('cli');
    return c.json({ account, machine });
  });
  routes.post('/logout', guard, async (c) => {
    const { connectionId } = c.get('cli');
    const result = await context.fromDatabase(() =>
      source.connections.disconnect(connectionId),
    );
    if (result !== undefined) return c.json(result, 503);
    return c.body(null, 204);
  });
  return routes;
}

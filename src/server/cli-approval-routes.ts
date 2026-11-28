import { type Context, Hono } from 'hono';
import { type PendingLogins, formatUserCode } from '../cli-login/pending.ts';
import type { AuthEnv } from './auth-routes.ts';

export const CODE_INVALID = 'This code is not valid or has expired.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function codeOf(c: Context): Promise<string | undefined> {
  const body: unknown = await c.req.json().catch(() => undefined);
  const code = isRecord(body) ? body['code'] : undefined;
  return typeof code === 'string' && code.trim() !== '' ? code : undefined;
}

function missingCode(c: Context): Response {
  return c.json({ error: 'Code is required', field: 'code' }, 400);
}

function invalid(c: Context): Response {
  return c.json({ error: CODE_INVALID }, 410);
}

export function cliApprovalRoutes(logins: PendingLogins): Hono<AuthEnv> {
  const routes = new Hono<AuthEnv>();
  routes.post('/', async (c) => {
    const code = await codeOf(c);
    if (code === undefined) return missingCode(c);
    const asked = logins.find(code);
    if (asked === undefined) return invalid(c);
    const { name, email } = c.get('account');
    return c.json({
      machine: asked.machine,
      userCode: formatUserCode(asked.userCode),
      account: { name, email },
    });
  });
  routes.post('/approve', async (c) => {
    const code = await codeOf(c);
    if (code === undefined) return missingCode(c);
    return logins.approve(code, c.get('account').id)
      ? c.body(null, 204)
      : invalid(c);
  });
  routes.post('/cancel', async (c) => {
    const code = await codeOf(c);
    if (code === undefined) return missingCode(c);
    return logins.cancel(code) ? c.body(null, 204) : invalid(c);
  });
  return routes;
}

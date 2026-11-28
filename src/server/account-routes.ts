import { Hono } from 'hono';
import type { CliConnections } from '../cli-login/connections.ts';
import {
  CONNECTION_NOT_FOUND,
  type CliConnectionsResponse,
} from '../cli-login/connection-types.ts';
import type { ApiContext } from './api-context.ts';
import type { AuthEnv } from './auth-routes.ts';

const ID = /^[1-9]\d{0,15}$/;

function idOf(value: string): number | undefined {
  if (!ID.test(value)) return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : undefined;
}

export function accountRoutes(
  connections: CliConnections,
  { refreshSeconds, fromDatabase }: ApiContext,
): Hono<AuthEnv> {
  const routes = new Hono<AuthEnv>();
  routes.get('/cli-connections', async (c) => {
    const accountId = c.get('account').id;
    const body: CliConnectionsResponse = await fromDatabase(async () => ({
      status: 'ok',
      refreshSeconds,
      connections: await connections.list(accountId),
    }));
    return c.json(body, body.status === 'ok' ? 200 : 503);
  });
  routes.delete('/cli-connections/:id', async (c) => {
    const id = idOf(c.req.param('id'));
    if (id === undefined) return c.json({ error: CONNECTION_NOT_FOUND }, 404);
    const accountId = c.get('account').id;
    const removed = await fromDatabase(() => connections.remove(accountId, id));
    if (removed !== true && removed !== false) return c.json(removed, 503);
    return removed
      ? c.body(null, 204)
      : c.json({ error: CONNECTION_NOT_FOUND }, 404);
  });
  return routes;
}

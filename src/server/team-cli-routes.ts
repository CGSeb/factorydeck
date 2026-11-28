import type { Context, Hono } from 'hono';
import { accountIdOf } from '../team/account-change.ts';
import type { TeamCliConnections } from '../team/cli-connections.ts';
import type { TeamCliConnectionsResponse } from '../team/types.ts';
import type { ApiContext } from './api-context.ts';
import type { AuthEnv } from './auth-routes.ts';

function notFound(c: Context): Response {
  return c.json({ error: 'Not found' }, 404);
}

export function addTeamCliRoutes(
  routes: Hono<AuthEnv>,
  connections: TeamCliConnections | undefined,
  {
    refreshSeconds,
    fromDatabase,
  }: Pick<ApiContext, 'refreshSeconds' | 'fromDatabase'>,
): void {
  if (connections === undefined) return;
  routes.get('/accounts/:id/cli-connections', async (c) => {
    const accountId = accountIdOf(c.req.param('id'));
    if (accountId === undefined) return notFound(c);
    const found = await fromDatabase(() => connections.list(accountId));
    if (found === undefined) return notFound(c);
    if (!Array.isArray(found)) return c.json(found, 503);
    const body: TeamCliConnectionsResponse = {
      status: 'ok',
      refreshSeconds,
      connections: found,
    };
    return c.json(body, 200);
  });
  routes.delete('/accounts/:id/cli-connections/:connection', async (c) => {
    const accountId = accountIdOf(c.req.param('id'));
    const connectionId = accountIdOf(c.req.param('connection'));
    if (accountId === undefined || connectionId === undefined) {
      return notFound(c);
    }
    const deleted = await fromDatabase(() =>
      connections.disconnect(accountId, connectionId),
    );
    if (deleted === true) return c.body(null, 204);
    if (deleted === false) return notFound(c);
    return c.json(deleted, 503);
  });
}

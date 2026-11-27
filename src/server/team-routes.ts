import { Hono } from 'hono';
import {
  MANAGERS_ONLY,
  type TeamAccount,
  type TeamResponse,
} from '../team/types.ts';
import type { ApiContext } from './api-context.ts';
import type { AuthEnv } from './auth-routes.ts';

export interface TeamSource {
  accounts: () => Promise<TeamAccount[]>;
}

export function teamRoutes(
  team: TeamSource | undefined,
  { refreshSeconds, fromDatabase }: ApiContext,
): Hono<AuthEnv> {
  const routes = new Hono<AuthEnv>();
  routes.use('*', async (c, next) => {
    if (c.get('account').role !== 'manager') {
      return c.json({ error: MANAGERS_ONLY }, 403);
    }
    return next();
  });
  if (team !== undefined) {
    routes.get('/accounts', async (c) => {
      const you = c.get('account').id;
      const body: TeamResponse = await fromDatabase(async () => ({
        status: 'ok',
        refreshSeconds,
        accounts: (await team.accounts()).map((row) => ({
          ...row,
          you: row.id === you,
        })),
      }));
      return c.json(body, body.status === 'ok' ? 200 : 503);
    });
  }
  routes.all('*', (c) => c.json({ error: 'Not found' }, 404));
  return routes;
}

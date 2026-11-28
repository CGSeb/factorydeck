import { Hono } from 'hono';
import type { RoleList, RoleListResponse, RoleQuery } from '../roles/types.ts';
import type { ApiContext } from './api-context.ts';
import { INVALID_QUERY, skillQuery } from './skill-routes.ts';

export interface RoleSource {
  list: (query: RoleQuery) => Promise<RoleList>;
}

export function roleRoutes(
  roles: RoleSource,
  { refreshSeconds, updatedAt, fromDatabase }: ApiContext,
): Hono {
  const routes = new Hono();
  routes.get('/', async (c) => {
    const query = skillQuery((name) => c.req.query(name));
    if (query === undefined) return c.json(INVALID_QUERY, 400);
    const body: RoleListResponse = await fromDatabase(async () => {
      const list = await roles.list(query);
      return {
        status: 'ok',
        updatedAt: updatedAt(),
        refreshSeconds,
        list,
      };
    });
    return c.json(body, body.status === 'ok' ? 200 : 503);
  });
  return routes;
}

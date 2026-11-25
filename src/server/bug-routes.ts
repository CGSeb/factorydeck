import { Hono } from 'hono';
import type { BugListResponse } from '../bugs/types.ts';
import type { ApiContext } from './api-context.ts';
import type { FeatureSource } from './feature-routes.ts';
import { INVALID_QUERY, skillQuery } from './skill-routes.ts';

export function bugRoutes(
  features: FeatureSource,
  { refreshSeconds, updatedAt, fromDatabase }: ApiContext,
): Hono {
  const routes = new Hono();
  routes.get('/', async (c) => {
    const query = skillQuery((name) => c.req.query(name));
    if (query === undefined) return c.json(INVALID_QUERY, 400);
    const body: BugListResponse = await fromDatabase(async () => {
      const list = await features.bugs(query);
      return { status: 'ok', updatedAt: updatedAt(), refreshSeconds, list };
    });
    return c.json(body, body.status === 'ok' ? 200 : 503);
  });
  return routes;
}

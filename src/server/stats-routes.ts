import { Hono } from 'hono';
import type { AutonomyQuery } from '../stats/autonomy.ts';
import type { AutonomyResponse, AutonomyStats } from '../stats/types.ts';
import type { ApiContext } from './api-context.ts';
import { INVALID_QUERY, skillQuery } from './skill-routes.ts';

export interface StatsSource {
  autonomy: (query: AutonomyQuery) => Promise<AutonomyStats>;
}

export function statsRoutes(
  stats: StatsSource,
  { refreshSeconds, updatedAt, fromDatabase }: ApiContext,
): Hono {
  const routes = new Hono();
  routes.get('/autonomy', async (c) => {
    const query = skillQuery((name) => c.req.query(name));
    if (query === undefined) return c.json(INVALID_QUERY, 400);
    const body: AutonomyResponse = await fromDatabase(async () => {
      const autonomy = await stats.autonomy(query);
      return { status: 'ok', updatedAt: updatedAt(), refreshSeconds, autonomy };
    });
    return c.json(body, body.status === 'ok' ? 200 : 503);
  });
  return routes;
}

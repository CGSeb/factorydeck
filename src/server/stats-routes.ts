import { Hono } from 'hono';
import type { AutonomyQuery } from '../stats/autonomy.ts';
import type { FlowQuery } from '../stats/flow.ts';
import type { QualityQuery } from '../stats/quality.ts';
import type {
  AutonomyResponse,
  AutonomyStats,
  FlowResponse,
  FlowStats,
  QualityResponse,
  QualityStats,
  WaitingList,
  WaitingResponse,
} from '../stats/types.ts';
import type { ApiContext } from './api-context.ts';
import type { FrictionSource } from './friction-routes.ts';
import { INVALID_QUERY, skillQuery } from './skill-routes.ts';

export interface StatsSource extends FrictionSource {
  autonomy: (query: AutonomyQuery) => Promise<AutonomyStats>;
  quality: (query: QualityQuery) => Promise<QualityStats>;
  flow: (query: FlowQuery) => Promise<FlowStats>;
  waiting: (project: string | undefined) => Promise<WaitingList>;
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
  routes.get('/quality', async (c) => {
    const query = skillQuery((name) => c.req.query(name));
    if (query === undefined) return c.json(INVALID_QUERY, 400);
    const body: QualityResponse = await fromDatabase(async () => {
      const quality = await stats.quality(query);
      return { status: 'ok', updatedAt: updatedAt(), refreshSeconds, quality };
    });
    return c.json(body, body.status === 'ok' ? 200 : 503);
  });
  routes.get('/flow', async (c) => {
    const query = skillQuery((name) => c.req.query(name));
    if (query === undefined) return c.json(INVALID_QUERY, 400);
    const body: FlowResponse = await fromDatabase(async () => {
      const flow = await stats.flow(query);
      return { status: 'ok', updatedAt: updatedAt(), refreshSeconds, flow };
    });
    return c.json(body, body.status === 'ok' ? 200 : 503);
  });
  routes.get('/waiting', async (c) => {
    const project = c.req.query('project') || undefined;
    const body: WaitingResponse = await fromDatabase(async () => {
      const waiting = await stats.waiting(project);
      return { status: 'ok', updatedAt: updatedAt(), refreshSeconds, waiting };
    });
    return c.json(body, body.status === 'ok' ? 200 : 503);
  });
  return routes;
}

import { Hono } from 'hono';
import type { FactoryResponse, FactoryStatus } from '../projects/types.ts';
import type { ApiContext } from './api-context.ts';

export interface ProjectSource {
  factoryStatus: () => Promise<FactoryStatus>;
}

export function projectRoutes(
  projects: ProjectSource,
  { refreshSeconds, fromDatabase }: ApiContext,
): Hono {
  const routes = new Hono();
  routes.get('/factory', async (c) => {
    const body: FactoryResponse = await fromDatabase(async () => ({
      status: 'ok',
      refreshSeconds,
      ...(await projects.factoryStatus()),
    }));
    return c.json(body, body.status === 'ok' ? 200 : 503);
  });
  return routes;
}

import { Hono } from 'hono';
import type { ReadyCounts, SidebarResponse } from '../sidebar/types.ts';
import type { ApiContext } from './api-context.ts';

export interface SidebarSource {
  ready: (project: string | undefined) => Promise<ReadyCounts>;
}

export function sidebarRoutes(
  sidebar: SidebarSource,
  { fromDatabase }: ApiContext,
): Hono {
  const routes = new Hono();
  routes.get('/', async (c) => {
    const project = c.req.query('project') || undefined;
    const body: SidebarResponse = await fromDatabase(async () => ({
      ready: await sidebar.ready(project),
    }));
    return c.json(body, 'ready' in body ? 200 : 503);
  });
  return routes;
}

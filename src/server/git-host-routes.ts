import { Hono } from 'hono';
import type {
  CollectionResponse,
  CollectionStatus,
} from '../git-host/types.ts';
import type { ApiContext } from './api-context.ts';

export interface GitHostSource {
  status: () => Promise<CollectionStatus>;
  refresh: () => Promise<void>;
}

export function gitHostRoutes(
  gitHost: GitHostSource,
  { refreshSeconds, fromDatabase }: ApiContext,
): Hono {
  const routes = new Hono();
  async function reply(): Promise<CollectionResponse> {
    return fromDatabase(async () => ({
      status: 'ok',
      refreshSeconds,
      ...(await gitHost.status()),
    }));
  }
  routes.get('/', async (c) => {
    const body = await reply();
    return c.json(body, body.status === 'ok' ? 200 : 503);
  });
  routes.post('/refresh', async (c) => {
    await gitHost.refresh();
    const body = await reply();
    return c.json(body, body.status === 'ok' ? 200 : 503);
  });
  return routes;
}

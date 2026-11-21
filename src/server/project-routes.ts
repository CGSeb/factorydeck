import { Hono } from 'hono';
import type {
  DeleteProjectResponse,
  DeleteResult,
  FactoryResponse,
  FactoryStatus,
} from '../projects/types.ts';
import type { ApiContext } from './api-context.ts';

export interface ProjectSource {
  factoryStatus: () => Promise<FactoryStatus>;
  remove: (project: string) => Promise<DeleteResult>;
}

const DELETE_CODES = {
  deleted: 200,
  'has-factory': 409,
  'not-found': 404,
  unreachable: 503,
} as const;

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
  routes.delete('/', async (c) => {
    const project = c.req.query('project') ?? '';
    if (project === '') {
      return c.json({ error: 'Expected a project query parameter' }, 400);
    }
    const body: DeleteProjectResponse = await fromDatabase(async () => ({
      status: await projects.remove(project),
    }));
    return c.json(body, DELETE_CODES[body.status]);
  });
  return routes;
}

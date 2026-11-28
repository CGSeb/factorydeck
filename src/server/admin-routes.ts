import { type Context, Hono } from 'hono';
import { type ProjectsResponse, remoteTaken } from '../team/project-types.ts';
import { type ProjectStore, projectFields } from '../team/projects.ts';
import { MANAGERS_ONLY } from '../team/types.ts';
import type { ApiContext } from './api-context.ts';
import type { AuthEnv } from './auth-routes.ts';

export interface AdminSource {
  projects?: ProjectStore | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function jsonObject(c: Context): Promise<Record<string, unknown>> {
  const body: unknown = await c.req.json().catch(() => undefined);
  return isRecord(body) ? body : {};
}

function projectRoutes(
  store: ProjectStore,
  { refreshSeconds, fromDatabase }: ApiContext,
): Hono<AuthEnv> {
  const routes = new Hono<AuthEnv>();
  routes.get('/', async (c) => {
    const body: ProjectsResponse = await fromDatabase(async () => ({
      status: 'ok',
      refreshSeconds,
      projects: await store.list(),
    }));
    return c.json(body, body.status === 'ok' ? 200 : 503);
  });
  routes.post('/', async (c) => {
    const fields = projectFields(await jsonObject(c));
    if (!fields.ok) {
      return c.json({ error: fields.error, field: fields.field }, 400);
    }
    const by = c.get('account').id;
    const result = await fromDatabase(() => store.add(fields.value, by));
    if (result.status === 'unreachable') return c.json(result, 503);
    if (result.status === 'exists') {
      return c.json({ error: remoteTaken(result.name) }, 409);
    }
    return c.json(result.project, 201);
  });
  return routes;
}

export function adminRoutes(
  admin: AdminSource | undefined,
  context: ApiContext,
): Hono<AuthEnv> {
  const routes = new Hono<AuthEnv>();
  routes.use('*', async (c, next) => {
    if (c.get('account').role !== 'manager') {
      return c.json({ error: MANAGERS_ONLY }, 403);
    }
    return next();
  });
  if (admin?.projects !== undefined) {
    routes.route('/projects', projectRoutes(admin.projects, context));
  }
  routes.all('*', (c) => c.json({ error: 'Not found' }, 404));
  return routes;
}

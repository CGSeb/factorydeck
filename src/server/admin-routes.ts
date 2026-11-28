import { type Context, Hono } from 'hono';
import type { StoredRoleRule } from '../roles/default-roles.ts';
import type { RoleRuleStore } from '../roles/project-rules.ts';
import { roleRuleFields } from '../roles/rule-fields.ts';
import {
  BUSY,
  type ProjectsResponse,
  remoteTaken,
} from '../team/project-types.ts';
import {
  type ProjectStore,
  projectChanges,
  projectFields,
} from '../team/projects.ts';
import { MANAGERS_ONLY } from '../team/types.ts';
import type { ApiContext } from './api-context.ts';
import type { AuthEnv } from './auth-routes.ts';

export interface AdminSource {
  projects?: ProjectStore | undefined;
  roleRules?: RoleRuleStore | undefined;
}

export type RoleRulesResponse =
  | { status: 'ok'; refreshSeconds: number; rules: StoredRoleRule[] }
  | { status: 'unreachable'; refreshSeconds: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const NOT_FOUND = { error: 'Not found' };

function projectId(value: string): number | undefined {
  if (!/^[1-9][0-9]*$/.test(value)) return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : undefined;
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
  routes.patch('/:id', async (c) => {
    const id = projectId(c.req.param('id'));
    if (id === undefined) return c.json(NOT_FOUND, 404);
    const fields = projectChanges(await jsonObject(c));
    const result = await fromDatabase(() =>
      store.update(id, fields.ok ? fields.value : {}),
    );
    if (result.status === 'unreachable') return c.json(result, 503);
    if (result.status === 'missing') return c.json(NOT_FOUND, 404);
    if (!fields.ok) {
      return c.json({ error: fields.error, field: fields.field }, 400);
    }
    if (result.status === 'exists') {
      return c.json({ error: remoteTaken(result.name) }, 409);
    }
    return c.json(result.project, 200);
  });
  routes.delete('/:id', async (c) => {
    const id = projectId(c.req.param('id'));
    if (id === undefined) return c.json(NOT_FOUND, 404);
    const result = await fromDatabase(() => store.remove(id));
    if (result === 'removed') return c.body(null, 204);
    if (result === 'not-found') return c.json(NOT_FOUND, 404);
    if (result === 'busy') return c.json({ error: BUSY }, 503);
    return c.json(result, 503);
  });
  return routes;
}

function roleRuleRoutes(
  store: RoleRuleStore,
  { refreshSeconds, fromDatabase }: ApiContext,
): Hono<AuthEnv> {
  const routes = new Hono<AuthEnv>();
  routes.get('/:id/rules/role', async (c) => {
    const id = projectId(c.req.param('id'));
    if (id === undefined) return c.json(NOT_FOUND, 404);
    const rules = await fromDatabase(() => store.rules(id));
    if (rules === undefined) return c.json(NOT_FOUND, 404);
    if ('status' in rules) return c.json(rules, 503);
    const body: RoleRulesResponse = { status: 'ok', refreshSeconds, rules };
    return c.json(body, 200);
  });
  routes.put('/:id/rules/role', async (c) => {
    const id = projectId(c.req.param('id'));
    if (id === undefined) return c.json(NOT_FOUND, 404);
    const fields = roleRuleFields(await jsonObject(c));
    const rules = await fromDatabase(() =>
      fields.ok ? store.replace(id, fields.rules) : store.rules(id),
    );
    if (rules === undefined) return c.json(NOT_FOUND, 404);
    if ('status' in rules) return c.json(rules, 503);
    if (!fields.ok) {
      const { error, rule, field } = fields;
      return c.json(
        { error, ...(rule === undefined ? {} : { rule }), field },
        400,
      );
    }
    return c.json({ rules }, 200);
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
  if (admin?.roleRules !== undefined) {
    routes.route('/projects', roleRuleRoutes(admin.roleRules, context));
  }
  if (admin?.projects !== undefined) {
    routes.route('/projects', projectRoutes(admin.projects, context));
  }
  routes.all('*', (c) => c.json({ error: 'Not found' }, 404));
  return routes;
}

import { Hono } from 'hono';
import type { FrictionQuery } from '../frictions/query.ts';
import {
  type FrictionStats,
  type FrictionsResponse,
  frictionFilterOf,
  parseKind,
  parseRole,
} from '../frictions/types.ts';
import type { ApiContext } from './api-context.ts';
import { INVALID_QUERY, skillQuery } from './skill-routes.ts';

export interface FrictionSource {
  frictions: (query: FrictionQuery) => Promise<FrictionStats>;
}

export function frictionRoutes(
  source: FrictionSource,
  { refreshSeconds, updatedAt, fromDatabase }: ApiContext,
): Hono {
  const routes = new Hono();
  routes.get('/', async (c) => {
    const query = skillQuery((name) => c.req.query(name));
    if (query === undefined) return c.json(INVALID_QUERY, 400);
    const kind = parseKind(c.req.query('kind'));
    const role = parseRole(c.req.query('role'));
    const filter = frictionFilterOf({
      session: c.req.query('session'),
      issue: c.req.query('issue'),
      project: query.project,
    });
    const body: FrictionsResponse = await fromDatabase(async () => {
      const frictions = await source.frictions({
        ...query,
        kind,
        role,
        filter,
      });
      return {
        status: 'ok',
        updatedAt: updatedAt(),
        refreshSeconds,
        frictions,
      };
    });
    return c.json(body, body.status === 'ok' ? 200 : 503);
  });
  return routes;
}

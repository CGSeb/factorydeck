import { type Context, Hono } from 'hono';
import {
  type FrictionOccurrence,
  type FullOutput,
  type FullOutputResponse,
  type OccurrencesResponse,
  parseOccurrenceRow,
} from '../frictions/occurrence-types.ts';
import type { OccurrenceQuery } from '../frictions/occurrences.ts';
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
  occurrences: (query: OccurrenceQuery) => Promise<FrictionOccurrence[]>;
  output: (id: number) => Promise<FullOutput | undefined>;
}

export const INVALID_OCCURRENCE_ROW = {
  error: 'Expected a table and one of its rows',
};

export const INVALID_FRICTION_ID = { error: 'Expected a friction id' };

export const UNKNOWN_FRICTION = { error: 'No such friction' };

const FRICTION_ID = /^[1-9]\d*$/;

export function parseFrictionId(value: string): number | undefined {
  if (!FRICTION_ID.test(value)) return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : undefined;
}

function frictionQuery(c: Context): FrictionQuery | undefined {
  const query = skillQuery((name) => c.req.query(name));
  if (query === undefined) return undefined;
  return {
    ...query,
    kind: parseKind(c.req.query('kind')),
    role: parseRole(c.req.query('role')),
    filter: frictionFilterOf({
      session: c.req.query('session'),
      issue: c.req.query('issue'),
      project: query.project,
    }),
  };
}

export function frictionRoutes(
  source: FrictionSource,
  { refreshSeconds, updatedAt, fromDatabase }: ApiContext,
): Hono {
  const routes = new Hono();
  routes.get('/', async (c) => {
    const query = frictionQuery(c);
    if (query === undefined) return c.json(INVALID_QUERY, 400);
    const body: FrictionsResponse = await fromDatabase(async () => {
      const frictions = await source.frictions(query);
      return {
        status: 'ok',
        updatedAt: updatedAt(),
        refreshSeconds,
        frictions,
      };
    });
    return c.json(body, body.status === 'ok' ? 200 : 503);
  });
  routes.get('/occurrences', async (c) => {
    const query = frictionQuery(c);
    if (query === undefined) return c.json(INVALID_QUERY, 400);
    const row = parseOccurrenceRow(c.req.query('table'), c.req.query('row'));
    if (row === undefined) return c.json(INVALID_OCCURRENCE_ROW, 400);
    const body: OccurrencesResponse = await fromDatabase(async () => ({
      status: 'ok',
      occurrences: await source.occurrences({ ...query, row }),
    }));
    return c.json(body, body.status === 'ok' ? 200 : 503);
  });
  routes.get('/:id/output', async (c) => {
    const id = parseFrictionId(c.req.param('id'));
    if (id === undefined) return c.json(INVALID_FRICTION_ID, 400);
    const output = await fromDatabase(() => source.output(id));
    if (output === undefined) return c.json(UNKNOWN_FRICTION, 404);
    if ('status' in output) return c.json(output, 503);
    const body: FullOutputResponse = { status: 'ok', ...output };
    return c.json(body);
  });
  return routes;
}

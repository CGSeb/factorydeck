import { Hono } from 'hono';
import type { BugList } from '../bugs/types.ts';
import {
  type FeatureDetail,
  type FeatureList,
  type FeatureListResponse,
  type FeatureQuery,
  type FeatureResponse,
  INVALID_VERSION,
  issueNumber,
} from '../features/types.ts';
import { isIssueKind } from '../git-host/kind.ts';
import type { ApiContext } from './api-context.ts';
import { INVALID_QUERY, skillQuery } from './skill-routes.ts';

export interface FeatureSource {
  list: (query: FeatureQuery) => Promise<FeatureList>;
  detail: (
    key: { project: string; number: number },
    query: FeatureQuery & { version?: number | undefined },
  ) => Promise<FeatureDetail | typeof INVALID_VERSION | undefined>;
  bugs: (query: FeatureQuery) => Promise<BugList>;
}

function invalidVersion(refreshSeconds: number): FeatureResponse {
  return {
    status: 'invalid-version',
    error: 'Expected version to be a version of a bug, from 1 to its count',
    refreshSeconds,
  };
}

export function featureRoutes(
  features: FeatureSource,
  { refreshSeconds, updatedAt, fromDatabase }: ApiContext,
): Hono {
  const routes = new Hono();
  routes.get('/', async (c) => {
    const query = skillQuery((name) => c.req.query(name));
    const kind = c.req.query('kind');
    if (query === undefined) return c.json(INVALID_QUERY, 400);
    if (kind !== undefined && !isIssueKind(kind)) {
      return c.json({ error: 'Expected kind to be feature or bug' }, 400);
    }
    const body: FeatureListResponse = await fromDatabase(async () => {
      const list = await features.list(
        kind === undefined ? query : { ...query, kind },
      );
      return { status: 'ok', updatedAt: updatedAt(), refreshSeconds, list };
    });
    return c.json(body, body.status === 'ok' ? 200 : 503);
  });
  routes.get('/:number', async (c) => {
    const query = skillQuery((name) => c.req.query(name));
    const number = issueNumber(c.req.param('number'));
    const project = query?.project;
    if (query === undefined || number === undefined || project === undefined) {
      return c.json(
        { error: 'Expected an issue number, period, tz and project' },
        400,
      );
    }
    const raw = c.req.query('version');
    const version = raw === undefined ? undefined : issueNumber(raw);
    if (raw !== undefined && version === undefined) {
      return c.json(invalidVersion(refreshSeconds), 400);
    }
    const body: FeatureResponse = await fromDatabase(async () => {
      const feature = await features.detail(
        { project, number },
        {
          ...query,
          version,
        },
      );
      if (feature === INVALID_VERSION) return invalidVersion(refreshSeconds);
      return feature === undefined
        ? { status: 'not-found', refreshSeconds }
        : { status: 'ok', updatedAt: updatedAt(), refreshSeconds, feature };
    });
    const code = {
      ok: 200,
      'not-found': 404,
      'invalid-version': 400,
      unreachable: 503,
    } as const;
    return c.json(body, code[body.status]);
  });
  return routes;
}

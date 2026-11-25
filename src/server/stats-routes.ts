import { Hono } from 'hono';
import { type IssueKind, isIssueKind } from '../git-host/kind.ts';
import type { AutonomyQuery } from '../stats/autonomy.ts';
import type { BugQuery } from '../stats/bugs.ts';
import type { FlowQuery } from '../stats/flow.ts';
import type { QualityQuery } from '../stats/quality.ts';
import type {
  AutonomyResponse,
  AutonomyStats,
  BugResponse,
  BugStats,
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
  bugs: (query: BugQuery) => Promise<BugStats>;
  waiting: (
    project: string | undefined,
    kind?: IssueKind,
  ) => Promise<WaitingList>;
}

export const INVALID_KIND = { error: 'Expected kind to be feature or bug' };

type Read = (name: string) => string | undefined;

function kindQuery(read: Read): IssueKind | undefined | null {
  const kind = read('kind');
  if (kind === undefined) return undefined;
  return isIssueKind(kind) ? kind : null;
}

function statsQuery(read: Read): AutonomyQuery | undefined | null {
  const query = skillQuery(read);
  if (query === undefined) return undefined;
  const kind = kindQuery(read);
  if (kind === null) return null;
  return kind === undefined ? query : { ...query, kind };
}

export function statsRoutes(
  stats: StatsSource,
  { refreshSeconds, updatedAt, fromDatabase }: ApiContext,
): Hono {
  const routes = new Hono();
  routes.get('/autonomy', async (c) => {
    const query = statsQuery((name) => c.req.query(name));
    if (query === undefined) return c.json(INVALID_QUERY, 400);
    if (query === null) return c.json(INVALID_KIND, 400);
    const body: AutonomyResponse = await fromDatabase(async () => {
      const autonomy = await stats.autonomy(query);
      return { status: 'ok', updatedAt: updatedAt(), refreshSeconds, autonomy };
    });
    return c.json(body, body.status === 'ok' ? 200 : 503);
  });
  routes.get('/quality', async (c) => {
    const query = statsQuery((name) => c.req.query(name));
    if (query === undefined) return c.json(INVALID_QUERY, 400);
    if (query === null) return c.json(INVALID_KIND, 400);
    const body: QualityResponse = await fromDatabase(async () => {
      const quality = await stats.quality(query);
      return { status: 'ok', updatedAt: updatedAt(), refreshSeconds, quality };
    });
    return c.json(body, body.status === 'ok' ? 200 : 503);
  });
  routes.get('/flow', async (c) => {
    const query = statsQuery((name) => c.req.query(name));
    if (query === undefined) return c.json(INVALID_QUERY, 400);
    if (query === null) return c.json(INVALID_KIND, 400);
    const body: FlowResponse = await fromDatabase(async () => {
      const flow = await stats.flow(query);
      return { status: 'ok', updatedAt: updatedAt(), refreshSeconds, flow };
    });
    return c.json(body, body.status === 'ok' ? 200 : 503);
  });
  routes.get('/bugs', async (c) => {
    const query = skillQuery((name) => c.req.query(name));
    if (query === undefined) return c.json(INVALID_QUERY, 400);
    const body: BugResponse = await fromDatabase(async () => {
      const bugs = await stats.bugs(query);
      return { status: 'ok', updatedAt: updatedAt(), refreshSeconds, bugs };
    });
    return c.json(body, body.status === 'ok' ? 200 : 503);
  });
  routes.get('/waiting', async (c) => {
    const project = c.req.query('project') || undefined;
    const kind = kindQuery((name) => c.req.query(name));
    if (kind === null) return c.json(INVALID_KIND, 400);
    const body: WaitingResponse = await fromDatabase(async () => {
      const waiting = await stats.waiting(project, kind);
      return { status: 'ok', updatedAt: updatedAt(), refreshSeconds, waiting };
    });
    return c.json(body, body.status === 'ok' ? 200 : 503);
  });
  return routes;
}

import { Hono } from 'hono';
import { isPeriod } from '../overview/types.ts';
import type {
  SkillDetail,
  SkillList,
  SkillListResponse,
  SkillQuery,
  SkillResponse,
} from '../skills/types.ts';
import { type ApiContext, isTimeZone } from './api-context.ts';

export interface SkillSource {
  list: (query: SkillQuery) => Promise<SkillList>;
  detail: (skill: string, query: SkillQuery) => Promise<SkillDetail>;
}

export function skillQuery(
  read: (name: string) => string | undefined,
): SkillQuery | undefined {
  const period = read('period');
  const timeZone = read('tz') ?? '';
  const project = read('project') || undefined;
  if (!isPeriod(period) || !isTimeZone(timeZone)) return undefined;
  return { period, timeZone, project };
}

export const INVALID_QUERY = {
  error: 'Expected period, tz, and optional project',
};

export function skillRoutes(
  skills: SkillSource,
  { refreshSeconds, updatedAt, fromDatabase }: ApiContext,
): Hono {
  const routes = new Hono();
  routes.get('/', async (c) => {
    const query = skillQuery((name) => c.req.query(name));
    if (query === undefined) return c.json(INVALID_QUERY, 400);
    const body: SkillListResponse = await fromDatabase(async () => {
      const list = await skills.list(query);
      return { status: 'ok', updatedAt: updatedAt(), refreshSeconds, list };
    });
    return c.json(body, body.status === 'ok' ? 200 : 503);
  });
  routes.get('/:name', async (c) => {
    const query = skillQuery((name) => c.req.query(name));
    if (query === undefined) return c.json(INVALID_QUERY, 400);
    const name = c.req.param('name');
    const body: SkillResponse = await fromDatabase(async () => {
      const skill = await skills.detail(name, query);
      return { status: 'ok', updatedAt: updatedAt(), refreshSeconds, skill };
    });
    return c.json(body, body.status === 'ok' ? 200 : 503);
  });
  return routes;
}

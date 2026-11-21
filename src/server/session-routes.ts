import { Hono } from 'hono';
import { isPeriod } from '../overview/types.ts';
import {
  SESSION_MAX_ROWS,
  SESSION_PAGE_SIZE,
  type SessionDetail,
  type SessionList,
  type SessionListQuery,
  type SessionListResponse,
  type SessionResponse,
  isSessionState,
} from '../sessions/types.ts';
import { type ApiContext, isTimeZone } from './api-context.ts';

export interface SessionSource {
  list: (query: SessionListQuery) => Promise<SessionList>;
  detail: (id: string) => Promise<SessionDetail | undefined>;
}

function listQuery(
  read: (name: string) => string | undefined,
): SessionListQuery | undefined {
  const period = read('period');
  const timeZone = read('tz') ?? '';
  const project = read('project') || undefined;
  const state = read('state') || undefined;
  const limit = Number(read('limit') ?? SESSION_PAGE_SIZE);
  if (
    !isPeriod(period) ||
    !isTimeZone(timeZone) ||
    (state !== undefined && !isSessionState(state)) ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > SESSION_MAX_ROWS
  ) {
    return undefined;
  }
  return { period, timeZone, project, state, limit };
}

export function sessionRoutes(
  sessions: SessionSource,
  { refreshSeconds, updatedAt, fromDatabase }: ApiContext,
): Hono {
  const routes = new Hono();
  routes.get('/', async (c) => {
    const query = listQuery((name) => c.req.query(name));
    if (query === undefined) {
      return c.json(
        { error: 'Expected period, tz, and optional project, state, limit' },
        400,
      );
    }
    const body: SessionListResponse = await fromDatabase(async () => ({
      status: 'ok',
      updatedAt: updatedAt(),
      refreshSeconds,
      list: await sessions.list(query),
    }));
    return c.json(body, body.status === 'ok' ? 200 : 503);
  });
  routes.get('/:id', async (c) => {
    const id = c.req.param('id');
    const body: SessionResponse = await fromDatabase(async () => {
      const session = await sessions.detail(id);
      return session === undefined
        ? { status: 'not-found', refreshSeconds }
        : { status: 'ok', updatedAt: updatedAt(), refreshSeconds, session };
    });
    const code = { ok: 200, 'not-found': 404, unreachable: 503 } as const;
    return c.json(body, code[body.status]);
  });
  return routes;
}

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import type { OverviewQuery } from '../overview/query.ts';
import {
  type OverviewResponse,
  type UsageOverview,
  isPeriod,
} from '../overview/types.ts';
import { apiContext, isTimeZone } from './api-context.ts';
import type { DatabaseCheck } from './health.ts';
import { type SessionSource, sessionRoutes } from './session-routes.ts';
import { type SkillSource, skillRoutes } from './skill-routes.ts';

export interface OverviewSource {
  load: (query: OverviewQuery) => Promise<UsageOverview>;
  sessionsFolder: string;
  refreshSeconds: number;
  updatedAt: () => Date | undefined;
}

export interface AppOptions {
  checkDatabase: DatabaseCheck;
  /** Folder of the built UI; when it holds no `index.html`, the UI is reported as not built. */
  uiDir: string;
  overview: OverviewSource;
  sessions: SessionSource;
  skills: SkillSource;
}

/** The FactoryDeck HTTP app: the JSON API under `/api/`, the UI everywhere else. */
export function createApp({
  checkDatabase,
  uiDir,
  overview,
  sessions,
  skills,
}: AppOptions): Hono {
  const app = new Hono();
  const context = apiContext(
    checkDatabase,
    overview.refreshSeconds,
    overview.updatedAt,
  );
  const { refreshSeconds, updatedAt, fromDatabase } = context;

  app.get('/api/health', async (c) =>
    (await checkDatabase())
      ? c.json({ status: 'ok', database: 'ok' })
      : c.json({ status: 'degraded', database: 'unreachable' }, 503),
  );
  app.get('/api/overview', async (c) => {
    const period = c.req.query('period');
    const timeZone = c.req.query('tz') ?? '';
    if (!isPeriod(period) || !isTimeZone(timeZone)) {
      return c.json({ error: 'Expected period and tz query parameters' }, 400);
    }
    const body: OverviewResponse = await fromDatabase(async () => {
      const usage = await overview.load({ period, timeZone });
      return {
        status: 'ok',
        sessionsFolder: overview.sessionsFolder,
        updatedAt: updatedAt(),
        refreshSeconds,
        overview: usage,
      };
    });
    return c.json(body, body.status === 'ok' ? 200 : 503);
  });
  app.route('/api/sessions', sessionRoutes(sessions, context));
  app.route('/api/skills', skillRoutes(skills, context));
  app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

  if (!existsSync(join(uiDir, 'index.html'))) {
    app.get('*', (c) => c.text('UI not built. Run pnpm build.'));
    return app;
  }
  app.use('*', serveStatic({ root: uiDir }));
  app.get('*', serveStatic({ root: uiDir, path: 'index.html' }));
  return app;
}

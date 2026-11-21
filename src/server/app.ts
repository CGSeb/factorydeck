import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import type { DatabaseCheck } from './health.ts';

export interface AppOptions {
  checkDatabase: DatabaseCheck;
  /** Folder of the built UI; when it holds no `index.html`, the UI is reported as not built. */
  uiDir: string;
}

/** The FactoryDeck HTTP app: the JSON API under `/api/`, the UI everywhere else. */
export function createApp({ checkDatabase, uiDir }: AppOptions): Hono {
  const app = new Hono();

  app.get('/api/health', async (c) =>
    (await checkDatabase())
      ? c.json({ status: 'ok', database: 'ok' })
      : c.json({ status: 'degraded', database: 'unreachable' }, 503),
  );
  app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

  if (!existsSync(join(uiDir, 'index.html'))) {
    app.get('*', (c) => c.text('UI not built. Run pnpm build.'));
    return app;
  }
  app.use('*', serveStatic({ root: uiDir }));
  app.get('*', serveStatic({ root: uiDir, path: 'index.html' }));
  return app;
}

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import type { OverviewQuery } from '../overview/query.ts';
import {
  type OverviewData,
  type OverviewResponse,
  isPeriod,
} from '../overview/types.ts';
import { type AdminSource, adminRoutes } from './admin-routes.ts';
import { type ApiContext, apiContext, isTimeZone } from './api-context.ts';
import { bodySizeGuard, jsonBodyGuard, sessionGuard } from './auth-guard.ts';
import { type AuthEnv, type AuthSource, authRoutes } from './auth-routes.ts';
import { bugRoutes } from './bug-routes.ts';
import { type FeatureSource, featureRoutes } from './feature-routes.ts';
import { frictionRoutes } from './friction-routes.ts';
import { invitationAuthRoutes } from './invitation-routes.ts';
import { type GitHostSource, gitHostRoutes } from './git-host-routes.ts';
import type { DatabaseCheck } from './health.ts';
import { type ProjectSource, projectRoutes } from './project-routes.ts';
import { type ResetSource, resetRoutes } from './reset-routes.ts';
import { type RoleSource, roleRoutes } from './role-routes.ts';
import { type SessionSource, sessionRoutes } from './session-routes.ts';
import { type SidebarSource, sidebarRoutes } from './sidebar-routes.ts';
import { type SkillSource, skillRoutes } from './skill-routes.ts';
import { type StatsSource, statsRoutes } from './stats-routes.ts';
import { type TeamSource, teamRoutes } from './team-routes.ts';

export interface OverviewSource {
  load: (query: OverviewQuery) => Promise<OverviewData>;
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
  roles: RoleSource;
  features: FeatureSource;
  projects: ProjectSource;
  gitHost: GitHostSource;
  stats: StatsSource;
  sidebar?: SidebarSource | undefined;
  auth: AuthSource;
  team?: TeamSource | undefined;
  resets?: ResetSource | undefined;
  admin?: AdminSource | undefined;
}

function mountSections(
  app: Hono<AuthEnv>,
  options: AppOptions,
  context: ApiContext,
): void {
  app.route('/api/sessions', sessionRoutes(options.sessions, context));
  app.route('/api/skills', skillRoutes(options.skills, context));
  app.route('/api/roles', roleRoutes(options.roles, context));
  app.route('/api/features', featureRoutes(options.features, context));
  app.route('/api/bugs', bugRoutes(options.features, context));
  app.route('/api/projects', projectRoutes(options.projects, context));
  app.route('/api/git-host', gitHostRoutes(options.gitHost, context));
  app.route('/api/stats', statsRoutes(options.stats, context));
  app.route('/api/frictions', frictionRoutes(options.stats, context));
  if (options.sidebar !== undefined) {
    app.route('/api/sidebar', sidebarRoutes(options.sidebar, context));
  }
  if (options.team?.invitations !== undefined) {
    app.route(
      '/api/auth/invitation',
      invitationAuthRoutes(options.team.invitations, context),
    );
  }
  if (options.resets !== undefined) {
    app.route('/api/auth/reset', resetRoutes(options.resets, context));
  }
  app.route('/api/auth', authRoutes(options.auth, context));
  app.route('/api/team', teamRoutes(options.team, context));
  app.route('/api/admin', adminRoutes(options.admin, context));
}

/** The FactoryDeck HTTP app: the JSON API under `/api/`, the UI everywhere else. */
export function createApp(options: AppOptions): Hono<AuthEnv> {
  const { checkDatabase, uiDir, overview } = options;
  const app = new Hono<AuthEnv>();
  const context = apiContext(
    checkDatabase,
    overview.refreshSeconds,
    overview.updatedAt,
  );
  const { refreshSeconds, updatedAt, fromDatabase } = context;

  app.use(
    '/api/*',
    bodySizeGuard(),
    jsonBodyGuard(),
    sessionGuard(options.auth, context),
  );

  app.get('/api/health', async (c) =>
    (await checkDatabase())
      ? c.json({ status: 'ok', database: 'ok' })
      : c.json({ status: 'degraded', database: 'unreachable' }, 503),
  );
  app.get('/api/overview', async (c) => {
    const period = c.req.query('period');
    const timeZone = c.req.query('tz') ?? '';
    const project = c.req.query('project') || undefined;
    if (!isPeriod(period) || !isTimeZone(timeZone)) {
      return c.json(
        { error: 'Expected period, tz, and optional project query parameters' },
        400,
      );
    }
    const body: OverviewResponse = await fromDatabase(async () => {
      const usage = await overview.load({ period, timeZone, project });
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
  mountSections(app, options, context);
  app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

  if (!existsSync(join(uiDir, 'index.html'))) {
    app.get('*', (c) => c.text('UI not built. Run pnpm build.'));
    return app;
  }
  app.use('*', serveStatic({ root: uiDir }));
  app.get('*', serveStatic({ root: uiDir, path: 'index.html' }));
  return app;
}

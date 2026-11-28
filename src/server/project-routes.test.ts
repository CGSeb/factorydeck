import { describe, expect, it } from 'vitest';
import type { FactoryStatus } from '../projects/types.ts';
import {
  unusedRoles,
  unusedSkills,
  unusedGitHost,
  unusedFeatures,
  unusedStats,
  signedInAuth,
} from '../test/skill-source.ts';
import { type OverviewSource, createApp } from './app.ts';
import type { ProjectSource } from './project-routes.ts';
import type { SessionSource } from './session-routes.ts';

const up = (): Promise<boolean> => Promise.resolve(true);
const down = (): Promise<boolean> => Promise.resolve(false);

const overview: OverviewSource = {
  load: () => Promise.reject(new Error('Not used')),
  sessionsFolder: '/logs/claude',
  refreshSeconds: 10,
  updatedAt: () => undefined,
};

const sessions: SessionSource = {
  list: () => Promise.reject(new Error('Not used')),
  detail: () => Promise.reject(new Error('Not used')),
};

const status: FactoryStatus = {
  hasSessions: true,
  projects: [{ project: '/work/old-app', name: 'old-app' }],
  bugTickets: ['/work/old-app'],
  missing: [
    {
      project: '/work/old-app',
      name: 'old-app',
      factoryFile: '/work/old-app/docs/agents/factory.yml',
      sessions: 3,
    },
  ],
};

function app(checkDatabase = up) {
  const projects: ProjectSource = {
    factoryStatus: () => Promise.resolve(status),
  };
  return {
    app: createApp({
      checkDatabase,
      uiDir: '/nonexistent/factorydeck-ui',
      overview,
      sessions,
      skills: unusedSkills,
      roles: unusedRoles,
      features: unusedFeatures,
      projects,
      gitHost: unusedGitHost,
      auth: signedInAuth,
      stats: unusedStats,
    }),
  };
}

describe('GET /api/projects/factory', () => {
  it('answers whether sessions are stored and the projects without their factory', async () => {
    const response = await app().app.request('/api/projects/factory');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      refreshSeconds: 10,
      ...status,
    });
  });

  it('answers 503 unreachable when the database does not answer', async () => {
    const response = await app(down).app.request('/api/projects/factory');
    expect(response.status).toBe(503);
  });
});

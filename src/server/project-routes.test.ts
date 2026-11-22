import { describe, expect, it } from 'vitest';
import type { DeleteResult, FactoryStatus } from '../projects/types.ts';
import {
  unusedRoles,
  unusedSkills,
  unusedGitHost,
  unusedFeatures,
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
  missing: [
    {
      project: '/work/old-app',
      name: 'old-app',
      factoryFile: '/work/old-app/docs/agents/factory.yml',
      sessions: 3,
    },
  ],
};

function app(result: DeleteResult, checkDatabase = up) {
  const removed: string[] = [];
  const projects: ProjectSource = {
    factoryStatus: () => Promise.resolve(status),
    remove: (project) => {
      removed.push(project);
      return Promise.resolve(result);
    },
  };
  return {
    removed,
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
    }),
  };
}

describe('GET /api/projects/factory', () => {
  it('answers whether sessions are stored and the projects without their factory', async () => {
    const response = await app('deleted').app.request('/api/projects/factory');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      refreshSeconds: 10,
      ...status,
    });
  });

  it('answers 503 unreachable when the database does not answer', async () => {
    const response = await app('deleted', down).app.request(
      '/api/projects/factory',
    );
    expect(response.status).toBe(503);
  });
});

describe('DELETE /api/projects', () => {
  const path = `/api/projects?project=${encodeURIComponent('/work/old-app')}`;

  it.each([
    ['deleted', 200],
    ['has-factory', 409],
    ['not-found', 404],
  ] as const)('answers %s with HTTP %i', async (result, code) => {
    const { app: server, removed } = app(result);
    const response = await server.request(path, { method: 'DELETE' });
    expect(response.status).toBe(code);
    expect(await response.json()).toEqual({ status: result });
    expect(removed).toEqual(['/work/old-app']);
  });

  it('answers 400 without a project', async () => {
    const response = await app('deleted').app.request('/api/projects', {
      method: 'DELETE',
    });
    expect(response.status).toBe(400);
  });

  it('answers 503 unreachable when the database does not answer', async () => {
    const { app: server, removed } = app('deleted', down);
    const response = await server.request(path, { method: 'DELETE' });
    expect(response.status).toBe(503);
    expect(removed).toEqual([]);
  });
});

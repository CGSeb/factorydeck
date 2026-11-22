import { describe, expect, it } from 'vitest';
import type { RoleList, RoleQuery } from '../roles/types.ts';
import {
  unusedSkills,
  unusedProjects,
  unusedGitHost,
  unusedFeatures,
} from '../test/skill-source.ts';
import { type OverviewSource, createApp } from './app.ts';
import type { RoleSource } from './role-routes.ts';
import type { SessionSource } from './session-routes.ts';
import { splitTokens } from '../ui/token-fixtures.ts';

const up = (): Promise<boolean> => Promise.resolve(true);
const down = (): Promise<boolean> => Promise.resolve(false);

const overview: OverviewSource = {
  load: () => Promise.reject(new Error('Not used')),
  sessionsFolder: '/logs/claude',
  refreshSeconds: 10,
  updatedAt: () => new Date('2026-01-05T09:00:00Z'),
};

const sessions: SessionSource = {
  list: () => Promise.reject(new Error('Not used')),
  detail: () => Promise.reject(new Error('Not used')),
};

const list: RoleList = {
  roles: [
    {
      role: 'main',
      threads: 1,
      apiCalls: 3,
      tokens: 300,
      tokenCounts: splitTokens(300),
      costUsd: 0.5,
    },
  ],
  order: ['builder'],
  apiCalls: 3,
  projects: [{ project: '/work/app', name: 'app' }],
};

const queries: RoleQuery[] = [];
const roles: RoleSource = {
  list: (query) => {
    queries.push(query);
    return Promise.resolve(list);
  },
  config: { path: '/work/factorydeck.yml', exists: true },
};

function app(checkDatabase = up) {
  return createApp({
    checkDatabase,
    uiDir: '/nonexistent/factorydeck-ui',
    overview,
    sessions,
    skills: unusedSkills,
    roles,
    features: unusedFeatures,
    projects: unusedProjects,
    gitHost: unusedGitHost,
  });
}

describe('GET /api/roles', () => {
  it('answers the roles of the period and project, with the configuration file', async () => {
    const response = await app().request(
      '/api/roles?period=30d&tz=UTC&project=%2Fwork%2Fapp',
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      updatedAt: '2026-01-05T09:00:00.000Z',
      refreshSeconds: 10,
      list,
      config: { path: '/work/factorydeck.yml', exists: true },
    });
    expect(queries.at(-1)).toEqual({
      period: '30d',
      timeZone: 'UTC',
      project: '/work/app',
    });
  });

  it('answers 400 for an invalid query', async () => {
    expect((await app().request('/api/roles?period=1y&tz=UTC')).status).toBe(
      400,
    );
  });

  it('answers 503 unreachable when the database does not answer', async () => {
    const response = await app(down).request('/api/roles?period=7d&tz=UTC');
    expect(response.status).toBe(503);
  });
});

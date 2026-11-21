import { describe, expect, it } from 'vitest';
import type { SkillDetail, SkillList, SkillQuery } from '../skills/types.ts';
import { type OverviewSource, createApp } from './app.ts';
import type { SessionSource } from './session-routes.ts';
import { unusedRoles, unusedProjects } from '../test/skill-source.ts';
import type { SkillSource } from './skill-routes.ts';

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

const list: SkillList = {
  skills: [
    {
      skill: 'kit:write-spec',
      launches: 2,
      sessions: 1,
      apiCalls: 3,
      tokens: 300,
      costUsd: 0.5,
      averageCostUsd: 0.25,
    },
  ],
  launches: 2,
  projects: ['/work/app'],
};

const queries: { skill?: string; query: SkillQuery }[] = [];
const skills: SkillSource = {
  list: (query) => {
    queries.push({ query });
    return Promise.resolve(list);
  },
  detail: (skill, query) => {
    queries.push({ skill, query });
    const detail: SkillDetail = {
      skill,
      launches: 0,
      tokens: 0,
      costUsd: 0,
      averageCostUsd: null,
      series: [],
      sessions: [],
      projects: [],
    };
    return Promise.resolve(detail);
  },
};

function app(checkDatabase = up) {
  return createApp({
    checkDatabase,
    uiDir: '/nonexistent/factorydeck-ui',
    overview,
    sessions,
    skills,
    roles: unusedRoles,
    projects: unusedProjects,
  });
}

describe('GET /api/skills', () => {
  it('answers the skills of the period and project', async () => {
    const response = await app().request(
      '/api/skills?period=30d&tz=UTC&project=%2Fwork%2Fapp',
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      updatedAt: '2026-01-05T09:00:00.000Z',
      refreshSeconds: 10,
      list,
    });
    expect(queries.at(-1)).toEqual({
      query: { period: '30d', timeZone: 'UTC', project: '/work/app' },
    });
  });

  it('answers 400 for an invalid query', async () => {
    expect((await app().request('/api/skills?period=1y&tz=UTC')).status).toBe(
      400,
    );
    expect((await app().request('/api/skills?period=7d')).status).toBe(400);
  });

  it('answers 503 unreachable when the database does not answer', async () => {
    const response = await app(down).request('/api/skills?period=7d&tz=UTC');
    expect(response.status).toBe(503);
  });
});

describe('GET /api/skills/:name', () => {
  it('decodes the skill name', async () => {
    const response = await app().request(
      `/api/skills/${encodeURIComponent('kit:write-spec')}?period=all&tz=UTC`,
    );
    expect(response.status).toBe(200);
    expect(queries.at(-1)).toEqual({
      skill: 'kit:write-spec',
      query: { period: 'all', timeZone: 'UTC', project: undefined },
    });
  });

  it('answers 400 for an invalid query', async () => {
    expect((await app().request('/api/skills/kit:x')).status).toBe(400);
  });
});

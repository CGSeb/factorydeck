import { describe, expect, it } from 'vitest';
import type { BugList, BugRow } from '../bugs/types.ts';
import type { FeatureQuery } from '../features/types.ts';
import {
  unusedFeatures,
  unusedGitHost,
  unusedProjects,
  unusedRoles,
  unusedSkills,
  unusedStats,
} from '../test/skill-source.ts';
import { type OverviewSource, createApp } from './app.ts';
import type { SessionSource } from './session-routes.ts';

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

const fixed: BugRow = {
  project: '/work/app',
  projectName: 'app',
  number: 4,
  title: 'Empty export',
  url: 'https://example.test/issues/4',
  stage: 'merged',
  createdAt: '2026-01-01T10:00:00.000Z',
  version: { number: 1, count: 1, startedAt: '2026-01-01T10:00:00.000Z' },
  mergedAt: '2026-01-04T10:00:00.000Z',
  closedAt: null,
  fix: { rootCause: 'an empty list', reproduced: 'failed-on-main' },
  score: 88,
  threshold: 80,
  lastAt: '2026-01-04T09:00:00.000Z',
  tokens: 1200,
  tokenCounts: { input: 1000, cacheWrite: 0, cacheRead: 100, output: 100 },
  costUsd: 0.25,
};

const list: BugList = {
  bugTickets: true,
  groups: { open: [], fixing: [], fixed: [fixed] },
  counts: { open: 0, fixed: 1, closed: 0 },
  projects: [{ project: '/work/app', name: 'app' }],
};

const queries: FeatureQuery[] = [];

function app(checkDatabase = up) {
  return createApp({
    checkDatabase,
    uiDir: '/nonexistent/factorydeck-ui',
    overview,
    sessions,
    skills: unusedSkills,
    roles: unusedRoles,
    features: {
      ...unusedFeatures,
      bugs: (query) => {
        queries.push(query);
        return Promise.resolve(list);
      },
    },
    projects: unusedProjects,
    gitHost: unusedGitHost,
    stats: unusedStats,
  });
}

describe('GET /api/bugs', () => {
  it('answers the bug groups of the period and project', async () => {
    const response = await app().request(
      '/api/bugs?project=%2Fwork%2Fapp&period=30d&tz=Europe%2FParis',
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      updatedAt: '2026-01-05T09:00:00.000Z',
      refreshSeconds: 10,
      list,
    });
    expect(queries.at(-1)).toEqual({
      period: '30d',
      timeZone: 'Europe/Paris',
      project: '/work/app',
    });
  });

  it.each([
    '/api/bugs?tz=UTC',
    '/api/bugs?period=week&tz=UTC',
    '/api/bugs?period=7d&tz=Not%2FAZone',
    '/api/bugs?period=7d',
  ])('answers 400 to %s', async (path) => {
    const response = await app().request(path);
    expect(response.status).toBe(400);
  });

  it('answers 503 unreachable when the database does not answer', async () => {
    const response = await app(down).request('/api/bugs?period=7d&tz=UTC');
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'unreachable',
      refreshSeconds: 10,
    });
  });
});

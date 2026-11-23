import { describe, expect, it } from 'vitest';
import type { AutonomyQuery } from '../stats/autonomy.ts';
import type { AutonomyStats } from '../stats/types.ts';
import {
  unusedFeatures,
  unusedGitHost,
  unusedProjects,
  unusedRoles,
  unusedSkills,
} from '../test/skill-source.ts';
import { type OverviewSource, createApp } from './app.ts';
import type { SessionSource } from './session-routes.ts';

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

const autonomy: AutonomyStats = {
  current: {
    merged: 4,
    mergedWithoutPerson: 3,
    mergedAfterQuestion: 1,
    answeredWaitsMs: [3_600_000],
  },
  waitingNow: 2,
  weeks: [{ start: '2026-01-05', merged: 4, mergedWithoutPerson: 3 }],
  reasons: {
    specQuestion: 1,
    belowThreshold: 0,
    gatesFailed: 0,
    autoMergeOff: 0,
    total: 1,
  },
};

function app(up = true) {
  const queries: AutonomyQuery[] = [];
  const created = createApp({
    checkDatabase: () => Promise.resolve(up),
    uiDir: '/nonexistent/factorydeck-ui',
    overview,
    sessions,
    skills: unusedSkills,
    roles: unusedRoles,
    features: unusedFeatures,
    projects: unusedProjects,
    gitHost: unusedGitHost,
    stats: {
      autonomy: (query) => {
        queries.push(query);
        return Promise.resolve(autonomy);
      },
    },
  });
  return { app: created, queries };
}

describe('/api/stats/autonomy', () => {
  it('answers the autonomy figures of the period and project', async () => {
    const { app: server, queries } = app();
    const response = await server.request(
      '/api/stats/autonomy?period=30d&tz=Europe/Paris&project=%2Fwork%2Fapp',
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      updatedAt: '2026-01-05T09:00:00.000Z',
      refreshSeconds: 10,
      autonomy,
    });
    expect(queries).toEqual([
      { period: '30d', timeZone: 'Europe/Paris', project: '/work/app' },
    ]);
  });

  it.each([
    '/api/stats/autonomy?tz=UTC',
    '/api/stats/autonomy?period=year&tz=UTC',
    '/api/stats/autonomy?period=7d',
    '/api/stats/autonomy?period=7d&tz=Mars/Base',
  ])('refuses %s', async (url) => {
    const response = await app().app.request(url);
    expect(response.status).toBe(400);
  });

  it('answers unreachable when the database is down', async () => {
    const response = await app(false).app.request(
      '/api/stats/autonomy?period=7d&tz=UTC',
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'unreachable',
      refreshSeconds: 10,
    });
  });
});

import { describe, expect, it } from 'vitest';
import type { IssueKind } from '../git-host/kind.ts';
import type { AutonomyQuery } from '../stats/autonomy.ts';
import type { BugQuery } from '../stats/bugs.ts';
import type {
  AutonomyStats,
  BugStats,
  FlowStats,
  QualityStats,
  WaitingList,
} from '../stats/types.ts';
import {
  unusedFeatures,
  unusedGitHost,
  unusedProjects,
  unusedRoles,
  unusedSkills,
  unusedStats,
} from '../test/skill-source.ts';
import { createApp } from './app.ts';

const bugs: BugStats = {
  current: {
    merged: 4,
    bugs: 1,
    reopened: 1,
    fixMs: [7_200_000],
    openings: { created: 2, reopened: 1 },
  },
  issues: [
    {
      project: '/work/app',
      number: 9,
      title: 'Crash on save',
      fixMs: 7_200_000,
    },
  ],
  unit: 'week',
  buckets: [{ start: '2026-01-05', merged: 4, bugs: 1, opened: 3 }],
  bugTickets: true,
  kinds: { feature: 3, bug: 1 },
};

const waiting: WaitingList = { issues: [], projects: [] };

function app(up = true) {
  const queries: Record<'autonomy' | 'quality' | 'flow', AutonomyQuery[]> = {
    autonomy: [],
    quality: [],
    flow: [],
  };
  const bugQueries: BugQuery[] = [];
  const waitingCalls: [string | undefined, IssueKind | undefined][] = [];
  const created = createApp({
    checkDatabase: () => Promise.resolve(up),
    uiDir: '/nonexistent/factorydeck-ui',
    overview: {
      load: () => Promise.reject(new Error('Not used')),
      sessionsFolder: '/logs/claude',
      refreshSeconds: 10,
      updatedAt: () => new Date('2026-01-05T09:00:00Z'),
    },
    sessions: {
      list: () => Promise.reject(new Error('Not used')),
      detail: () => Promise.reject(new Error('Not used')),
    },
    skills: unusedSkills,
    roles: unusedRoles,
    features: unusedFeatures,
    projects: unusedProjects,
    gitHost: unusedGitHost,
    stats: {
      ...unusedStats,
      autonomy: (query) => {
        queries.autonomy.push(query);
        return Promise.resolve({} as AutonomyStats);
      },
      quality: (query) => {
        queries.quality.push(query);
        return Promise.resolve({} as QualityStats);
      },
      flow: (query) => {
        queries.flow.push(query);
        return Promise.resolve({} as FlowStats);
      },
      bugs: (query) => {
        bugQueries.push(query);
        return Promise.resolve(bugs);
      },
      waiting: (project, kind) => {
        waitingCalls.push([project, kind]);
        return Promise.resolve(waiting);
      },
    },
  });
  return { app: created, queries, bugQueries, waitingCalls };
}

describe('kind on the stats endpoints', () => {
  it.each(['feature', 'bug'] as const)(
    'passes kind=%s to autonomy, quality and flow',
    async (kind) => {
      const { app: server, queries } = app();
      for (const path of ['autonomy', 'quality', 'flow']) {
        const response = await server.request(
          `/api/stats/${path}?period=7d&tz=UTC&kind=${kind}`,
        );
        expect(response.status).toBe(200);
      }
      const expected = [
        { period: '7d', timeZone: 'UTC', project: undefined, kind },
      ];
      expect(queries).toEqual({
        autonomy: expected,
        quality: expected,
        flow: expected,
      });
    },
  );

  it('passes no kind without the parameter', async () => {
    const { app: server, queries } = app();
    await server.request('/api/stats/autonomy?period=7d&tz=UTC');
    expect(queries.autonomy[0]).not.toHaveProperty('kind');
  });

  it.each([
    '/api/stats/autonomy?period=7d&tz=UTC&kind=bugs',
    '/api/stats/quality?period=7d&tz=UTC&kind=Bug',
    '/api/stats/flow?period=7d&tz=UTC&kind=',
    '/api/stats/waiting?kind=all',
  ])('refuses an unknown kind in %s', async (url) => {
    const { app: server, queries, waitingCalls } = app();
    const response = await server.request(url);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Expected kind to be feature or bug',
    });
    expect(queries).toEqual({ autonomy: [], quality: [], flow: [] });
    expect(waitingCalls).toEqual([]);
  });

  it('passes the kind to the waiting list, and none without it', async () => {
    const { app: server, waitingCalls } = app();
    const response = await server.request(
      '/api/stats/waiting?project=%2Fwork%2Fapp&kind=bug',
    );
    expect(response.status).toBe(200);
    await server.request('/api/stats/waiting');
    expect(waitingCalls).toEqual([
      ['/work/app', 'bug'],
      [undefined, undefined],
    ]);
  });
});

describe('/api/stats/bugs', () => {
  it('answers the bug figures of the period and project', async () => {
    const { app: server, bugQueries } = app();
    const response = await server.request(
      '/api/stats/bugs?period=30d&tz=Europe/Paris&project=%2Fwork%2Fapp',
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      updatedAt: '2026-01-05T09:00:00.000Z',
      refreshSeconds: 10,
      bugs,
    });
    expect(bugQueries).toEqual([
      { period: '30d', timeZone: 'Europe/Paris', project: '/work/app' },
    ]);
  });

  it.each([
    '/api/stats/bugs?tz=UTC',
    '/api/stats/bugs?period=year&tz=UTC',
    '/api/stats/bugs?period=7d&tz=Mars/Base',
  ])('refuses %s', async (url) => {
    const response = await app().app.request(url);
    expect(response.status).toBe(400);
  });

  it('answers unreachable when the database is down', async () => {
    const response = await app(false).app.request(
      '/api/stats/bugs?period=7d&tz=UTC',
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'unreachable',
      refreshSeconds: 10,
    });
  });
});

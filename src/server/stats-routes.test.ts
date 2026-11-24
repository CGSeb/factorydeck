import { describe, expect, it } from 'vitest';
import type { AutonomyQuery } from '../stats/autonomy.ts';
import type { FlowQuery } from '../stats/flow.ts';
import type { QualityQuery } from '../stats/quality.ts';
import type { AutonomyStats, FlowStats, QualityStats } from '../stats/types.ts';
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
    stopWaitsMs: [3_600_000],
  },
  waitingNow: 2,
  unit: 'week',
  buckets: [{ start: '2026-01-05', merged: 4, mergedWithoutPerson: 3 }],
  reasons: {
    below1To5: 0,
    below6To15: 1,
    below16Plus: 0,
    gatesFailed: 0,
    specQuestion: 1,
    autoMergeOff: 0,
    total: 2,
    roundsSum: 3,
    roundsCount: 2,
  },
};

const quality: QualityStats = {
  current: {
    merged: 4,
    mergedWithReport: 3,
    firstPassed: 2,
    roundsSum: 5,
    roundsCount: 3,
    gainSum: 14,
    gainCount: 2,
  },
  unit: 'week',
  buckets: [{ start: '2026-01-05', mergedWithReport: 3, firstPassed: 2 }],
  firstReports: [{ score: 72, threshold: 80, time: '2026-01-05T08:00:00Z' }],
};

const flow: FlowStats = {
  current: {
    issues: [
      {
        project: '/work/app',
        number: 7,
        title: 'Export',
        leadMs: 7_200_000,
        cycleMs: 3_600_000,
        tokens: 1_200_000,
      },
    ],
    tokens: {
      total: 2_000_000,
      droppedWork: 100_000,
      noWorkItem: 300_000,
      rework: 200_000,
      apiCalls: 40,
    },
  },
  unit: 'week',
  buckets: [{ start: '2026-01-05', merged: 1 }],
};

function app(up = true) {
  const queries: AutonomyQuery[] = [];
  const qualityQueries: QualityQuery[] = [];
  const flowQueries: FlowQuery[] = [];
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
      quality: (query) => {
        qualityQueries.push(query);
        return Promise.resolve(quality);
      },
      frictions: () => Promise.reject(new Error('Not used')),
      occurrences: () => Promise.reject(new Error('Not used')),
      output: () => Promise.reject(new Error('Not used')),
      flow: (query) => {
        flowQueries.push(query);
        return Promise.resolve(flow);
      },
    },
  });
  return { app: created, queries, qualityQueries, flowQueries };
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

describe('/api/stats/quality', () => {
  it('answers the quality figures of the period and project', async () => {
    const { app: server, qualityQueries } = app();
    const response = await server.request(
      '/api/stats/quality?period=7d&tz=Europe/Paris&project=%2Fwork%2Fapp',
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      updatedAt: '2026-01-05T09:00:00.000Z',
      refreshSeconds: 10,
      quality,
    });
    expect(qualityQueries).toEqual([
      { period: '7d', timeZone: 'Europe/Paris', project: '/work/app' },
    ]);
  });

  it.each([
    '/api/stats/quality?tz=UTC',
    '/api/stats/quality?period=year&tz=UTC',
    '/api/stats/quality?period=7d',
    '/api/stats/quality?period=7d&tz=Mars/Base',
  ])('refuses %s', async (url) => {
    const response = await app().app.request(url);
    expect(response.status).toBe(400);
  });

  it('answers unreachable when the database is down', async () => {
    const response = await app(false).app.request(
      '/api/stats/quality?period=7d&tz=UTC',
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'unreachable',
      refreshSeconds: 10,
    });
  });
});

describe('/api/stats/flow', () => {
  it('answers the flow figures of the period and project', async () => {
    const { app: server, flowQueries } = app();
    const response = await server.request(
      '/api/stats/flow?period=7d&tz=Europe/Paris&project=%2Fwork%2Fapp',
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      updatedAt: '2026-01-05T09:00:00.000Z',
      refreshSeconds: 10,
      flow,
    });
    expect(flowQueries).toEqual([
      { period: '7d', timeZone: 'Europe/Paris', project: '/work/app' },
    ]);
  });

  it.each([
    '/api/stats/flow?tz=UTC',
    '/api/stats/flow?period=year&tz=UTC',
    '/api/stats/flow?period=7d',
    '/api/stats/flow?period=7d&tz=Mars/Base',
  ])('refuses %s', async (url) => {
    const response = await app().app.request(url);
    expect(response.status).toBe(400);
  });

  it('answers unreachable when the database is down', async () => {
    const response = await app(false).app.request(
      '/api/stats/flow?period=all&tz=UTC',
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'unreachable',
      refreshSeconds: 10,
    });
  });
});

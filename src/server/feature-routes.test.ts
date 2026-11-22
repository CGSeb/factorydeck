import { describe, expect, it } from 'vitest';
import {
  type FeatureDetail,
  type FeatureList,
  type FeatureQuery,
  issueNumber,
} from '../features/types.ts';
import {
  unusedGitHost,
  unusedProjects,
  unusedRoles,
  unusedSkills,
} from '../test/skill-source.ts';
import { type OverviewSource, createApp } from './app.ts';
import type { FeatureSource } from './feature-routes.ts';
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

const list: FeatureList = {
  rows: [],
  noWorkItem: null,
  totals: {
    apiCalls: 0,
    tokens: 0,
    tokenCounts: { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 },
    costUsd: 0,
    unknownPriceCalls: 0,
  },
  merged: {
    issues: 0,
    costPerIssueUsd: null,
    tokensPerIssue: null,
    withoutPerson: null,
    unknownPriceCalls: 0,
  },
  projects: [{ project: '/work/app', name: 'app' }],
};

const feature: FeatureDetail = {
  project: '/work/app',
  projectName: 'app',
  number: 7,
  issue: { status: 'not-collected' },
  detail: null,
  roles: [],
  orchestration: null,
  sessions: [],
  threads: [],
};

const queries: unknown[] = [];
const features: FeatureSource = {
  list: (query: FeatureQuery) => {
    queries.push(query);
    return Promise.resolve(list);
  },
  detail: (key, query) => {
    queries.push({ key, query });
    return Promise.resolve(key.number === 7 ? feature : undefined);
  },
};

function app(checkDatabase = up) {
  return createApp({
    checkDatabase,
    uiDir: '/nonexistent/factorydeck-ui',
    overview,
    sessions,
    skills: unusedSkills,
    roles: unusedRoles,
    features,
    projects: unusedProjects,
    gitHost: unusedGitHost,
  });
}

describe('GET /api/features', () => {
  it('answers the issues of the period and project', async () => {
    const response = await app().request(
      '/api/features?period=30d&tz=UTC&project=%2Fwork%2Fapp',
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
      timeZone: 'UTC',
      project: '/work/app',
    });
  });

  it('answers 400 for an invalid query', async () => {
    expect((await app().request('/api/features?period=1y&tz=UTC')).status).toBe(
      400,
    );
  });

  it('answers 503 unreachable when the database does not answer', async () => {
    const response = await app(down).request('/api/features?period=7d&tz=UTC');
    expect(response.status).toBe(503);
  });
});

describe('GET /api/features/:number', () => {
  it('answers one issue of a project', async () => {
    const response = await app().request(
      '/api/features/7?period=all&tz=UTC&project=%2Fwork%2Fapp',
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok', feature });
    expect(queries.at(-1)).toEqual({
      key: { project: '/work/app', number: 7 },
      query: { period: 'all', timeZone: 'UTC', project: '/work/app' },
    });
  });

  it('answers 404 not-found for an unknown issue', async () => {
    const response = await app().request(
      '/api/features/8?period=all&tz=UTC&project=%2Fwork%2Fapp',
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      status: 'not-found',
      refreshSeconds: 10,
    });
  });

  it('answers 400 without a project or with an invalid number', async () => {
    for (const path of [
      '/api/features/7?period=all&tz=UTC',
      '/api/features/0?period=all&tz=UTC&project=%2Fwork%2Fapp',
      '/api/features/7a?period=all&tz=UTC&project=%2Fwork%2Fapp',
    ]) {
      expect((await app().request(path)).status).toBe(400);
    }
  });
});

describe('issueNumber', () => {
  it('reads a positive whole number only', () => {
    expect(issueNumber('31')).toBe(31);
    for (const value of ['', '0', '-1', '1.5', '1e3', '99999999999999999999']) {
      expect(issueNumber(value)).toBeUndefined();
    }
  });
});

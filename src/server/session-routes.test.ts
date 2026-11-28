import { describe, expect, it } from 'vitest';
import type { SessionDetail, SessionList } from '../sessions/types.ts';
import { type OverviewSource, createApp } from './app.ts';
import type { SessionSource } from './session-routes.ts';
import {
  unusedRoles,
  unusedSkills,
  unusedProjects,
  unusedGitHost,
  unusedFeatures,
  unusedStats,
  signedInAuth,
} from '../test/skill-source.ts';

const builtUi = '/nonexistent/factorydeck-ui';
const up = (): Promise<boolean> => Promise.resolve(true);
const down = (): Promise<boolean> => Promise.resolve(false);

const source: OverviewSource = {
  load: () => Promise.reject(new Error('Not used')),
  sessionsFolder: '/logs/claude',
  refreshSeconds: 10,
  updatedAt: () => new Date('2026-01-05T09:00:00Z'),
};

const list: SessionList = {
  sessions: [],
  total: 0,
  counts: { working: 0, waiting: 0, inactive: 0 },
  agents: [],
  projects: [{ project: '/work/app', name: 'app' }],
};

const detail: SessionDetail = {
  id: 's-1',
  agent: 'claude-code',
  title: '',
  project: '/work/app',
  projectName: 'app',
  cwd: '/work/app',
  sentBy: null,
  gitBranches: ['main'],
  workItem: null,
  issue: null,
  kind: null,
  issueDetail: null,
  state: 'waiting',
  firstAt: '2026-01-05T08:00:00.000Z',
  lastAt: '2026-01-05T08:30:00.000Z',
  tokens: { input: 1, cacheWrite: 2, cacheRead: 3, output: 4 },
  costUsd: 0.5,
  subAgents: [],
  skills: [],
  frictions: 0,
  projects: [{ project: '/work/app', name: 'app' }],
};

const sessionQueries: unknown[] = [];
const sessionSource: SessionSource = {
  list: (query) => {
    sessionQueries.push(query);
    return Promise.resolve(list);
  },
  detail: (id) => Promise.resolve(id === 's-1' ? detail : undefined),
};

describe('GET /api/sessions', () => {
  const app = createApp({
    checkDatabase: up,
    uiDir: builtUi,
    overview: source,
    sessions: sessionSource,
    skills: unusedSkills,
    roles: unusedRoles,
    features: unusedFeatures,
    projects: unusedProjects,
    gitHost: unusedGitHost,
    auth: signedInAuth,
    stats: unusedStats,
  });

  it('answers the filtered list with the ingestion facts', async () => {
    const response = await app.request(
      '/api/sessions?period=all&tz=UTC&project=%2Fwork%2Fapp&state=working&limit=100',
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      updatedAt: '2026-01-05T09:00:00.000Z',
      refreshSeconds: 10,
      list,
    });
    expect(sessionQueries.at(-1)).toEqual({
      period: 'all',
      timeZone: 'UTC',
      project: '/work/app',
      state: 'working',
      limit: 100,
    });
  });

  it('defaults to every project and state, 50 rows', async () => {
    await app.request('/api/sessions?period=7d&tz=UTC&project=&state=');
    expect(sessionQueries.at(-1)).toEqual({
      period: '7d',
      timeZone: 'UTC',
      project: undefined,
      state: undefined,
      limit: 50,
    });
  });

  it('accepts a limit of up to 500 rows', async () => {
    const response = await app.request(
      '/api/sessions?period=7d&tz=UTC&limit=500',
    );
    expect(response.status).toBe(200);
    expect(sessionQueries.at(-1)).toMatchObject({ limit: 500 });
  });

  it('answers 400 for an invalid query', async () => {
    for (const query of [
      '',
      '?period=7d&tz=UTC&state=asleep',
      '?period=7d&tz=UTC&limit=0',
      '?period=7d&tz=UTC&limit=501',
      '?period=7d&tz=UTC&limit=many',
    ]) {
      expect((await app.request(`/api/sessions${query}`)).status).toBe(400);
    }
  });

  it('answers 503 unreachable when the database does not answer', async () => {
    const response = await createApp({
      checkDatabase: down,
      uiDir: builtUi,
      overview: source,
      sessions: sessionSource,
      skills: unusedSkills,
      roles: unusedRoles,
      features: unusedFeatures,
      projects: unusedProjects,
      gitHost: unusedGitHost,
      auth: signedInAuth,
      stats: unusedStats,
    }).request('/api/sessions?period=7d&tz=UTC');
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'unreachable',
      refreshSeconds: 10,
    });
  });
});

describe('GET /api/sessions/:id', () => {
  const app = createApp({
    checkDatabase: up,
    uiDir: builtUi,
    overview: source,
    sessions: sessionSource,
    skills: unusedSkills,
    roles: unusedRoles,
    features: unusedFeatures,
    projects: unusedProjects,
    gitHost: unusedGitHost,
    auth: signedInAuth,
    stats: unusedStats,
  });

  it('answers the session', async () => {
    const response = await app.request('/api/sessions/s-1');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      updatedAt: '2026-01-05T09:00:00.000Z',
      refreshSeconds: 10,
      session: detail,
    });
  });

  it('answers 404 not-found for an unknown session', async () => {
    const response = await app.request('/api/sessions/nope');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      status: 'not-found',
      refreshSeconds: 10,
    });
  });
});

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { type Socket, createServer } from 'node:net';
import { createDatabase } from '../db/client.ts';
import { overviewData } from '../overview/kinds.ts';
import type { OverviewData } from '../overview/types.ts';
import { type OverviewSource, createApp } from './app.ts';
import type { SessionSource } from './session-routes.ts';
import {
  unusedRoles,
  unusedSkills,
  unusedProjects,
  unusedGitHost,
  unusedFeatures,
  unusedStats,
} from '../test/skill-source.ts';
import { databaseCheck } from './health.ts';

const builtUi = mkdtempSync(join(tmpdir(), 'factorydeck-ui-'));
writeFileSync(join(builtUi, 'index.html'), '<title>FactoryDeck</title>');
mkdirSync(join(builtUi, 'assets'));
writeFileSync(join(builtUi, 'assets', 'app.js'), 'console.log(1);');
const missingUi = join(builtUi, 'missing');

afterAll(() => rmSync(builtUi, { recursive: true, force: true }));

const unused = {
  skills: unusedSkills,
  roles: unusedRoles,
  features: unusedFeatures,
  projects: unusedProjects,
  gitHost: unusedGitHost,
  stats: unusedStats,
};

const up = (): Promise<boolean> => Promise.resolve(true);
const down = (): Promise<boolean> => Promise.resolve(false);

const usage: OverviewData = {
  hasData: true,
  merged: { feature: 3, bug: 2 },
  openBugs: 4,
  bugTickets: true,
  bucket: 'day',
  totals: {
    costUsd: 1.5,
    unknownPriceCalls: 0,
    tokens: { input: 1, cacheWrite: 2, cacheRead: 3, output: 4 },
    sessions: 1,
    apiCalls: 2,
  },
  series: [],
  projects: [],
  models: [],
};

const sessionSource: SessionSource = {
  list: () => Promise.reject(new Error('Not used')),
  detail: () => Promise.resolve(undefined),
};

const queries: unknown[] = [];
const source: OverviewSource = {
  load: (query) => {
    queries.push(query);
    return Promise.resolve(usage);
  },
  sessionsFolder: '/logs/claude',
  refreshSeconds: 10,
  updatedAt: () => new Date('2026-01-05T09:00:00Z'),
};

describe('GET /api/health', () => {
  it('answers 200 ok when the database answers', async () => {
    const response = await createApp({
      checkDatabase: up,
      uiDir: builtUi,
      overview: source,
      sessions: sessionSource,
      ...unused,
    }).request('/api/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', database: 'ok' });
  });

  it('answers 503 degraded when the database does not answer', async () => {
    const response = await createApp({
      checkDatabase: down,
      uiDir: builtUi,
      overview: source,
      sessions: sessionSource,
      ...unused,
    }).request('/api/health');
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'degraded',
      database: 'unreachable',
    });
  });
});

describe('other API paths', () => {
  it.each(['/api/unknown', '/api/health/deep', '/api/'])(
    'answers 404 JSON for %s',
    async (path) => {
      const response = await createApp({
        checkDatabase: up,
        uiDir: builtUi,
        overview: source,
        sessions: sessionSource,
        ...unused,
      }).request(path);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Not found' });
    },
  );

  it('answers 404 JSON when built UI is missing too', async () => {
    const response = await createApp({
      checkDatabase: up,
      uiDir: missingUi,
      overview: source,
      sessions: sessionSource,
      ...unused,
    }).request('/api/nope');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
  });
});

describe('UI', () => {
  const app = createApp({
    checkDatabase: up,
    uiDir: builtUi,
    overview: source,
    sessions: sessionSource,
    ...unused,
  });

  it('serves the built index page at /', async () => {
    const response = await app.request('/');
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<title>FactoryDeck</title>');
  });

  it('serves built assets', async () => {
    const response = await app.request('/assets/app.js');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('console.log(1);');
  });

  it('falls back to the index page on a client route', async () => {
    const response = await app.request('/sessions/42');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('<title>FactoryDeck</title>');
  });

  it('answers a plain-text hint when the UI was never built', async () => {
    const response = await createApp({
      checkDatabase: up,
      uiDir: missingUi,
      overview: source,
      sessions: sessionSource,
      ...unused,
    }).request('/');
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(await response.text()).toBe('UI not built. Run pnpm build.');
  });
});

describe('GET /api/overview', () => {
  it('answers the usage of the period, the merges by kind and the open bugs, with the ingestion facts', async () => {
    const response = await createApp({
      checkDatabase: up,
      uiDir: builtUi,
      overview: source,
      sessions: sessionSource,
      ...unused,
    }).request('/api/overview?period=30d&tz=Europe/Paris');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      sessionsFolder: '/logs/claude',
      updatedAt: '2026-01-05T09:00:00.000Z',
      refreshSeconds: 10,
      overview: usage,
    });
    expect(queries.at(-1)).toEqual({ period: '30d', timeZone: 'Europe/Paris' });
  });

  it('passes the project on, an empty project meaning all projects', async () => {
    const app = createApp({
      checkDatabase: up,
      uiDir: builtUi,
      overview: source,
      sessions: sessionSource,
      ...unused,
    });
    await app.request('/api/overview?period=7d&tz=UTC&project=%2Fwork%2Fapp');
    expect(queries.at(-1)).toStrictEqual({
      period: '7d',
      timeZone: 'UTC',
      project: '/work/app',
    });
    await app.request('/api/overview?period=7d&tz=UTC&project=');
    expect(queries.at(-1)).toStrictEqual({
      period: '7d',
      timeZone: 'UTC',
      project: undefined,
    });
  });

  it('answers 400 for an unknown period or time zone', async () => {
    const app = createApp({
      checkDatabase: up,
      uiDir: builtUi,
      overview: source,
      sessions: sessionSource,
      ...unused,
    });
    for (const query of [
      '',
      '?period=year&tz=UTC',
      '?period=7d',
      '?period=7d&tz=Mars/Base',
    ]) {
      expect((await app.request(`/api/overview${query}`)).status).toBe(400);
    }
  });

  it('answers 503 unreachable when the database does not answer', async () => {
    const response = await createApp({
      checkDatabase: down,
      uiDir: builtUi,
      overview: source,
      sessions: sessionSource,
      ...unused,
    }).request('/api/overview?period=7d&tz=UTC');
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'unreachable',
      refreshSeconds: 10,
    });
  });

  it('reports a database that accepts connections but never answers within 5 seconds', async () => {
    const sockets: Socket[] = [];
    const silent = createServer((socket) => sockets.push(socket));
    await new Promise<void>((resolve) =>
      silent.listen(0, '127.0.0.1', resolve),
    );
    const address = silent.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const { db, close } = createDatabase(
      `postgres://user:secret@127.0.0.1:${port}/factorydeck`,
    );
    const app = createApp({
      checkDatabase: databaseCheck(db),
      uiDir: builtUi,
      overview: { ...source, load: (query) => overviewData(db, query, up) },
      sessions: sessionSource,
      ...unused,
    });
    try {
      const started = Date.now();
      const responses = await Promise.all(
        [1, 2, 3].map(() =>
          Promise.resolve(app.request('/api/overview?period=7d&tz=UTC')),
        ),
      );
      expect(responses.map((response) => response.status)).toEqual([
        503, 503, 503,
      ]);
      expect(Date.now() - started).toBeLessThan(5000);
      expect(sockets.length).toBeLessThanOrEqual(1);
    } finally {
      await close();
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => silent.close(resolve));
    }
  }, 10_000);
});

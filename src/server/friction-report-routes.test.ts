import { describe, expect, it } from 'vitest';
import type { ReportQuery } from '../frictions/report.ts';
import {
  unusedFeatures,
  unusedGitHost,
  unusedProjects,
  unusedRoles,
  unusedSkills,
  unusedStats,
} from '../test/skill-source.ts';
import { createApp } from './app.ts';

const REPORT = '# Friction report\n\nApp · Last 7 days\n';

function app(up = true) {
  const queries: ReportQuery[] = [];
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
      report: (query) => {
        queries.push(query);
        return Promise.resolve(REPORT);
      },
    },
  });
  return { app: created, queries };
}

describe('/api/frictions/report', () => {
  it('answers the report as Markdown, built from the page parameters', async () => {
    const { app: server, queries } = app();
    const response = await server.request(
      '/api/frictions/report?period=30d&tz=Europe/Paris&project=%2Fwork%2Fapp&kind=tool-error&role=worker&issue=12',
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(
      'text/markdown; charset=utf-8',
    );
    expect(await response.text()).toBe(REPORT);
    expect(queries).toEqual([
      {
        period: '30d',
        timeZone: 'Europe/Paris',
        project: '/work/app',
        kind: 'tool-error',
        role: 'worker',
        filter: { issue: 12 },
      },
    ]);
  });

  it('passes the session filter on', async () => {
    const { app: server, queries } = app();
    await server.request(
      '/api/frictions/report?period=7d&tz=UTC&project=%2Fwork%2Fapp&session=s-1&issue=12',
    );
    expect(queries[0]?.filter).toEqual({ session: 's-1' });
  });

  it.each(['', '&project='])(
    'answers 400 without a project (%s)',
    async (suffix) => {
      const { app: server, queries } = app();
      const response = await server.request(
        `/api/frictions/report?period=7d&tz=UTC${suffix}`,
      );
      expect(response.status).toBe(400);
      expect(queries).toEqual([]);
    },
  );

  it('answers 400 for a bad period or time zone', async () => {
    const { app: server } = app();
    for (const query of [
      'period=week&tz=UTC&project=%2Fwork%2Fapp',
      'period=7d&tz=Nowhere%2FCity&project=%2Fwork%2Fapp',
    ]) {
      const response = await server.request(`/api/frictions/report?${query}`);
      expect(response.status).toBe(400);
    }
  });

  it('answers as /api/frictions does when the database is unreachable', async () => {
    const { app: server, queries } = app(false);
    const response = await server.request(
      '/api/frictions/report?period=7d&tz=UTC&project=%2Fwork%2Fapp',
    );
    const page = await server.request(
      '/api/frictions?period=7d&tz=UTC&project=%2Fwork%2Fapp',
    );
    expect(response.status).toBe(503);
    expect(response.status).toBe(page.status);
    expect(await response.json()).toEqual(await page.json());
    expect(queries).toEqual([]);
  });
});

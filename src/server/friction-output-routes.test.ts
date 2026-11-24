import { describe, expect, it } from 'vitest';
import type { FullOutput } from '../frictions/occurrence-types.ts';
import {
  unusedFeatures,
  unusedGitHost,
  unusedProjects,
  unusedRoles,
  unusedSkills,
  unusedStats,
} from '../test/skill-source.ts';
import { createApp } from './app.ts';

const outputs = new Map<number, FullOutput>([
  [7, { gone: false, text: 'line 1\n\nrejected' }],
  [8, { gone: true }],
]);

function app(up = true) {
  const ids: number[] = [];
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
      output: (id) => {
        ids.push(id);
        return Promise.resolve(outputs.get(id));
      },
    },
  });
  return { app: created, ids };
}

describe('/api/frictions/<id>/output', () => {
  it('answers the full output of a friction', async () => {
    const { app: server, ids } = app();
    const response = await server.request('/api/frictions/7/output');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      gone: false,
      text: 'line 1\n\nrejected',
    });
    expect(ids).toEqual([7]);
  });

  it('answers 200 with the log marked gone', async () => {
    const response = await app().app.request('/api/frictions/8/output');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', gone: true });
  });

  it('answers 404 for an unknown friction or a compaction', async () => {
    const response = await app().app.request('/api/frictions/9/output');
    expect(response.status).toBe(404);
  });

  it.each(['0', '-1', '1.5', 'abc', '07', '1e3', '99999999999999999999'])(
    'refuses the id %s',
    async (id) => {
      const { app: server, ids } = app();
      const response = await server.request(`/api/frictions/${id}/output`);
      expect(response.status).toBe(400);
      expect(ids).toEqual([]);
    },
  );

  it('answers unreachable when the database is down', async () => {
    const response = await app(false).app.request('/api/frictions/7/output');
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'unreachable',
      refreshSeconds: 10,
    });
  });
});

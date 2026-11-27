import { describe, expect, it } from 'vitest';
import type { CollectionStatus } from '../git-host/types.ts';
import {
  unusedProjects,
  unusedRoles,
  unusedSkills,
  unusedFeatures,
  unusedStats,
  signedInAuth,
} from '../test/skill-source.ts';
import { type OverviewSource, createApp } from './app.ts';
import type { GitHostSource } from './git-host-routes.ts';
import type { SessionSource } from './session-routes.ts';

const overview: OverviewSource = {
  load: () => Promise.reject(new Error('Not used')),
  sessionsFolder: '/logs/claude',
  refreshSeconds: 10,
  updatedAt: () => undefined,
};

const sessions: SessionSource = {
  list: () => Promise.reject(new Error('Not used')),
  detail: () => Promise.reject(new Error('Not used')),
};

function app(gitHost: GitHostSource, up = true) {
  return createApp({
    checkDatabase: () => Promise.resolve(up),
    uiDir: '/nonexistent/factorydeck-ui',
    overview,
    sessions,
    skills: unusedSkills,
    roles: unusedRoles,
    features: unusedFeatures,
    projects: unusedProjects,
    gitHost,
    auth: signedInAuth,
    stats: unusedStats,
  });
}

const status: CollectionStatus = {
  collectedAt: '2026-03-12T11:00:00.000Z',
  failures: [
    {
      project: '/work/app',
      name: 'app',
      gitHost: 'gitlab',
      reason: 'glab not found',
    },
  ],
};

describe('/api/git-host', () => {
  it('answers the last collection time and the failed projects', async () => {
    const response = await app({
      status: () => Promise.resolve(status),
      refresh: () => Promise.reject(new Error('Not used')),
    }).request('/api/git-host');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      refreshSeconds: 10,
      ...status,
    });
  });

  it('answers once the collection it started or joined has ended', async () => {
    const events: string[] = [];
    const response = await app({
      status: () => {
        events.push('status');
        return Promise.resolve(status);
      },
      refresh: () => {
        events.push('refresh');
        return Promise.resolve();
      },
    }).request('/api/git-host/refresh', { method: 'POST' });
    expect(response.status).toBe(200);
    expect(events).toEqual(['refresh', 'status']);
  });

  it('says when the database is unreachable', async () => {
    const response = await app(
      {
        status: () => Promise.reject(new Error('down')),
        refresh: () => Promise.resolve(),
      },
      false,
    ).request('/api/git-host');
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'unreachable',
      refreshSeconds: 10,
    });
  });
});

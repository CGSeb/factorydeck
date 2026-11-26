import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { gitHostProject } from '../db/schema.ts';
import { bugStats } from '../stats/bugs.ts';
import type { BugResponse } from '../stats/types.ts';
import { APP, DAY, LABELS, seed } from '../test/kind-seed.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  unusedFeatures,
  unusedGitHost,
  unusedProjects,
  unusedRoles,
  unusedSkills,
  unusedStats,
} from '../test/skill-source.ts';
import { createApp } from './app.ts';

let db: Database;
let close: () => Promise<void>;

const ago = (days: number): string =>
  new Date(Date.now() - days * DAY).toISOString();

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await db.insert(gitHostProject).values({
    project: APP,
    gitHost: 'github',
    syncedFrom: new Date(),
    stageLabels: LABELS,
    autoMerge: true,
    bugLabel: 'bug',
  });
  await seed(db, {
    number: 1,
    labels: ['bug'],
    createdAt: ago(3),
    merges: [{ at: ago(2) }],
  });
  await seed(db, {
    number: 2,
    labels: ['bug'],
    createdAt: ago(10),
    reopened: true,
    stateEvents: [
      { state: 'closed', at: ago(9) },
      { state: 'reopened', at: ago(2) },
    ],
  });
  await seed(db, {
    number: 3,
    labels: ['feature'],
    createdAt: ago(3),
    reopened: true,
    stateEvents: [
      { state: 'closed', at: ago(2) },
      { state: 'reopened', at: ago(1) },
    ],
  });
});

afterAll(async () => {
  await close();
});

function server() {
  return createApp({
    checkDatabase: () => Promise.resolve(true),
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
      bugs: (query) => bugStats(db, query, () => Promise.resolve(true)),
    },
  });
}

async function bugs(period: string): Promise<BugResponse> {
  const response = await server().request(
    `/api/stats/bugs?period=${period}&tz=UTC&project=${encodeURIComponent(APP)}`,
  );
  expect(response.status).toBe(200);
  return (await response.json()) as BugResponse;
}

describe('/api/stats/bugs openings', () => {
  it('answers the openings of the period, of the previous one and of each bucket', async () => {
    const response = await bugs('7d');
    if (response.status !== 'ok') throw new Error(response.status);
    expect(response.bugs.current.openings).toEqual({ created: 1, reopened: 1 });
    expect(response.bugs.previous?.openings).toEqual({
      created: 1,
      reopened: 0,
    });
    expect(response.bugs.buckets).toHaveLength(7);
    expect(response.bugs.buckets.map((bucket) => bucket.opened)).toEqual([
      0, 0, 0, 1, 1, 0, 0,
    ]);
    expect(response.bugs.current.bugs).toBe(1);
  });

  it('answers every opening for all time, with no previous period', async () => {
    const response = await bugs('all');
    if (response.status !== 'ok') throw new Error(response.status);
    expect(response.bugs.current.openings).toEqual({ created: 2, reopened: 1 });
    expect(response.bugs).not.toHaveProperty('previous');
    expect(
      response.bugs.buckets.reduce((sum, bucket) => sum + bucket.opened, 0),
    ).toBe(3);
  });
});

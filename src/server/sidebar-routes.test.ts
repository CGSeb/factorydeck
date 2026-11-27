import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { gitHostIssue, gitHostProject, gitHostRequest } from '../db/schema.ts';
import { readyCounts } from '../sidebar/ready.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  unusedFeatures,
  unusedGitHost,
  unusedProjects,
  unusedRoles,
  unusedSkills,
  unusedStats,
  signedInAuth,
} from '../test/skill-source.ts';
import { createApp } from './app.ts';
import type { SidebarSource } from './sidebar-routes.ts';

const APP = '/work/app';
const LIB = '/work/lib';
const FAILED = '/work/failed';
const OTHER = '/work/no-factory';
const CREATED = new Date('2026-03-01T00:00:00Z');
const LABELS = {
  ready: 'agent:ready',
  working: 'agent:working',
  needs_spec: 'agent:needs-spec',
  review: 'agent:review',
  blocked: 'agent:blocked',
};

let db: Database;
let close: () => Promise<void>;

interface Seed {
  project?: string;
  number: number;
  state?: 'open' | 'closed';
  labels?: string[];
  merged?: boolean;
}

async function seed({
  project = APP,
  number,
  state = 'open',
  labels = [],
  merged = false,
}: Seed): Promise<void> {
  await db.insert(gitHostIssue).values({
    project,
    number,
    title: `Issue ${String(number)}`,
    state,
    labels: labels.map((name) => ({ name, color: null })),
    url: `https://git.example/issues/${String(number)}`,
    createdAt: CREATED,
    closedAt: state === 'closed' ? new Date('2026-03-10T00:00:00Z') : null,
    updatedAt: CREATED,
  });
  if (!merged) return;
  await db.insert(gitHostRequest).values({
    project,
    number: 100 + number,
    title: `Request ${String(number)}`,
    state: 'merged',
    draft: false,
    headBranch: `feat/${String(number)}`,
    url: `https://git.example/pull/${String(100 + number)}`,
    createdAt: CREATED,
    mergedAt: new Date('2026-03-08T00:00:00Z'),
    updatedAt: CREATED,
    closes: [number],
    checks: 'passing',
  });
}

function projectRow(project: string, bugLabel: string | null, error = false) {
  return {
    project,
    gitHost: 'github',
    syncedFrom: CREATED,
    stageLabels: LABELS,
    autoMerge: true,
    bugLabel,
    error: error ? 'gh: not logged in' : null,
  };
}

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await db
    .insert(gitHostProject)
    .values([
      projectRow(APP, 'bug'),
      projectRow(LIB, null),
      projectRow(FAILED, null, true),
      projectRow(OTHER, 'bug'),
    ]);
  await seed({ number: 1, labels: ['spec', 'agent:ready'] });
  await seed({ number: 2, labels: ['bug', 'agent:ready'] });
  await seed({ number: 3, labels: ['Bug', ' Agent:Ready '] });
  await seed({ number: 4, labels: ['agent:ready', 'agent:working'] });
  await seed({ number: 5, labels: ['agent:ready', 'agent:needs-spec'] });
  await seed({ number: 6, labels: ['agent:ready', 'agent:blocked', 'bug'] });
  await seed({ number: 7, labels: ['agent:ready', 'agent:review'] });
  await seed({ number: 8, labels: ['spec'] });
  await seed({ number: 9, state: 'closed', labels: ['agent:ready'] });
  await seed({ number: 10, state: 'closed', labels: ['agent:ready', 'bug'] });
  await seed({ number: 11, labels: ['agent:ready'], merged: true });
  await seed({ project: LIB, number: 1, labels: ['agent:ready', 'bug'] });
  await seed({ project: LIB, number: 2, labels: ['agent:ready'] });
  await seed({ project: LIB, number: 3, labels: ['agent:working'] });
  await seed({ project: FAILED, number: 1, labels: ['agent:ready'] });
  await seed({ project: OTHER, number: 1, labels: ['agent:ready'] });
  await seed({ project: OTHER, number: 2, labels: ['agent:ready', 'bug'] });
});

afterAll(async () => {
  await close();
});

function app(
  sidebar: SidebarSource = {
    ready: (project) =>
      readyCounts(db, project, (root) => Promise.resolve(root !== OTHER)),
  },
  reachable = true,
) {
  return createApp({
    checkDatabase: () => Promise.resolve(reachable),
    uiDir: '/nonexistent/factorydeck-ui',
    overview: {
      load: () => Promise.reject(new Error('Not used')),
      sessionsFolder: '/logs/claude',
      refreshSeconds: 10,
      updatedAt: () => undefined,
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
    auth: signedInAuth,
    stats: unusedStats,
    sidebar,
  });
}

async function ready(query: string): Promise<unknown> {
  const response = await app().request(`/api/sidebar${query}`);
  expect(response.status).toBe(200);
  return response.json();
}

describe('GET /api/sidebar', () => {
  it('counts the ready features and bugs of one project', async () => {
    expect(await ready(`?project=${encodeURIComponent(APP)}`)).toEqual({
      ready: { feature: 1, bug: 2 },
    });
  });

  it('counts every ready issue as a feature in a project without a bug label', async () => {
    expect(await ready(`?project=${encodeURIComponent(LIB)}`)).toEqual({
      ready: { feature: 2, bug: 0 },
    });
  });

  it('counts a project whose last collection failed from its stored data', async () => {
    expect(await ready(`?project=${encodeURIComponent(FAILED)}`)).toEqual({
      ready: { feature: 1, bug: 0 },
    });
  });

  it('sums every factory project without a project or with an empty one', async () => {
    const all = { ready: { feature: 4, bug: 2 } };
    expect(await ready('')).toEqual(all);
    expect(await ready('?project=')).toEqual(all);
  });

  it('answers 0 for an unknown project and a project without the factory', async () => {
    const none = { ready: { feature: 0, bug: 0 } };
    expect(await ready('?project=%2Fwork%2Funknown')).toEqual(none);
    expect(await ready(`?project=${encodeURIComponent(`${APP}/`)}`)).toEqual(
      none,
    );
    expect(await ready(`?project=${encodeURIComponent(OTHER)}`)).toEqual(none);
  });

  it('answers 503 when the database does not answer', async () => {
    const response = await app(undefined, false).request(
      `/api/sidebar?project=${encodeURIComponent(APP)}`,
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'unreachable',
      refreshSeconds: 10,
    });
  });
});

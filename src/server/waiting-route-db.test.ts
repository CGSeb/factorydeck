import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { gitHostIssue, gitHostProject, gitHostRequest } from '../db/schema.ts';
import type { LabelChange, SerenityReport } from '../git-host/types.ts';
import { waitingIssues } from '../stats/waiting.ts';
import { createTestDatabase, testRemote } from '../test/postgres.ts';
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

const APP = '/work/app';
const OTHER = '/work/no-project';
const NO_PROJECT_REMOTE = 'github.com/example-org/no-project';

function remoteOf(root: string): string {
  return root === OTHER ? NO_PROJECT_REMOTE : testRemote(root);
}
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

function report(
  at: string,
  score: number,
  gatesPassed: boolean,
): SerenityReport {
  return { score, threshold: 80, rounds: 1, gatesPassed, at };
}

interface Seed {
  project?: string;
  number: number;
  state?: 'open' | 'closed';
  labels?: string[];
  needsSpec?: LabelChange[];
  reports?: SerenityReport[];
}

async function seed({
  project = APP,
  number,
  state = 'open',
  labels = [],
  needsSpec = [],
  reports = [],
}: Seed): Promise<void> {
  await db.insert(gitHostIssue).values({
    remote: remoteOf(project),
    number,
    title: `Issue ${String(number)}`,
    state,
    labels: labels.map((name) => ({ name, color: null })),
    url: `https://git.example/issues/${String(number)}`,
    createdAt: CREATED,
    closedAt: state === 'closed' ? new Date('2026-03-10T00:00:00Z') : null,
    updatedAt: CREATED,
    needsSpec,
  });
  if (reports.length === 0) return;
  await db.insert(gitHostRequest).values({
    remote: remoteOf(project),
    number: 100 + number,
    title: `Request ${String(number)}`,
    state: 'open',
    draft: false,
    headBranch: `feat/${String(number)}`,
    url: `https://git.example/pull/${String(100 + number)}`,
    createdAt: CREATED,
    updatedAt: CREATED,
    closes: [number],
    checks: 'passing',
    report: reports.at(-1) ?? null,
    reports,
  });
}

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await db.insert(gitHostProject).values(
    [APP, OTHER].map((project) => ({
      remote: remoteOf(project),
      gitHost: 'github',
      syncedFrom: CREATED,
      stageLabels: LABELS,
      autoMerge: true,
      bugLabel: 'bug',
    })),
  );
  await seed({
    number: 1,
    labels: ['agent:review'],
    reports: [
      report('2026-03-05T08:00:00Z', 60, true),
      report('2026-03-06T08:00:00Z', 92, false),
    ],
  });
  await seed({
    number: 2,
    labels: ['agent:blocked', 'agent:needs-spec', 'bug'],
    needsSpec: [{ added: true, at: '2026-03-07T00:00:00Z' }],
    reports: [report('2026-03-04T00:00:00Z', 70, false)],
  });
  await seed({ number: 3, labels: ['agent:working'] });
  await seed({
    number: 4,
    state: 'closed',
    labels: ['agent:blocked'],
  });
  await seed({ project: OTHER, number: 5, labels: ['agent:blocked'] });
});

afterAll(async () => {
  await close();
});

function app() {
  return createApp({
    checkDatabase: () => Promise.resolve(true),
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
    stats: {
      ...unusedStats,
      waiting: (project) => waitingIssues(db, project),
    },
  });
}

describe('GET /api/stats/waiting on the database', () => {
  it('lists the open issues waiting for a person, with each reason', async () => {
    const response = await app().request(
      `/api/stats/waiting?project=${encodeURIComponent(APP)}`,
    );
    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(body).toMatchObject({
      status: 'ok',
      waiting: {
        issues: [
          {
            project: APP,
            number: 2,
            title: 'Issue 2',
            kind: 'bug',
            reasons: ['blocked', 'spec-question', 'below-threshold'],
            since: '2026-03-04T00:00:00.000Z',
            score: 70,
          },
          {
            project: APP,
            number: 1,
            title: 'Issue 1',
            kind: 'feature',
            reasons: ['gates-failed'],
            since: '2026-03-06T08:00:00.000Z',
          },
        ],
      },
    });
    const issues = (body as { waiting: { issues: object[] } }).waiting.issues;
    expect(issues[1]).not.toHaveProperty('score');
  });

  it("leaves out the git host data of a remote that is no project's with every project", async () => {
    const response = await app().request('/api/stats/waiting');
    const body = (await response.json()) as { waiting: { issues: object[] } };
    expect(body).toMatchObject({
      waiting: { issues: [{ number: 2 }, { number: 1 }] },
    });
    expect(JSON.stringify(body.waiting.issues)).not.toContain(OTHER);
  });
});

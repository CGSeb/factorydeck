import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import {
  apiCall,
  gitHostIssue,
  gitHostProject,
  project,
  rootRemote,
  session,
} from '../db/schema.ts';
import { listFeatures } from '../features/query.ts';
import { frictionStats } from '../frictions/query.ts';
import { usageOverview } from '../overview/query.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
import { listRoles } from '../roles/query.ts';
import { listSessions, sessionDetail } from '../sessions/query.ts';
import { readyCounts } from '../sidebar/ready.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { factoryStatus } from './remove.ts';

const NOW = new Date('2026-03-12T15:30:00Z');
const AT = new Date('2026-03-12T10:00:00Z');
const SHOP = 'github.com/owner/shop';
const STRAY = 'github.com/owner/stray';
const all = { period: 'all', timeZone: 'UTC', now: NOW } as const;
const state = { inactiveAfterMinutes: 30, now: NOW };
const everyFactory = (): Promise<boolean> => Promise.resolve(true);
const LABELS = {
  ready: 'agent:ready',
  working: 'agent:working',
  needs_spec: 'agent:needs-spec',
  review: 'agent:review',
  blocked: 'agent:blocked',
};

let db: Database;
let close: () => Promise<void>;

function call(sessionId: string, n: number, input: number) {
  return {
    sourcePath: `/logs/${sessionId}.jsonl`,
    requestKey: `req_${String(n)}`,
    sessionId,
    at: AT,
    model: 'claude-sonnet-4-5',
    inputTokens: input,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    outputTokens: 0,
  };
}

function addProject(slug: string, name: string, remote: string) {
  return db.insert(project).values({ name, slug, remote, createdAt: NOW });
}

function readyIssue(remote: string, number: number, title: string) {
  return {
    remote,
    number,
    title,
    state: 'open',
    labels: [{ name: LABELS.ready, color: null }],
    url: `https://example.test/${String(number)}`,
    createdAt: AT,
    updatedAt: AT,
  };
}

beforeAll(async () => {
  ({ db, close } = await createTestDatabase({ linkRoots: false }));
  await addProject('shop', 'Shop', SHOP);
  await addProject('api', 'SHOP', 'github.com/owner/api');
  await addProject('library', 'Library', 'gitlab.com/group/library');
  await addProject('zed', 'zed', 'github.com/owner/zed');
  await db.insert(rootRemote).values([
    { root: '/work/web', remote: SHOP },
    { root: '/home/dev/shop', remote: SHOP },
    { root: '/work/api', remote: 'github.com/owner/api' },
    { root: '/work/lib', remote: 'gitlab.com/group/library' },
    { root: '/work/stray', remote: STRAY },
  ]);
  await db.insert(session).values([
    { id: 'w1', project: '/work/web', title: 'Fix #7 export', lastAt: AT },
    { id: 'w2', project: '/home/dev/shop', title: 'Fix #7 csv', lastAt: AT },
    { id: 'a1', project: '/work/api', title: 'Fix #8 auth', lastAt: AT },
    { id: 'l1', project: '/work/lib', title: 'Fix #9 docs', lastAt: AT },
    { id: 's1', project: '/work/stray', title: 'Fix #3 stray', lastAt: AT },
    { id: 'n1', project: '/work/no-remote', title: 'Chat', lastAt: AT },
    { id: 'u1', title: 'Chat', lastAt: AT },
  ]);
  await db
    .insert(apiCall)
    .values([
      call('w1', 1, 3000),
      call('w2', 2, 1000),
      call('a1', 3, 2000),
      call('l1', 4, 500),
      call('s1', 5, 700),
      call('n1', 6, 300),
      call('u1', 7, 100),
    ]);
  await db.insert(gitHostProject).values([
    {
      remote: SHOP,
      gitHost: 'github',
      syncedFrom: new Date('2026-03-12T09:00:00Z'),
      stageLabels: LABELS,
    },
    {
      remote: STRAY,
      gitHost: 'github',
      syncedFrom: AT,
      stageLabels: LABELS,
    },
  ]);
  await db
    .insert(gitHostIssue)
    .values([readyIssue(SHOP, 7, 'Export'), readyIssue(STRAY, 3, 'Stray')]);
});

afterAll(async () => {
  await close();
});

describe('sessions of a project by its remote', () => {
  it('counts two roots of one remote as one project, and leaves out the sessions of no project', async () => {
    const overview = await usageOverview(db, all);
    expect(
      overview.projects.map((row) => [
        row.project,
        row.projectName,
        row.sessions,
        row.tokens,
      ]),
    ).toEqual([
      ['shop', 'Shop (shop)', 2, 4000],
      ['api', 'SHOP (api)', 1, 2000],
      ['library', 'Library', 1, 500],
    ]);
    expect(overview.totals.sessions).toBe(4);
    expect(overview.totals.apiCalls).toBe(4);
    expect(overview.projects.reduce((sum, row) => sum + row.tokens, 0)).toBe(
      overview.totals.tokens.input +
        overview.totals.tokens.cacheWrite +
        overview.totals.tokens.cacheRead +
        overview.totals.tokens.output,
    );
  });

  it('lists every project of /projects by name without letter case, sessions or not', async () => {
    const list = await listSessions(db, { ...all, limit: 10 }, state);
    expect(list.projects).toEqual([
      { project: 'library', name: 'Library' },
      { project: 'api', name: 'SHOP (api)' },
      { project: 'shop', name: 'Shop (shop)' },
      { project: 'zed', name: 'zed' },
    ]);
    expect((await listRoles(db, all, DEFAULT_CONFIG)).projects).toEqual(
      list.projects,
    );
    expect(list.sessions.map((row) => row.id).sort()).toEqual([
      'a1',
      'l1',
      'w1',
      'w2',
    ]);
  });

  it('filters by the project slug, and shows no data for an unknown slug', async () => {
    const shop = await listSessions(
      db,
      { ...all, project: 'shop', limit: 10 },
      state,
    );
    expect(shop.sessions.map((row) => row.project)).toEqual(['shop', 'shop']);
    expect(shop.sessions.map((row) => row.id).sort()).toEqual(['w1', 'w2']);
    const unknown = await listSessions(
      db,
      { ...all, project: 'nope', limit: 10 },
      state,
    );
    expect(unknown).toMatchObject({ sessions: [], total: 0 });
    const overview = await usageOverview(db, { ...all, project: 'nope' });
    expect(overview.totals.apiCalls).toBe(0);
    expect(
      (await usageOverview(db, { ...all, project: '/work/web' })).totals
        .apiCalls,
    ).toBe(0);
  });

  it('opens no page for a session of no project', async () => {
    expect(await sessionDetail(db, 's1', state)).toBeUndefined();
    expect(await sessionDetail(db, 'u1', state)).toBeUndefined();
    expect((await sessionDetail(db, 'w2', state))?.project).toBe('shop');
  });

  it('names no session of no project in the friction filter', async () => {
    const stray = await frictionStats(
      db,
      { ...all, filter: { session: 's1' } },
      DEFAULT_CONFIG,
    );
    expect(stray.subject).toEqual({
      kind: 'session',
      id: 's1',
      title: null,
      agent: '',
    });
    const shop = await frictionStats(
      db,
      { ...all, filter: { session: 'w1' } },
      DEFAULT_CONFIG,
    );
    expect(shop.subject).toMatchObject({ title: 'Fix #7 export' });
  });

  it('gives one work item of a project to both its clones', async () => {
    const list = await listFeatures(db, all, DEFAULT_CONFIG);
    expect(
      list.rows.map((row) => [row.project, row.number, row.projectName]),
    ).toEqual([
      ['shop', 7, 'Shop (shop)'],
      ['api', 8, 'SHOP (api)'],
      ['library', 9, 'Library'],
    ]);
  });

  it('reads the git host data of a project from its remote, whatever root collected it', async () => {
    expect(await readyCounts(db, 'shop')).toEqual({
      feature: 1,
      bug: 0,
    });
    expect(await readyCounts(db, undefined)).toEqual({
      feature: 1,
      bug: 0,
    });
  });

  it('shows the sessions of a remote as soon as its project is added', async () => {
    await addProject('stray', 'Stray', STRAY);
    try {
      const overview = await usageOverview(db, { ...all, project: 'stray' });
      expect(overview.totals).toMatchObject({ sessions: 1, apiCalls: 1 });
      expect(await readyCounts(db, 'stray')).toEqual({
        feature: 1,
        bug: 0,
      });
      expect((await factoryStatus(db, everyFactory)).projects).toContainEqual({
        project: 'stray',
        name: 'Stray',
      });
    } finally {
      await db.delete(project).where(eq(project.slug, 'stray'));
    }
  });
});

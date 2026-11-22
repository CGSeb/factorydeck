import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { apiCall, projectName, session, skillLaunch } from '../db/schema.ts';
import { featureDetail, listFeatures } from '../features/query.ts';
import { usageOverview } from '../overview/query.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
import { listRoles } from '../roles/query.ts';
import { listSessions, sessionDetail } from '../sessions/query.ts';
import { listSkills, skillDetail } from '../skills/query.ts';
import { createTestDatabase } from '../test/postgres.ts';

const NOW = new Date('2026-03-12T15:30:00Z');
const AT = new Date('2026-03-12T10:00:00Z');
const WEB = '/work/web';
const API = '/work/api';
const LIB = '/work/lib';
const all = { period: 'all', timeZone: 'UTC', now: NOW } as const;
const state = { inactiveAfterMinutes: 30, now: NOW };

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

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await db.insert(session).values([
    { id: 'w1', project: WEB, title: 'Fix #7 export', lastAt: AT },
    { id: 'a1', project: API, title: 'Fix #8 auth', lastAt: AT },
    { id: 'l1', project: LIB, title: 'Fix #9 docs', lastAt: AT },
    { id: 'u1', title: 'Chat', lastAt: AT },
  ]);
  await db.insert(projectName).values([
    { project: WEB, name: 'Shop' },
    { project: API, name: 'SHOP' },
    { project: LIB, name: 'Library' },
  ]);
  await db
    .insert(apiCall)
    .values([
      call('w1', 1, 3000),
      call('a1', 2, 2000),
      call('l1', 3, 1000),
      call('u1', 4, 500),
    ]);
  await db.insert(skillLaunch).values(
    ['w1', 'l1'].map((sessionId) => ({
      sourcePath: `/logs/${sessionId}.jsonl`,
      recordUuid: `${sessionId}-skill`,
      sessionId,
      at: AT,
      skill: 'kit:review',
    })),
  );
});

afterAll(async () => {
  await close();
});

const OPTIONS = [
  { project: LIB, name: 'Library' },
  { project: API, name: `SHOP (${API})` },
  { project: WEB, name: `Shop (${WEB})` },
  { project: 'unassigned', name: 'unassigned' },
];

describe('display names in the API responses', () => {
  it('names the projects of the overview', async () => {
    const overview = await usageOverview(db, all);
    expect(
      overview.projects.map(({ project, projectName: name }) => [
        project,
        name,
      ]),
    ).toEqual([
      [WEB, `Shop (${WEB})`],
      [API, `SHOP (${API})`],
      [LIB, 'Library'],
      ['unassigned', 'unassigned'],
    ]);
  });

  it('names the projects of the session list and page, and lists the filter options by name', async () => {
    const list = await listSessions(db, { ...all, limit: 10 }, state);
    expect(
      Object.fromEntries(list.sessions.map((row) => [row.id, row.projectName])),
    ).toEqual({
      w1: `Shop (${WEB})`,
      a1: `SHOP (${API})`,
      l1: 'Library',
      u1: 'unassigned',
    });
    expect(list.projects).toEqual(OPTIONS);
    expect((await sessionDetail(db, 'l1', state))?.projectName).toBe('Library');
  });

  it('names the projects of the skills and roles pages', async () => {
    expect((await listSkills(db, all)).projects).toEqual(OPTIONS);
    const detail = await skillDetail(db, 'kit:review', all);
    expect(
      Object.fromEntries(
        detail.sessions.map((row) => [row.id, row.projectName]),
      ),
    ).toEqual({ w1: `Shop (${WEB})`, l1: 'Library' });
    expect(detail.projects).toEqual(OPTIONS);
    expect((await listRoles(db, all, DEFAULT_CONFIG)).projects).toEqual(
      OPTIONS,
    );
  });

  it('names the projects of the features list and of an issue page', async () => {
    const list = await listFeatures(db, all, DEFAULT_CONFIG);
    expect(
      list.rows.map((row) => [row.project, row.number, row.projectName]),
    ).toEqual([
      [WEB, 7, `Shop (${WEB})`],
      [API, 8, `SHOP (${API})`],
      [LIB, 9, 'Library'],
    ]);
    expect(list.projects).toEqual(OPTIONS);
    const detail = await featureDetail(db, { project: LIB, number: 9 }, all, {
      config: DEFAULT_CONFIG,
      state,
    });
    expect(detail?.projectName).toBe('Library');
  });

  it('breaks a cost tie of the overview by display name', async () => {
    await db.insert(session).values([
      { id: 'z1', project: '/work/zeta', title: 'Tie', lastAt: AT },
      { id: 'b1', project: '/work/beta', title: 'Tie', lastAt: AT },
    ]);
    await db.insert(projectName).values([
      { project: '/work/zeta', name: 'Alpha' },
      { project: '/work/beta', name: 'Omega' },
    ]);
    await db.insert(apiCall).values([call('z1', 5, 10), call('b1', 6, 10)]);
    const overview = await usageOverview(db, all);
    expect(
      overview.projects
        .filter((row) => row.tokens === 10)
        .map((row) => row.projectName),
    ).toEqual(['Alpha', 'Omega']);
  });
});

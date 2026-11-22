import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { featureDetail, listFeatures } from '../features/query.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
import { listRoles } from '../roles/query.ts';
import { listSessions, sessionDetail } from '../sessions/query.ts';
import { listSkills, skillDetail } from '../skills/query.ts';
import { createTestDatabase } from '../test/postgres.ts';
import {
  APP,
  counts,
  seedTokenBreakdown,
  state,
  sumOf,
  today,
  week,
} from '../test/token-breakdown.ts';
import { usageOverview } from './query.ts';
import { totalTokens } from './tokens.ts';
import type { TokenCounts } from './types.ts';

let db: Database;
let close: () => Promise<void>;

function expectBreakdown(row: { tokens: number; tokenCounts: TokenCounts }) {
  expect(Object.values(row.tokenCounts).every(Number.isInteger)).toBe(true);
  expect(totalTokens(row.tokenCounts)).toBe(row.tokens);
}

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await seedTokenBreakdown(db);
});

afterAll(async () => {
  await close();
});

describe('token breakdown of the features API', () => {
  it('splits the orchestration share of each count with the issue weights', async () => {
    const list = await listFeatures(db, week, DEFAULT_CONFIG);
    const byNumber = new Map(list.rows.map((row) => [row.number, row]));
    expect(byNumber.get(1)).toMatchObject({
      tokens: 309,
      tokenCounts: counts(101, 2, 3, 203),
    });
    expect(byNumber.get(2)).toMatchObject({
      tokens: 51,
      tokenCounts: counts(0, 50, 0, 1),
    });
    expect(byNumber.get(3)).toMatchObject({
      tokens: 110,
      tokenCounts: counts(15, 20, 30, 45),
    });
    expect(list.noWorkItem).toMatchObject({
      tokens: 12,
      tokenCounts: counts(7, 1, 1, 3),
    });
    for (const row of [...list.rows, list.totals]) expectBreakdown(row);
    if (list.noWorkItem !== null) expectBreakdown(list.noWorkItem);
  });

  it('adds the list up to the totals, equal to the overview totals', async () => {
    for (const query of [week, today, { ...week, period: 'all' as const }]) {
      const [list, overview] = await Promise.all([
        listFeatures(db, query, DEFAULT_CONFIG),
        usageOverview(db, query),
      ]);
      expect(list.totals.tokenCounts).toEqual(overview.totals.tokens);
      const rows = [
        ...list.rows,
        ...(list.noWorkItem ? [list.noWorkItem] : []),
      ];
      expect(sumOf(rows)).toEqual(list.totals.tokenCounts);
    }
  });

  it('gives each issue the time of its latest own call, orchestration left out', async () => {
    const list = await listFeatures(db, week, DEFAULT_CONFIG);
    const lastAt = new Map(list.rows.map((row) => [row.number, row.lastAt]));
    expect(lastAt.get(1)).toBe('2026-03-12T09:00:00.000Z');
    expect(lastAt.get(2)).toBe('2026-03-12T11:20:00.000Z');
    expect(lastAt.get(3)).toBe('2026-03-12T14:00:00.000Z');
  });

  it('gives the tokens per merged issue of one merged issue', async () => {
    const list = await listFeatures(db, week, DEFAULT_CONFIG);
    expect(list.merged).toMatchObject({ issues: 1, tokensPerIssue: 309 });
  });

  it('splits the issue detail by role, orchestration and session', async () => {
    const detail = await featureDetail(db, { project: APP, number: 1 }, week, {
      config: DEFAULT_CONFIG,
      state,
    });
    expect(detail?.roles).toMatchObject([
      { role: 'builder', tokens: 300, tokenCounts: counts(100, 0, 0, 200) },
    ]);
    expect(detail?.orchestration).toMatchObject({
      tokens: 9,
      tokenCounts: counts(1, 2, 3, 3),
    });
    expect(detail?.sessions).toMatchObject([
      { id: 's1', tokens: 309, tokenCounts: counts(101, 2, 3, 203) },
    ]);
    const other = await featureDetail(db, { project: APP, number: 2 }, week, {
      config: DEFAULT_CONFIG,
      state,
    });
    expect(other?.orchestration?.tokenCounts).toEqual(counts(0, 0, 0, 1));
    expect(
      sumOf(
        [detail?.orchestration, other?.orchestration].flatMap((row) =>
          row ? [row] : [],
        ),
      ),
    ).toEqual(counts(1, 2, 3, 4));
  });
});

describe('token breakdown of the overview API', () => {
  it('breaks down each project and model row', async () => {
    const overview = await usageOverview(db, week);
    for (const row of [...overview.projects, ...overview.models]) {
      expectBreakdown(row);
    }
    expect(overview.projects).toMatchObject([
      { project: APP, tokenCounts: overview.totals.tokens },
    ]);
    expect(sumOf(overview.models)).toEqual(overview.totals.tokens);
  });

  it('gives the tokens of each day of the period', async () => {
    const overview = await usageOverview(db, week);
    const byBucket = new Map(
      overview.series.map((point) => [point.bucket, point.tokens]),
    );
    expect(byBucket.get('2026-03-10')).toEqual(counts(0, 0, 0, 0));
    expect(byBucket.get('2026-03-11')).toEqual(counts(5, 0, 0, 5));
    expect(byBucket.get('2026-03-12')).toEqual(counts(118, 73, 34, 247));
  });

  it('gives the tokens of each hour of today', async () => {
    const overview = await usageOverview(db, today);
    const byBucket = new Map(
      overview.series.map((point) => [point.bucket, point.tokens]),
    );
    expect(byBucket.get('2026-03-12T09:00')).toEqual(counts(100, 0, 0, 200));
    expect(byBucket.get('2026-03-12T10:00')).toEqual(counts(1, 2, 3, 4));
    expect(byBucket.get('2026-03-12T11:00')).toEqual(counts(0, 50, 0, 0));
    expect(byBucket.get('2026-03-12T12:00')).toEqual(counts(7, 1, 1, 3));
    expect(byBucket.get('2026-03-12T13:00')).toEqual(counts(0, 0, 0, 0));
    expect(byBucket.get('2026-03-12T14:00')).toEqual(counts(10, 20, 30, 40));
  });
});

describe('token breakdown of the sessions, skills and roles APIs', () => {
  it('breaks down each session row, sub-agent and skill row', async () => {
    const list = await listSessions(db, { ...week, limit: 50 }, state);
    for (const row of list.sessions) expectBreakdown(row);
    const s1 = list.sessions.find((row) => row.id === 's1');
    expect(s1?.tokenCounts).toEqual(counts(1_101, 52, 3, 204));
    const detail = await sessionDetail(db, 's1', state);
    expect(detail?.tokens).toEqual(counts(1_101, 52, 3, 204));
    expect(detail?.subAgents).toMatchObject([
      { id: 'a1', tokenCounts: counts(100, 0, 0, 200) },
      { id: 'a2', tokenCounts: counts(0, 50, 0, 0) },
    ]);
    for (const row of [
      ...(detail?.subAgents ?? []),
      ...(detail?.skills ?? []),
    ]) {
      expectBreakdown(row);
    }
  });

  it('breaks down each skill row, the skill itself and its sessions', async () => {
    const list = await listSkills(db, week);
    for (const row of list.skills) expectBreakdown(row);
    expect(sumOf(list.skills)).toEqual(counts(123, 73, 34, 252));
    const review = await skillDetail(db, 'review', week);
    expectBreakdown(review);
    expect(review.tokenCounts).toEqual(counts(7, 1, 1, 3));
    expect(review.sessions).toMatchObject([
      { id: 's3', tokens: 12, tokenCounts: counts(7, 1, 1, 3) },
    ]);
  });

  it('breaks down each role row', async () => {
    const { roles } = await listRoles(db, week, DEFAULT_CONFIG);
    for (const row of roles) expectBreakdown(row);
    expect(roles).toMatchObject([
      { role: 'builder', tokenCounts: counts(100, 50, 0, 200) },
      { role: 'main', tokenCounts: counts(23, 23, 34, 52) },
    ]);
  });
});

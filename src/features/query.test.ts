import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { usageOverview } from '../overview/query.ts';
import { folderName } from '../projects/label.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
import { APP, LIB, allTime, seedFeatures, week } from '../test/features.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { listFeatures } from './query.ts';
import type { FeatureRow } from './types.ts';

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await seedFeatures(db);
});

afterAll(async () => {
  await close();
});

function near(value: number): number {
  return expect.closeTo(value, 6) as number;
}

function summary(row: FeatureRow) {
  return {
    key: `${row.project}#${String(row.number)}`,
    tokens: row.tokens,
    costUsd: row.costUsd,
    orchestrationCostUsd: row.orchestrationCostUsd,
    sessions: row.sessions,
  };
}

describe('listFeatures', () => {
  it('gives each issue its calls and its orchestration share, sorted by cost', async () => {
    const list = await listFeatures(db, week, DEFAULT_CONFIG);
    const rows = list.rows.map(summary);
    expect(rows.map((row) => row.key)).toEqual([
      `${APP}#7`,
      `${APP}#8`,
      `${LIB}#7`,
      `${APP}#9`,
      `${APP}#99`,
    ]);
    expect(rows[0]).toEqual({
      key: `${APP}#7`,
      tokens: near(4_025_000),
      costUsd: near(7.9),
      orchestrationCostUsd: near(1.5),
      sessions: 2,
    });
    expect(rows[1]).toMatchObject({
      tokens: near(1_275_000),
      costUsd: near(2.5),
      orchestrationCostUsd: near(0.5),
      sessions: 1,
    });
    expect(rows[2]).toMatchObject({
      tokens: 800_000,
      costUsd: near(1.6),
      orchestrationCostUsd: near(0.4),
    });
    expect(rows[3]).toMatchObject({
      tokens: 400_000,
      costUsd: near(0.8),
      orchestrationCostUsd: null,
    });
    expect(list.noWorkItem).toMatchObject({
      tokens: 900_000,
      costUsd: near(1.8),
      sessions: 2,
    });
  });

  it('reads the stage, score and rounds of found issues only', async () => {
    const { rows } = await listFeatures(db, week, DEFAULT_CONFIG);
    const byKey = new Map(
      rows.map((row) => [`${row.project}#${String(row.number)}`, row]),
    );
    expect(byKey.get(`${APP}#7`)?.outcome).toMatchObject({
      stage: 'merged',
      report: { score: 90, rounds: 2 },
    });
    expect(byKey.get(`${APP}#8`)?.outcome?.stage).toBe('merged-by-person');
    expect(byKey.get(`${APP}#9`)?.outcome?.stage).toBe('open');
    expect(byKey.get(`${APP}#7`)?.issue).toEqual({
      status: 'found',
      title: 'Issue 7',
      url: 'https://git.example/app/issues/7',
    });
    expect(byKey.get(`${APP}#99`)).toMatchObject({
      issue: { status: 'not-found' },
      outcome: null,
    });
    expect(byKey.get(`${LIB}#7`)).toMatchObject({
      issue: { status: 'not-collected' },
      outcome: null,
    });
  });

  it('gives each issue row its kind, and none to the rows without an issue', async () => {
    const list = await listFeatures(db, week, DEFAULT_CONFIG);
    expect(
      Object.fromEntries(
        list.rows.map((row) => [
          `${row.project}#${String(row.number)}`,
          row.kind,
        ]),
      ),
    ).toEqual({
      [`${APP}#7`]: 'feature',
      [`${APP}#8`]: 'bug',
      [`${APP}#9`]: 'feature',
      [`${APP}#99`]: null,
      [`${LIB}#7`]: null,
    });
    expect(list.noWorkItem).not.toHaveProperty('kind');
    expect(list.totals).not.toHaveProperty('kind');
  });

  it('counts the kinds and tells whether the selection has bug tickets', async () => {
    const list = await listFeatures(db, week, DEFAULT_CONFIG);
    expect(list.bugTickets).toBe(true);
    expect(list.kinds).toEqual({ feature: 2, bug: 1 });
    const app = await listFeatures(
      db,
      { ...week, project: APP },
      DEFAULT_CONFIG,
    );
    expect(app.bugTickets).toBe(true);
    const lib = await listFeatures(
      db,
      { ...week, project: LIB },
      DEFAULT_CONFIG,
    );
    expect(lib.bugTickets).toBe(false);
    expect(lib.kinds).toEqual({ feature: 0, bug: 0 });
  });

  it('keeps only the issues of a kind, with merged computed on them', async () => {
    const all = await listFeatures(db, week, DEFAULT_CONFIG);
    const bugs = await listFeatures(
      db,
      { ...week, kind: 'bug' },
      DEFAULT_CONFIG,
    );
    expect(
      bugs.rows.map((row) => `${row.project}#${String(row.number)}`),
    ).toEqual([`${APP}#8`]);
    expect(bugs.kinds).toEqual(all.kinds);
    expect(bugs.bugTickets).toBe(true);
    expect(bugs.merged).toMatchObject({
      issues: 1,
      tokensPerIssue: bugs.rows[0]?.tokens,
      withoutPerson: 0,
    });
    expect(bugs.totals).toEqual(all.totals);
    const features = await listFeatures(
      db,
      { ...week, kind: 'feature' },
      DEFAULT_CONFIG,
    );
    expect(
      features.rows.map((row) => row.number).sort((a, b) => a - b),
    ).toEqual([7, 9]);
    expect(features.rows.every((row) => row.project === APP)).toBe(true);
    expect(features.merged).toMatchObject({ issues: 1, withoutPerson: 1 });
  });

  it('totals the merged issues', async () => {
    const { merged } = await listFeatures(db, week, DEFAULT_CONFIG);
    expect(merged).toEqual({
      issues: 2,
      costPerIssueUsd: near(5.2),
      tokensPerIssue: 2_650_000,
      withoutPerson: 0.5,
      unknownPriceCalls: 1,
    });
    const lib = await listFeatures(
      db,
      { ...week, project: LIB },
      DEFAULT_CONFIG,
    );
    expect(lib.merged).toEqual({
      issues: 0,
      costPerIssueUsd: null,
      tokensPerIssue: null,
      withoutPerson: null,
      unknownPriceCalls: 0,
    });
  });

  it('totals equal the overview for the same period and project', async () => {
    for (const query of [week, allTime]) {
      const [list, overview] = await Promise.all([
        listFeatures(db, query, DEFAULT_CONFIG),
        usageOverview(db, query),
      ]);
      const tokens = overview.totals.tokens;
      expect(list.totals).toEqual({
        sessions: overview.totals.sessions,
        apiCalls: overview.totals.apiCalls,
        tokens:
          tokens.input + tokens.cacheWrite + tokens.cacheRead + tokens.output,
        tokenCounts: tokens,
        costUsd: near(overview.totals.costUsd),
        unknownPriceCalls: overview.totals.unknownPriceCalls,
      });
      const shown = [...list.rows, list.noWorkItem].reduce(
        (sum, row) => sum + (row?.tokens ?? 0),
        0,
      );
      expect(shown).toBeCloseTo(list.totals.tokens);
      for (const project of overview.projects) {
        const scopedQuery = { ...query, project: project.project };
        const [scoped, scopedOverview] = await Promise.all([
          listFeatures(db, scopedQuery, DEFAULT_CONFIG),
          usageOverview(db, scopedQuery),
        ]);
        expect(scoped.totals.tokens).toBe(project.tokens);
        expect(scoped.totals.costUsd).toBeCloseTo(project.costUsd ?? 0);
        expect(scoped.totals.apiCalls).toBe(scopedOverview.totals.apiCalls);
        expect(scoped.totals.sessions).toBe(scopedOverview.totals.sessions);
        expect(scoped.totals.costUsd).toBeCloseTo(
          scopedOverview.totals.costUsd,
        );
      }
    }
  });

  it('weighs the orchestration share with the sub-agents tokens of the period', async () => {
    const list = await listFeatures(
      db,
      { ...allTime, project: APP },
      DEFAULT_CONFIG,
    );
    const byKey = new Map(list.rows.map((row) => [row.number, row]));
    expect(byKey.get(7)?.tokens).toBeCloseTo(3_200_000 + 1_050_000);
    expect(byKey.get(8)?.tokens).toBeCloseTo(3_000_000 + 1_050_000);
    expect(list.rows.every((row) => row.project === APP)).toBe(true);
  });

  it('keeps calls older than the period out', async () => {
    const list = await listFeatures(
      db,
      { ...week, project: LIB },
      DEFAULT_CONFIG,
    );
    expect(list.rows.map((row) => row.number)).toEqual([7]);
    const all = await listFeatures(
      db,
      { ...allTime, project: LIB },
      DEFAULT_CONFIG,
    );
    expect(all.rows.map((row) => row.number)).toEqual([7, 3]);
  });

  it('is empty with no call in the period', async () => {
    const list = await listFeatures(
      db,
      { ...week, project: '/work/none' },
      DEFAULT_CONFIG,
    );
    expect(list.rows).toEqual([]);
    expect(list.noWorkItem).toBeNull();
    expect(list.totals.apiCalls).toBe(0);
    expect(list.projects).toEqual([
      { project: APP, name: folderName(APP) },
      { project: LIB, name: folderName(LIB) },
    ]);
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { APP, factory, query, seedKinds } from '../test/kind-seed.ts';
import { autonomyStats } from './autonomy.ts';
import { flowStats } from './flow.ts';
import { qualityStats } from './quality.ts';
import { waitingIssues } from './waiting.ts';

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await seedKinds(db);
});

afterAll(async () => {
  await close();
});

describe('stats of one kind', () => {
  it('counts only the merged issues and the stops of that kind on autonomy', async () => {
    const [all, bug, feature] = await Promise.all([
      autonomyStats(db, query('7d'), factory),
      autonomyStats(db, query('7d', 'bug'), factory),
      autonomyStats(db, query('7d', 'feature'), factory),
    ]);
    expect([
      all.current.merged,
      bug.current.merged,
      feature.current.merged,
    ]).toEqual([3, 2, 1]);
    expect([all.waitingNow, bug.waitingNow, feature.waitingNow]).toEqual([
      2, 1, 1,
    ]);
    expect(bug.previous?.merged).toBe(1);
    expect(feature.previous?.merged).toBe(0);
    expect(bug.buckets).toHaveLength(all.buckets.length);
  });

  it('counts only the merged issues of that kind on quality', async () => {
    const [bug, feature] = await Promise.all([
      qualityStats(db, query('7d', 'bug'), factory),
      qualityStats(db, query('7d', 'feature'), factory),
    ]);
    expect([bug.current.merged, feature.current.merged]).toEqual([2, 1]);
    expect(bug.current.firstPassed).toBe(1);
  });

  it('times only the merged issues of that kind on flow', async () => {
    const flow = await flowStats(
      db,
      query('7d', 'bug'),
      DEFAULT_CONFIG,
      factory,
    );
    expect(flow.current.issues.map((issue) => issue.number)).toEqual([2, 5]);
    expect(flow.previous?.issues).toHaveLength(1);
  });

  it('shares the tokens of that kind, orchestration split, no work item left out', async () => {
    const [all, bug, feature] = await Promise.all(
      [undefined, 'bug' as const, 'feature' as const].map((kind) =>
        flowStats(db, query('7d', kind), DEFAULT_CONFIG, factory),
      ),
    );
    expect(all?.current.tokens).toEqual({
      total: 4_250_000,
      droppedWork: 550_000,
      noWorkItem: 400_000,
      rework: 2_000_000,
      apiCalls: 5,
    });
    expect(bug?.current.tokens).toEqual({
      total: 2_750_000,
      droppedWork: 550_000,
      noWorkItem: 0,
      rework: 2_000_000,
      apiCalls: 3,
    });
    expect(feature?.current.tokens).toEqual({
      total: 1_100_000,
      droppedWork: 0,
      noWorkItem: 0,
      rework: 0,
      apiCalls: 1,
    });
  });

  it('adds the tokens of both kinds up to all with no work item, and the calls within one', async () => {
    const [all, bug, feature] = await Promise.all(
      [undefined, 'bug' as const, 'feature' as const].map((kind) =>
        flowStats(db, query('7d', kind), DEFAULT_CONFIG, factory),
      ),
    );
    const empty = { total: 0, apiCalls: 0, noWorkItem: 0 };
    const whole = all?.current.tokens ?? empty;
    const bugs = bug?.current.tokens ?? empty;
    const features = feature?.current.tokens ?? empty;
    expect(bugs.total + features.total + whole.noWorkItem).toBe(whole.total);
    expect(
      Math.abs(bugs.apiCalls + features.apiCalls - (whole.apiCalls - 1)),
    ).toBeLessThanOrEqual(1);
  });

  it('lists only the issues of that kind waiting for a person', async () => {
    const [all, bug, feature] = await Promise.all([
      waitingIssues(db, APP, factory),
      waitingIssues(db, APP, factory, 'bug'),
      waitingIssues(db, APP, factory, 'feature'),
    ]);
    expect(all.issues.map((issue) => issue.number)).toEqual([6, 7]);
    expect(bug.issues.map((issue) => issue.number)).toEqual([6]);
    expect(feature.issues.map((issue) => issue.number)).toEqual([7]);
  });
});

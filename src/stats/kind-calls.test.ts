import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { apiCall, gitHostProject, session, subAgent } from '../db/schema.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
import { LABELS, NOW, builder, call, query, seed } from '../test/kind-seed.ts';
import { createTestDatabase, testRemote } from '../test/postgres.ts';
import { flowStats } from './flow.ts';
import { largestRemainder } from './kind-calls.ts';

const HALF = '/work/half';

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await db.insert(gitHostProject).values({
    remote: testRemote(HALF),
    gitHost: 'github',
    syncedFrom: NOW,
    stageLabels: LABELS,
    autoMerge: true,
    bugLabel: 'bug',
  });
  for (const [number, label] of [
    [1, 'bug'],
    [2, 'feature'],
  ] as const) {
    await seed(db, {
      project: HALF,
      number,
      labels: [label],
      createdAt: '2026-03-13T00:00:00Z',
      merges: [{ at: '2026-03-15T00:00:00Z' }],
    });
  }
  await db.insert(session).values({ id: 'h1', project: HALF, title: 'Half' });
  await db
    .insert(subAgent)
    .values([builder('h1a', 1, 'h1'), builder('h1b', 2, 'h1')]);
  await db
    .insert(apiCall)
    .values([
      call('h1', '2026-03-14T06:00:00Z', 1_000_000, 'h1a'),
      call('h1', '2026-03-14T07:00:00Z', 1_000_000, 'h1b'),
      call('h1', '2026-03-14T08:00:00Z', 300_000),
    ]);
});

afterAll(async () => {
  await close();
});

describe('largestRemainder', () => {
  it('splits a total so the parts add up to it exactly', () => {
    expect(largestRemainder([1.5, 1.5, 0], 3)).toEqual([2, 1, 0]);
    expect(largestRemainder([2.714, 1.286, 0], 4)).toEqual([3, 1, 0]);
    expect(largestRemainder([1 / 3, 1 / 3, 1 / 3], 1)).toEqual([1, 0, 0]);
    expect(largestRemainder([2.9999999999, 0.0000000001, 0], 3)).toEqual([
      3, 0, 0,
    ]);
  });
});

describe('calls of each kind', () => {
  it('add up to all when a shared call splits half and half', async () => {
    const [all, bug, feature] = await Promise.all(
      [undefined, 'bug' as const, 'feature' as const].map((kind) =>
        flowStats(db, query('7d', kind, HALF), DEFAULT_CONFIG),
      ),
    );
    const calls = (flow: typeof all): number =>
      flow?.current.tokens.apiCalls ?? 0;
    expect(calls(all)).toBe(3);
    expect(all?.current.tokens.noWorkItem).toBe(0);
    expect(calls(bug) + calls(feature)).toBe(3);
    expect([calls(bug), calls(feature)].sort((a, b) => a - b)).toEqual([1, 2]);
    expect(
      (bug?.current.tokens.total ?? 0) + (feature?.current.tokens.total ?? 0),
    ).toBe(all?.current.tokens.total);
  });
});

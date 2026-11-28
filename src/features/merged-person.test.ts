import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { gitHostIssue, gitHostRequest } from '../db/schema.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
import { APP, seedFeatures, week } from '../test/features.ts';
import { createTestDatabase, testRemote } from '../test/postgres.ts';
import { listFeatures } from './query.ts';

let db: Database;
let close: () => Promise<void>;

const REFUSED = {
  score: 60,
  threshold: 80,
  rounds: 1,
  gatesPassed: true,
  at: '2026-03-12T08:00:00.000Z',
};
const ALLOWED = { ...REFUSED, score: 90, at: '2026-03-12T09:00:00.000Z' };

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  await seedFeatures(db);
  await db
    .update(gitHostIssue)
    .set({ state: 'closed' })
    .where(eq(gitHostIssue.number, 9));
  await db.insert(gitHostRequest).values({
    remote: testRemote(APP),
    number: 103,
    title: 'Request 103',
    state: 'merged',
    draft: false,
    headBranch: 'feat/9',
    url: 'https://git.example/app/pull/103',
    createdAt: new Date('2026-03-11T09:00:00Z'),
    mergedAt: new Date('2026-03-12T10:00:00Z'),
    updatedAt: new Date('2026-03-12T10:00:00Z'),
    closes: [9],
    checks: 'passing',
    report: ALLOWED,
    reports: [REFUSED, ALLOWED],
  });
});

afterAll(async () => {
  await close();
});

describe('merged after a person', () => {
  it('counts as merged, not as merged without a person', async () => {
    const list = await listFeatures(db, week, DEFAULT_CONFIG);
    const issue9 = list.rows.find(
      (row) => row.project === APP && row.number === 9,
    );
    expect(issue9?.outcome).toEqual({
      stage: 'merged-after-person',
      report: { score: 90, threshold: 80, rounds: 1, firstScore: 60 },
      reworked: false,
    });
    expect(list.merged.issues).toBe(3);
    expect(list.merged.withoutPerson).toBeCloseTo(1 / 3, 6);
  });
});

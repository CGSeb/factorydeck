import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { collect } from '../git-host/collect.ts';
import { hasFactory } from '../ingest/factory.ts';
import { ingest } from '../ingest/ingest.ts';
import { loadIssues } from '../stats/autonomy.ts';
import { firstReport, qualityFacts, qualityStats } from '../stats/quality.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { sessionsFolder } from '../test/session-logs.ts';
import { writeDemoSessions } from './sessions.ts';

const NOW = new Date('2026-03-12T15:30:00Z');

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  const folder = await sessionsFolder();
  await writeDemoSessions(folder, NOW, await sessionsFolder());
  await ingest(db, folder);
  await collect(db, { hasFactory });
});

afterAll(async () => {
  await close();
});

describe('demo quality', () => {
  it('has first reports failed by score and by gates, 1 to 3 review rounds, and reworked merged issues', async () => {
    const merged = (
      await loadIssues(db, undefined, hasFactory, (issue, requests, state) => ({
        facts: qualityFacts(issue, requests, state),
        first: firstReport(requests),
        reopened: issue.reopened,
        requests: requests.length,
      }))
    ).filter(({ facts }) => facts.mergedAt !== null);
    const firsts = merged.flatMap(({ first }) =>
      first === null ? [] : [first],
    );
    expect(firsts.some((report) => report.score < report.threshold)).toBe(true);
    expect(
      firsts.some(
        (report) => !report.gatesPassed && report.score >= report.threshold,
      ),
    ).toBe(true);
    expect(new Set(merged.flatMap(({ facts }) => facts.rounds ?? []))).toEqual(
      new Set([1, 2, 3]),
    );
    expect(
      merged.filter(({ facts, requests }) => facts.reworked && requests > 1)
        .length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      merged.some(({ facts, reopened }) => facts.reworked && reopened),
    ).toBe(true);
  });

  it('closes about 5 issues without merge over the 12 weeks', async () => {
    const quality = await qualityStats(
      db,
      { period: 'all', timeZone: 'UTC', now: NOW },
      hasFactory,
    );
    expect(quality.current.closedWithoutMerge).toBeGreaterThanOrEqual(5);
    expect(quality.current.closedWithoutMerge).toBeLessThanOrEqual(7);
    expect(quality.current.firstPassed).toBeLessThan(
      quality.current.mergedWithReport,
    );
    const firstHalf = quality.buckets
      .slice(0, 6)
      .reduce((sum, week) => sum + week.mergedWithReport, 0);
    expect(firstHalf).toBeGreaterThan(0);
  });
});

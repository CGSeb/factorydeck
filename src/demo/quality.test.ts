import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { giveDemoTokens } from './projects.ts';
import { fakeCollection } from './fake-git-host-token.ts';
import { collect } from '../git-host/collect.ts';
import { hasFactory } from '../ingest/factory.ts';
import { ingest } from '../ingest/ingest.ts';
import { outcomeOf } from '../git-host/query.ts';
import { loadIssues } from '../stats/autonomy.ts';
import { storedReports } from '../stats/stops.ts';
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
  const projects = await sessionsFolder();
  await writeDemoSessions(folder, NOW, projects);
  await ingest(db, folder);
  await giveDemoTokens(db, projects);
  await collect(db, { ...(await fakeCollection()), hasFactory });
});

afterAll(async () => {
  await close();
});

describe('demo quality', () => {
  it('has first reports failed by score and by gates, 1 to 3 review rounds, and reworked merged issues', async () => {
    const merged = (
      await loadIssues(db, undefined, hasFactory, (issue, requests, state) => ({
        facts: qualityFacts(issue, requests, state),
        reworked: outcomeOf(issue, requests, state).reworked,
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
      merged.filter(({ reworked, requests }) => reworked && requests > 1)
        .length,
    ).toBeGreaterThanOrEqual(2);
    expect(merged.some(({ reworked, reopened }) => reworked && reopened)).toBe(
      true,
    );
  });

  it('has issues with one, two and three reports whose score rises, and one whose score falls', async () => {
    const merged = (
      await loadIssues(db, undefined, hasFactory, (issue, requests, state) => ({
        facts: qualityFacts(issue, requests, state),
        reports: storedReports(requests).length,
      }))
    ).filter(({ facts }) => facts.mergedAt !== null);
    expect(merged.some(({ reports }) => reports === 1)).toBe(true);
    for (const count of [2, 3]) {
      expect(
        merged.some(
          ({ facts, reports }) =>
            reports === count && facts.gain !== null && facts.gain > 0,
        ),
      ).toBe(true);
    }
    expect(
      merged.some(({ facts }) => facts.gain !== null && facts.gain < 0),
    ).toBe(true);
  });

  it('closes about 5 issues without merge over the 12 weeks', async () => {
    const closed = (
      await loadIssues(
        db,
        undefined,
        hasFactory,
        (issue, requests, state) =>
          qualityFacts(issue, requests, state).stage === 'closed' &&
          issue.closedAt !== null,
      )
    ).filter(Boolean).length;
    expect(closed).toBeGreaterThanOrEqual(5);
    expect(closed).toBeLessThanOrEqual(7);
    const quality = await qualityStats(
      db,
      { period: 'all', timeZone: 'UTC', now: NOW },
      hasFactory,
    );
    expect(quality.current.firstPassed).toBeLessThan(
      quality.current.mergedWithReport,
    );
    const firstHalf = quality.buckets
      .slice(0, 6)
      .reduce((sum, week) => sum + week.mergedWithReport, 0);
    expect(firstHalf).toBeGreaterThan(0);
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/client.ts';
import { featureDetail } from '../features/query.ts';
import { giveDemoTokens } from './projects.ts';
import { fakeCollection } from './fake-git-host-token.ts';
import { collect } from '../git-host/collect.ts';
import { hasFactory } from '../ingest/factory.ts';
import { ingest } from '../ingest/ingest.ts';
import { DEFAULT_CONFIG } from '../roles/config.ts';
import { allocationIn } from '../features/usage.ts';
import { issueKey } from '../features/values.ts';
import { issueFacts, loadIssues } from '../stats/autonomy.ts';
import { firstRefusal, flowStats } from '../stats/flow.ts';
import { earliestReport, storedReports } from '../stats/stops.ts';
import { createTestDatabase } from '../test/postgres.ts';
import { sessionsFolder } from '../test/session-logs.ts';
import { mergedIssueNumber } from './autonomy.ts';
import { FLOW_OUTLIER, FLOW_SESSIONS, flowIndexes } from './flow-sessions.ts';
import { EXAMPLE_APP, demoProjectRoot, writeDemoSessions } from './sessions.ts';

const NOW = new Date('2026-03-12T15:30:00Z');

let db: Database;
let close: () => Promise<void>;
let projects: string;

beforeEach(async () => {
  ({ db, close } = await createTestDatabase());
  const folder = await sessionsFolder();
  projects = await sessionsFolder();
  await writeDemoSessions(folder, NOW, projects);
  await ingest(db, folder);
  await giveDemoTokens(db, projects);
  await collect(db, { ...(await fakeCollection()), hasFactory });
});

afterEach(async () => {
  await close();
});

describe('demo flow', () => {
  it('gives 20 merged issues a short session before their merge, one costing about 8 times the others', async () => {
    const flow = await flowStats(
      db,
      { period: 'all', timeZone: 'UTC', now: NOW },
      DEFAULT_CONFIG,
      hasFactory,
    );
    const added = flow.current.issues.filter(
      (issue) => issue.number >= mergedIssueNumber(0),
    );
    const worked = added.filter((issue) => issue.tokens !== null);
    expect(worked.map((issue) => issue.number).sort((a, b) => a - b)).toEqual(
      flowIndexes()
        .map(mergedIssueNumber)
        .sort((a, b) => a - b),
    );
    expect(worked).toHaveLength(FLOW_SESSIONS);
    for (const issue of worked) {
      expect(issue.cycleMs).toBeGreaterThan(0);
      expect(issue.cycleMs).toBeLessThan(issue.leadMs);
    }
    const outlier = mergedIssueNumber(flowIndexes()[FLOW_OUTLIER] ?? 0);
    const tokens = (number: number) =>
      worked.find((issue) => issue.number === number)?.tokens ?? 0;
    const other = worked.find((issue) => issue.number !== outlier);
    const ratio = tokens(outlier) / tokens(other?.number ?? 0);
    expect(ratio).toBeGreaterThan(7);
    expect(ratio).toBeLessThan(9);
  });

  it('splits each session between a builder, a reviewer and the orchestration', async () => {
    const number = mergedIssueNumber(flowIndexes()[0] ?? 0);
    const detail = await featureDetail(
      db,
      { project: demoProjectRoot(projects, EXAMPLE_APP), number },
      { period: 'all', timeZone: 'UTC', now: NOW },
      { config: DEFAULT_CONFIG, state: { inactiveAfterMinutes: 30, now: NOW } },
    );
    expect(detail?.roles.map((role) => role.role).sort()).toEqual([
      'builder',
      'reviewer',
    ]);
    expect(detail?.orchestration).not.toBeNull();
  });

  it('gives merged issues calls after their first refused report, and one issue calls after a first report that passed', async () => {
    const [issues, usage, flow] = await Promise.all([
      loadIssues(db, undefined, hasFactory, (issue, requests, state) => ({
        merged: issueFacts(issue, requests, state).mergedAt !== null,
        key: issueKey(issue.project, issue.number),
        refusedAt: firstRefusal(requests),
        firstAt: earliestReport(storedReports(requests))?.at ?? null,
      })),
      allocationIn(db, DEFAULT_CONFIG, { startAt: null }),
      flowStats(
        db,
        { period: 'all', timeZone: 'UTC', now: NOW },
        DEFAULT_CONFIG,
        hasFactory,
      ),
    ]);
    const lastCall = (key: string): number => {
      const lastAt = usage.issues.get(key)?.lastAt;
      return lastAt === null || lastAt === undefined ? 0 : Date.parse(lastAt);
    };
    const reworked = issues.filter(
      ({ merged, key, refusedAt }) =>
        merged && refusedAt !== null && lastCall(key) >= refusedAt,
    );
    const passedThenWorked = issues.filter(
      ({ key, refusedAt, firstAt }) =>
        refusedAt === null &&
        firstAt !== null &&
        lastCall(key) > Date.parse(firstAt),
    );
    expect(reworked.length).toBeGreaterThanOrEqual(3);
    expect(passedThenWorked.length).toBeGreaterThanOrEqual(1);
    expect(flow.current.tokens.rework).toBeGreaterThan(0);
  });
});
